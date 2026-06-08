// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {StrategyVault} from "../src/StrategyVault.sol";
import {AgentRunner} from "../src/AgentRunner.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockDEX} from "../src/mocks/MockDEX.sol";

/// @notice Proves AgentRunner executes a full epoch in ONE call: open -> buy -> move -> sell ->
///         settle, and the vault writes a realized-P&L score on-chain.
contract AgentRunnerTest is Test {
    IdentityRegistry identity;
    ValidationRegistry validation;
    MockDEX dex;
    MockERC20 usdg;
    MockERC20 tsla;
    VaultFactory factory;
    AgentRunner runner;
    StrategyVault vault;

    uint256 constant USDG = 1e6;
    uint256 constant STOCK = 1e18;

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        tsla = new MockERC20("Tesla", "TSLA", 18);
        identity = new IdentityRegistry();
        validation = new ValidationRegistry(address(identity));
        dex = new MockDEX(address(usdg));
        usdg.mint(address(dex), 100_000_000 * USDG);
        tsla.mint(address(dex), 10_000_000 * STOCK);

        address[] memory stocks = new address[](1);
        stocks[0] = address(tsla);
        factory = new VaultFactory(address(usdg), address(identity), address(validation), address(dex), stocks);

        runner = new AgentRunner(address(dex), address(usdg));
        // Runner must own the DEX (to set prices) and be the vault's trader.
        dex.transferOwnership(address(runner));
        (, address v) = factory.launchAgent("ipfs://momentum", address(runner));
        vault = StrategyVault(v);
        runner.configureAgent(v, address(tsla), int256(1500)); // +15% bias

        // Fund the vault so it has capital to trade.
        usdg.mint(address(this), 1_000 * USDG);
        usdg.approve(v, type(uint256).max);
        vault.deposit(1_000 * USDG);
    }

    function test_RunEpochManual_ProducesScore_AndWritesValidation() public {
        // Deterministic +50% round -> score 100.
        uint8 score = runner.runEpochManual(address(vault), int256(5000));
        assertEq(score, 100, "score 100 for +50%");
        assertFalse(vault.epochActive(), "epoch settled");

        // Score is readable from the ValidationRegistry, filtered to the vault validator.
        address[] memory vs = new address[](1);
        vs[0] = address(vault);
        (uint64 count, uint8 avg) = validation.getSummary(vault.agentId(), vs, "");
        assertEq(count, 1);
        assertEq(avg, 100);

        // Vault grew by the realized gain (1,000 -> ~1,500 USDG).
        assertApproxEqAbs(vault.totalAssets(), 1_500 * USDG, 10);
    }

    function test_RunEpochManual_Loss_LowersScore() public {
        uint8 score = runner.runEpochManual(address(vault), int256(-1000)); // -10%
        assertEq(score, 40, "score 40 for -10%");
        assertApproxEqAbs(vault.totalAssets(), 900 * USDG, 10);
    }

    function test_PublicRunEpoch_Works_AndBuildsTrackRecord() public {
        // Anyone can trigger a live round; result is pseudo-random around the +15% bias.
        runner.runEpoch(address(vault));
        runner.runEpoch(address(vault));
        address[] memory vs = new address[](1);
        vs[0] = address(vault);
        (uint64 count,) = validation.getSummary(vault.agentId(), vs, "");
        assertEq(count, 2, "two settled epochs recorded");
    }

    function test_ConfigureAgent_OnlyOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(AgentRunner.NotOwner.selector);
        runner.configureAgent(address(vault), address(tsla), 0);
    }

    function test_RunEpoch_RevertsForUnconfiguredVault() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRunner.AgentNotConfigured.selector, address(0xCAFE)));
        runner.runEpoch(address(0xCAFE));
    }
}
