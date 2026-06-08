// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {StrategyVault} from "../src/StrategyVault.sol";
import {AllocationController} from "../src/AllocationController.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockDEX} from "../src/mocks/MockDEX.sol";

/// @title DeployDemo — one-shot, self-contained deployment of Proof of Alpha
/// @notice Deploys the full stack and seeds 3 demo agents with REAL on-chain track records, so
///         the leaderboard has live, unfakeable data the instant it goes up. Each agent runs a
///         genuine epoch (deposit USDG → buy stock → price moves → sell → settle), and the
///         resulting realized-P&L score is written to the ValidationRegistry by the vault itself.
///
/// @dev Self-contained on purpose: it deploys its OWN mock USDG + mock stocks + MockDEX so the
///      demo is fully reproducible by judges and the deployer controls prices/liquidity. The
///      production target is canonical USDG on Robinhood Chain — to switch, replace `usdg` with
///      `0x7E955252E15c84f5768B83c41a71F9eba181802F` (6 decimals) and point the DEX/stocks at
///      real venues; nothing else in the wiring changes.
///
///      Run:
///        forge script script/DeployDemo.s.sol:DeployDemo \
///          --rpc-url robinhood_testnet --broadcast -vvv
///      Requires env PRIVATE_KEY (the deployer; it becomes owner + trader of the demo agents).
contract DeployDemo is Script {
    // Demo scale (USDG has 6 decimals; stocks 18).
    uint256 constant USDG = 1e6;
    uint256 constant STOCK = 1e18;
    uint256 constant FUND = 1_000 * USDG; // capital each demo agent trades for its track record
    uint256 constant DEX_USDG_LIQ = 1_000_000 * USDG;
    uint256 constant DEX_STOCK_LIQ = 100_000 * STOCK;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // 1) Base assets: a demo dollar (USDG, 6 dec) + three tokenized stocks (18 dec).
        MockERC20 usdg = new MockERC20("Global Dollar", "USDG", 6);
        MockERC20 tsla = new MockERC20("Tesla", "TSLA", 18);
        MockERC20 amzn = new MockERC20("Amazon", "AMZN", 18);
        MockERC20 pltr = new MockERC20("Palantir", "PLTR", 18);

        // 2) Trading venue, priced + funded so agents can actually buy and sell.
        MockDEX dex = new MockDEX(address(usdg));
        dex.setPrice(address(tsla), 100 * USDG);
        dex.setPrice(address(amzn), 100 * USDG);
        dex.setPrice(address(pltr), 100 * USDG);
        usdg.mint(address(dex), DEX_USDG_LIQ);
        tsla.mint(address(dex), DEX_STOCK_LIQ);
        amzn.mint(address(dex), DEX_STOCK_LIQ);
        pltr.mint(address(dex), DEX_STOCK_LIQ);

        // 3) ERC-8004 registries.
        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry(address(identity));
        ValidationRegistry validation = new ValidationRegistry(address(identity));

        // 4) The factory (mints official vaults) + the allocation index (capital router).
        address[] memory stocks = new address[](3);
        stocks[0] = address(tsla);
        stocks[1] = address(amzn);
        stocks[2] = address(pltr);
        VaultFactory factory =
            new VaultFactory(address(usdg), address(identity), address(validation), address(dex), stocks);
        AllocationController controller = new AllocationController(
            address(usdg), address(factory), address(validation), 50, 1
        );

        // 5) Seed three demo agents with genuine, differentiated track records.
        //    Momentum +50% -> score 100 | Steady +10% -> score 60 | MeanRev -10% -> score 40.
        usdg.mint(deployer, 3 * FUND); // capital the deployer will run through the agents

        address vMomentum =
            _seedAgent(factory, usdg, dex, tsla, deployer, "ipfs://momentum-alpha", 150 * USDG);
        address vSteady =
            _seedAgent(factory, usdg, dex, amzn, deployer, "ipfs://steady-yield", 110 * USDG);
        address vMeanRev =
            _seedAgent(factory, usdg, dex, pltr, deployer, "ipfs://mean-reversion", 90 * USDG);

        vm.stopBroadcast();

        // 6) Print everything the frontend / verifier needs.
        console2.log("=== Proof of Alpha deployed (chainid %s) ===", block.chainid);
        console2.log("USDG (demo)        ", address(usdg));
        console2.log("TSLA               ", address(tsla));
        console2.log("AMZN               ", address(amzn));
        console2.log("PLTR               ", address(pltr));
        console2.log("MockDEX            ", address(dex));
        console2.log("IdentityRegistry   ", address(identity));
        console2.log("ReputationRegistry ", address(reputation));
        console2.log("ValidationRegistry ", address(validation));
        console2.log("VaultFactory       ", address(factory));
        console2.log("AllocationController", address(controller));
        console2.log("--- demo agent vaults (validator = the vault itself) ---");
        console2.log("Momentum Alpha  (score 100)", vMomentum);
        console2.log("Steady Yield    (score 60) ", vSteady);
        console2.log("Mean Reversion  (score 40) ", vMeanRev);
        console2.log("Eligible weight Momentum:", controller.eligibleWeight(vMomentum));
        console2.log("Eligible weight Steady:  ", controller.eligibleWeight(vSteady));
        console2.log("Eligible weight MeanRev: ", controller.eligibleWeight(vMeanRev));
        console2.log("(MeanRev should read 0 -> below minScore 50, correctly excluded)");
    }

    /// @dev Launch an agent and run one full epoch ending at `sellPrice` so its realized-P&L
    ///      score is written on-chain. Deployer is the launcher (NFT owner) and the trader.
    function _seedAgent(
        VaultFactory factory,
        MockERC20 usdg,
        MockDEX dex,
        MockERC20 stock,
        address deployer,
        string memory agentURI,
        uint256 sellPrice
    ) internal returns (address vaultAddr) {
        (, vaultAddr) = factory.launchAgent(agentURI, deployer);
        StrategyVault vault = StrategyVault(vaultAddr);

        // Fund the vault.
        usdg.approve(vaultAddr, FUND);
        vault.deposit(FUND);

        // Reset the buy price (a prior agent may have moved it), open the epoch, buy in.
        dex.setPrice(address(stock), 100 * USDG);
        vault.startEpoch(agentURI);
        vault.trade(address(usdg), address(stock), FUND, 0);

        // Price moves, then the agent sells everything back to USDG (must be flat to settle).
        dex.setPrice(address(stock), sellPrice);
        uint256 held = vault.accountedStock(address(stock));
        vault.trade(address(stock), address(usdg), held, 0);

        // Settle: the vault computes realized P&L and writes the score to the ValidationRegistry.
        vault.settleEpoch(agentURI, keccak256(abi.encodePacked(agentURI, "r")));
    }
}
