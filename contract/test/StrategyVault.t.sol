// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {StrategyVault} from "../src/StrategyVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockDEX} from "../src/mocks/MockDEX.sol";

/// @notice Proves the StrategyVault audit claims: non-custodial, donation-immune scoring,
///         and griefing-resistant liveness. Each "attack" test asserts the score / liveness
///         does not budge.
contract StrategyVaultTest is Test {
    IdentityRegistry identity;
    ValidationRegistry validation;
    MockDEX dex;
    MockERC20 usdg;
    MockERC20 tsla;
    MockERC20 amzn;
    StrategyVault vault;

    address owner = makeAddr("owner"); // agent NFT owner
    address trader = makeAddr("trader"); // the agent's trading key
    address alice = makeAddr("alice"); // capital provider
    address attacker = makeAddr("attacker");

    uint256 agentId;

    uint256 constant USDG = 1e6; // 1 USDG (6 decimals)
    uint256 constant STOCK = 1e18; // 1 whole stock token (18 decimals)

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        tsla = new MockERC20("Tesla", "TSLA", 18);
        amzn = new MockERC20("Amazon", "AMZN", 18);

        identity = new IdentityRegistry();
        validation = new ValidationRegistry(address(identity));
        dex = new MockDEX(address(usdg));

        // Prices: TSLA $100, AMZN $200 (USDG has 6 decimals).
        dex.setPrice(address(tsla), 100 * USDG);
        dex.setPrice(address(amzn), 200 * USDG);

        // Fund the DEX with deep liquidity for payouts.
        usdg.mint(address(dex), 10_000_000 * USDG);
        tsla.mint(address(dex), 1_000_000 * STOCK);
        amzn.mint(address(dex), 1_000_000 * STOCK);

        // Register the agent (owner holds the NFT).
        vm.prank(owner);
        agentId = identity.register("ipfs://agent");

        address[] memory stocks = new address[](2);
        stocks[0] = address(tsla);
        stocks[1] = address(amzn);
        vault = new StrategyVault(
            address(usdg), address(identity), address(validation), address(dex), agentId, trader, stocks
        );

        // Wire the vault as the agent's operator so it can open & answer its validation.
        vm.prank(owner);
        identity.setAgentWallet(agentId, address(vault));

        // Alice funds the vault with 1,000 USDG.
        usdg.mint(alice, 1_000 * USDG);
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(1_000 * USDG);
        vm.stopPrank();
    }

    // ----------------------------- Happy path ----------------------------- //

    function test_HappyPath_ProfitScoresHigh() public {
        vm.prank(trader);
        vault.startEpoch("ipfs://epoch1");

        // Buy 1,000 USDG worth of TSLA (-> 10 TSLA at $100).
        vm.prank(trader);
        vault.trade(address(usdg), address(tsla), 1_000 * USDG, 0);
        assertEq(vault.accountedStock(address(tsla)), 10 * STOCK, "bought 10 TSLA");

        // TSLA rises to $150 (+50%).
        dex.setPrice(address(tsla), 150 * USDG);

        // Sell all TSLA back to USDG.
        uint256 held = vault.accountedStock(address(tsla));
        vm.prank(trader);
        vault.trade(address(tsla), address(usdg), held, 0);

        (int256 pnl, uint8 score) = _settle();
        assertEq(pnl, int256(500 * USDG), "+500 USDG realized");
        assertEq(score, 100, "score maxes at +50%");

        // The score is queryable from the ERC-8004 ValidationRegistry, filtered to this vault.
        address[] memory vaults = new address[](1);
        vaults[0] = address(vault);
        (uint64 count, uint8 avg) = validation.getSummary(agentId, vaults, "");
        assertEq(count, 1);
        assertEq(avg, 100);
    }

    function test_Loss_ScoresLow_AndVaultStaysUsable() public {
        vm.prank(trader);
        vault.startEpoch("e");
        vm.prank(trader);
        vault.trade(address(usdg), address(tsla), 1_000 * USDG, 0);

        // Crash TSLA to $40 (-60%).
        dex.setPrice(address(tsla), 40 * USDG);
        uint256 held = vault.accountedStock(address(tsla));
        vm.prank(trader);
        vault.trade(address(tsla), address(usdg), held, 0);

        (int256 pnl, uint8 score) = _settle();
        assertEq(pnl, -int256(600 * USDG), "-600 USDG realized");
        assertEq(score, 0, "score floors on a big loss");

        // The vault must remain depositable after a loss (no div-by-zero / brick).
        usdg.mint(alice, 100 * USDG);
        vm.prank(alice);
        vault.deposit(100 * USDG);
    }

    // --------------------------- Attack: donations ------------------------ //

    function test_Attack_DonateUSDG_DoesNotInflateScore() public {
        vm.prank(trader);
        vault.startEpoch("e");

        // Attacker dumps a huge USDG donation straight into the vault.
        usdg.mint(attacker, 1_000_000 * USDG);
        vm.prank(attacker);
        usdg.transfer(address(vault), 1_000_000 * USDG);

        // The agent cannot deploy donated USDG: only the accounted 1,000 is tradable.
        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(StrategyVault.ExceedsTradableUSDG.selector, 1_000 * USDG + 1, 1_000 * USDG)
        );
        vault.trade(address(usdg), address(tsla), 1_000 * USDG + 1, 0);

        // No trades happen → realized P&L is exactly 0 and the score is neutral 50,
        // despite a million-dollar donation sitting in the vault.
        (int256 pnl, uint8 score) = _settle();
        assertEq(pnl, 0, "donation is not realized P&L");
        assertEq(score, 50, "score unmoved by donation");
    }

    function test_Attack_DonateStock_CannotBeSold() public {
        vm.prank(trader);
        vault.startEpoch("e");

        // Attacker donates 100 TSLA to the vault.
        tsla.mint(attacker, 100 * STOCK);
        vm.prank(attacker);
        tsla.transfer(address(vault), 100 * STOCK);

        // The agent owns 0 *accounted* TSLA, so it cannot sell the donated stock for profit.
        vm.prank(trader);
        vm.expectRevert(
            abi.encodeWithSelector(StrategyVault.ExceedsAccountedStock.selector, address(tsla), 1, 0)
        );
        vault.trade(address(tsla), address(usdg), 1, 0);

        (int256 pnl, uint8 score) = _settle();
        assertEq(pnl, 0, "donated stock cannot become realized P&L");
        assertEq(score, 50, "score unmoved by stock donation");
    }

    function test_Attack_DustStockDonation_DoesNotBrick() public {
        // Attacker pre-seeds a 1-wei TSLA donation before any epoch.
        tsla.mint(attacker, 1);
        vm.prank(attacker);
        tsla.transfer(address(vault), 1);

        // _requireFlat uses the accounted ledger, not balanceOf, so startEpoch still works.
        vm.prank(trader);
        vault.startEpoch("e");

        // ...and a full round trip + settle still works despite the lingering dust.
        vm.prank(trader);
        vault.trade(address(usdg), address(tsla), 1_000 * USDG, 0);
        uint256 held = vault.accountedStock(address(tsla));
        vm.prank(trader);
        vault.trade(address(tsla), address(usdg), held, 0);

        (, uint8 score) = _settle();
        assertEq(score, 50, "round-trip at flat price scores neutral; settle not bricked");
    }

    function test_Attack_FirstDepositorShareInflation_Fails() public {
        // Fresh vault with no deposits yet (setUp's vault already has Alice's deposit).
        address[] memory stocks = new address[](1);
        stocks[0] = address(tsla);
        StrategyVault v = new StrategyVault(
            address(usdg), address(identity), address(validation), address(dex), agentId, trader, stocks
        );

        // Attacker is the FIRST depositor with a single unit, then donates a huge amount
        // directly to try to inflate the share price (classic ERC-4626 inflation attack).
        usdg.mint(attacker, 1);
        vm.startPrank(attacker);
        usdg.approve(address(v), type(uint256).max);
        uint256 attackerShares = v.deposit(1);
        vm.stopPrank();
        assertEq(attackerShares, 1);

        usdg.mint(attacker, 1_000_000 * USDG);
        vm.prank(attacker);
        usdg.transfer(address(v), 1_000_000 * USDG); // donation

        // Honest depositor still gets FAIR shares (priced off internal accounting, not balance).
        usdg.mint(alice, 1_000 * USDG);
        vm.startPrank(alice);
        usdg.approve(address(v), type(uint256).max);
        uint256 aliceShares = v.deposit(1_000 * USDG);
        vm.stopPrank();
        assertEq(aliceShares, 1_000 * USDG, "alice not diluted by the donation");

        // Alice recovers her full principal; attacker cannot skim the donation via 1 share.
        vm.prank(alice);
        assertEq(v.withdraw(aliceShares), 1_000 * USDG, "alice recovers full principal");
        vm.prank(attacker);
        assertEq(v.withdraw(attackerShares), 1, "attacker's 1 share is worth 1, not the donation");
    }

    // ----------------------- Access control / custody --------------------- //

    function test_NonCustodial_TraderHasNoSharesAndCannotWithdraw() public {
        assertEq(vault.shares(trader), 0);
        vm.prank(trader);
        vm.expectRevert(StrategyVault.NothingToWithdraw.selector);
        vault.withdraw(1);
    }

    function test_OnlyTraderCanTrade() public {
        vm.prank(trader);
        vault.startEpoch("e");
        vm.prank(alice);
        vm.expectRevert(StrategyVault.NotTrader.selector);
        vault.trade(address(usdg), address(tsla), 1 * USDG, 0);
    }

    function test_DepositsFrozenDuringEpoch() public {
        vm.prank(trader);
        vault.startEpoch("e");
        usdg.mint(alice, 10 * USDG);
        vm.prank(alice);
        vm.expectRevert(StrategyVault.DepositsFrozen.selector);
        vault.deposit(10 * USDG);
    }

    function test_Constructor_RejectsUsdgAsStock() public {
        address[] memory bad = new address[](1);
        bad[0] = address(usdg);
        vm.expectRevert(abi.encodeWithSelector(StrategyVault.InvalidStockToken.selector, address(usdg)));
        new StrategyVault(
            address(usdg), address(identity), address(validation), address(dex), agentId, trader, bad
        );
    }

    function test_AliceCanWithdrawAfterProfit() public {
        // Run a +50% epoch, then Alice withdraws everything and should get ~1,500 USDG.
        test_HappyPath_ProfitScoresHigh();
        uint256 sharesAlice = vault.shares(alice);
        vm.prank(alice);
        uint256 out = vault.withdraw(sharesAlice);
        assertEq(out, 1_500 * USDG, "alice realizes the agent's gains");
    }

    // -------------------------------- helper ------------------------------ //

    function _settle() internal returns (int256 pnl, uint8 score) {
        vm.prank(trader);
        (pnl, score) = vault.settleEpoch("ipfs://result", keccak256("result"));
    }
}
