// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {StrategyVault} from "../src/StrategyVault.sol";
import {AllocationController} from "../src/AllocationController.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Market} from "../src/Market.sol";

/// @notice Proves the AllocationController routes pooled capital to PROVEN agents only:
///         official-vault filter, track-record + score gates, score-weighted sizing, and that
///         realized agent profit flows back to index depositors.
contract AllocationControllerTest is Test {
    IdentityRegistry identity;
    ValidationRegistry validation;
    Market dex;
    MockERC20 usdg;
    MockERC20 tsla;
    MockERC20 amzn;
    VaultFactory factory;
    AllocationController ctrl;

    StrategyVault vHigh; // score 100
    StrategyVault vLow; // score 60
    StrategyVault vNo; // launched but no track record (ineligible)

    address trader = makeAddr("trader");
    address user = makeAddr("user");

    uint256 constant USDG = 1e6;
    uint256 constant STOCK = 1e18;

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        tsla = new MockERC20("Tesla", "TSLA", 18);
        amzn = new MockERC20("Amazon", "AMZN", 18);

        identity = new IdentityRegistry();
        validation = new ValidationRegistry(address(identity));
        dex = new Market(address(usdg));
        dex.setPrice(address(tsla), 100 * USDG);
        usdg.mint(address(dex), 100_000_000 * USDG);
        tsla.mint(address(dex), 10_000_000 * STOCK);

        address[] memory stocks = new address[](2);
        stocks[0] = address(tsla);
        stocks[1] = address(amzn);
        factory = new VaultFactory(
            address(usdg), address(identity), address(validation), address(dex), stocks
        );

        // This test contract launches (and thus owns) the agents.
        (, address a) = factory.launchAgent("high", trader);
        (, address b) = factory.launchAgent("low", trader);
        (, address c) = factory.launchAgent("norecord", trader);
        vHigh = StrategyVault(a);
        vLow = StrategyVault(b);
        vNo = StrategyVault(c);

        // Build track records: high agent +50% (score 100), low agent +10% (score 60).
        _scoreEpoch(vHigh, 1_000 * USDG, 150 * USDG);
        _scoreEpoch(vLow, 1_000 * USDG, 110 * USDG);

        // minScore 50 (breakeven), minEpochs 1 (must have settled at least one epoch).
        ctrl = new AllocationController(
            address(usdg), address(factory), address(validation), 50, 1
        );
    }

    // ------------------------------ Core tests ---------------------------- //

    function test_Deposit_MintsSharesOneToOne() public {
        _userDeposit(3_000 * USDG);
        assertEq(ctrl.shares(user), 3_000 * USDG);
        assertEq(ctrl.totalNAV(), 3_000 * USDG);
        assertEq(ctrl.idleUSDG(), 3_000 * USDG);
    }

    function test_Allocate_RoutesByScore_AndExcludesIneligible() public {
        _userDeposit(3_000 * USDG);

        uint256 highBefore = vHigh.totalAssets();
        uint256 lowBefore = vLow.totalAssets();

        address[] memory cands = _sorted(address(vHigh), address(vLow), address(vNo));
        ctrl.allocate(cands, 2_000 * USDG);

        // Weights 100 : 60 : 0 → high gets 1,250, low gets 750, norecord gets nothing.
        assertEq(vHigh.totalAssets() - highBefore, 1_250 * USDG, "high weighted higher");
        assertEq(vLow.totalAssets() - lowBefore, 750 * USDG, "low weighted lower");
        assertEq(ctrl.controllerShares(address(vNo)), 0, "no-track-record vault excluded");

        // Allocation conserves NAV (capital moved, not lost) and leaves the remainder idle.
        // NAV reads back within a few micro-USDG of 3,000 due to vault share-mint flooring.
        assertEq(ctrl.idleUSDG(), 1_000 * USDG);
        assertApproxEqAbs(ctrl.totalNAV(), 3_000 * USDG, 10);
    }

    function test_EligibleWeight_Gates() public {
        assertEq(ctrl.eligibleWeight(address(vHigh)), 100);
        assertEq(ctrl.eligibleWeight(address(vLow)), 60);
        assertEq(ctrl.eligibleWeight(address(vNo)), 0, "no track record -> weight 0");
        assertEq(ctrl.eligibleWeight(makeAddr("randomEOA")), 0, "non-official -> weight 0");
    }

    function test_Allocate_OnlyOwner() public {
        _userDeposit(1_000 * USDG);
        address[] memory cands = _sorted(address(vHigh), address(vLow), address(vNo));
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        ctrl.allocate(cands, 500 * USDG);
    }

    function test_Allocate_RequiresAscendingCandidates() public {
        _userDeposit(1_000 * USDG);
        address[] memory cands = new address[](2);
        cands[0] = address(vHigh);
        cands[1] = address(vHigh); // duplicate / not strictly ascending
        vm.expectRevert(AllocationController.NotAscending.selector);
        ctrl.allocate(cands, 500 * USDG);
    }

    function test_EndToEnd_AgentProfitFlowsToDepositor() public {
        _userDeposit(3_000 * USDG);
        address[] memory cands = _sorted(address(vHigh), address(vLow), address(vNo));
        ctrl.allocate(cands, 2_000 * USDG);
        assertApproxEqAbs(ctrl.totalNAV(), 3_000 * USDG, 10);

        // The high agent runs another +50% epoch on its now-larger book (incl. pool capital).
        uint256 managed = vHigh.totalAssets();
        dex.setPrice(address(tsla), 100 * USDG);
        vm.prank(trader);
        vHigh.startEpoch("e2");
        vm.prank(trader);
        vHigh.trade(address(usdg), address(tsla), managed, 0);
        dex.setPrice(address(tsla), 150 * USDG);
        uint256 held = vHigh.accountedStock(address(tsla));
        vm.prank(trader);
        vHigh.trade(address(tsla), address(usdg), held, 0);
        vm.prank(trader);
        vHigh.settleEpoch("r2", keccak256("r2"));

        // Pool NAV has risen from the agent's realized gains.
        assertGt(ctrl.totalNAV(), 3_000 * USDG, "pool NAV grew with the agent");

        // Recall capital home (permissionless) and let the depositor withdraw the profit.
        address[] memory rec = new address[](2);
        (rec[0], rec[1]) = address(vHigh) < address(vLow)
            ? (address(vHigh), address(vLow))
            : (address(vLow), address(vHigh));
        ctrl.recall(rec);

        uint256 sh = ctrl.shares(user);
        vm.prank(user);
        uint256 out = ctrl.withdraw(sh);
        assertGt(out, 3_300 * USDG, "depositor realizes the agent's gains");
    }

    function test_Withdraw_NeedsIdle_RecallUnblocksIt() public {
        _userDeposit(2_000 * USDG);
        address[] memory cands = _sorted(address(vHigh), address(vLow), address(vNo));
        ctrl.allocate(cands, 2_000 * USDG); // all idle deployed

        // Nothing idle → a full withdraw can't be paid yet.
        uint256 sh = ctrl.shares(user);
        uint256 owed = ctrl.totalNAV(); // sole depositor → owed == NAV (~2,000), idle == 0
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AllocationController.InsufficientIdle.selector, owed, 0));
        ctrl.withdraw(sh);

        // Recall brings funds home; now withdraw works.
        address[] memory rec = new address[](2);
        (rec[0], rec[1]) = address(vHigh) < address(vLow)
            ? (address(vHigh), address(vLow))
            : (address(vLow), address(vHigh));
        ctrl.recall(rec);
        vm.prank(user);
        uint256 out = ctrl.withdraw(sh);
        assertApproxEqAbs(out, 2_000 * USDG, 10, "recovers full principal (agents were flat this run)");
    }

    function test_Recall_PrunesDeployedVaults() public {
        _userDeposit(2_000 * USDG);
        address[] memory cands = _sorted(address(vHigh), address(vLow), address(vNo));
        ctrl.allocate(cands, 2_000 * USDG);
        assertEq(ctrl.deployedVaultCount(), 2, "two positions opened");

        address[] memory rec = new address[](2);
        (rec[0], rec[1]) = address(vHigh) < address(vLow)
            ? (address(vHigh), address(vLow))
            : (address(vLow), address(vHigh));
        ctrl.recall(rec);
        assertEq(ctrl.deployedVaultCount(), 0, "array pruned after full recall");
    }

    function test_RenounceOwnership_Disabled() public {
        vm.expectRevert(AllocationController.RenounceDisabled.selector);
        ctrl.renounceOwnership();
    }

    // -------------------------------- helpers ----------------------------- //

    function _userDeposit(uint256 amount) internal {
        usdg.mint(user, amount);
        vm.startPrank(user);
        usdg.approve(address(ctrl), type(uint256).max);
        ctrl.deposit(amount);
        vm.stopPrank();
    }

    /// @dev Fund a vault and run one full epoch ending at `sellPrice` to set its score.
    function _scoreEpoch(StrategyVault v, uint256 fund, uint256 sellPrice) internal {
        usdg.mint(address(this), fund);
        usdg.approve(address(v), type(uint256).max);
        v.deposit(fund);

        dex.setPrice(address(tsla), 100 * USDG);
        vm.prank(trader);
        v.startEpoch("e");
        vm.prank(trader);
        v.trade(address(usdg), address(tsla), fund, 0);
        dex.setPrice(address(tsla), sellPrice);
        uint256 held = v.accountedStock(address(tsla));
        vm.prank(trader);
        v.trade(address(tsla), address(usdg), held, 0);
        vm.prank(trader);
        v.settleEpoch("r", keccak256("r"));
    }

    function _sorted(address a, address b, address c) internal pure returns (address[] memory arr) {
        arr = new address[](3);
        arr[0] = a;
        arr[1] = b;
        arr[2] = c;
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < 2; j++) {
                if (arr[j] > arr[j + 1]) {
                    address t = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = t;
                }
            }
        }
    }
}
