// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StrategyVault} from "./StrategyVault.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IValidationRegistry} from "./interfaces/IValidationRegistry.sol";
import {IMockDEX} from "./interfaces/IMockDEX.sol";

/// @title VaultFactory — launches official, trustable StrategyVaults
/// @notice One call (`launchAgent`) atomically: registers a new ERC-8004 agent, deploys its
///         StrategyVault, wires the vault as the agent's operator (so it can score itself),
///         records the vault as OFFICIAL, and hands the agent NFT to the caller.
///
/// @dev The `isOfficialVault` registry is the trust anchor for the whole system: consumers
///      (the AllocationController and the leaderboard) MUST only count ERC-8004 validation
///      scores whose validator is an official vault from this factory. That is what stops a
///      dishonest agent owner from naming themselves validator and self-reporting a fake score.
///
///      To wire `agentWallet` without granting the factory any NFT-transfer rights over the
///      user's assets, the factory registers the agent itself (becoming its momentary owner),
///      sets the wallet, then transfers the agent NFT to the caller in the same transaction.
contract VaultFactory {
    IIdentityRegistry public immutable identity;
    IValidationRegistry public immutable validation;
    IMockDEX public immutable dex;
    address public immutable usdg;

    /// @notice The shared set of tradable stock tokens every vault is launched with.
    address[] public stockTokens;

    /// @notice The trust anchor: true only for vaults this factory deployed.
    mapping(address => bool) public isOfficialVault;
    address[] public allVaults;
    mapping(uint256 => address) public vaultOf; // agentId => vault

    event VaultLaunched(
        uint256 indexed agentId, address indexed vault, address indexed owner, address trader
    );

    error EmptyStockSet();
    error InvalidStockToken(address token);
    error ZeroTrader();
    error ZeroAddress();

    constructor(
        address usdg_,
        address identity_,
        address validation_,
        address dex_,
        address[] memory stockTokens_
    ) {
        if (usdg_ == address(0) || identity_ == address(0) || validation_ == address(0) || dex_ == address(0))
        {
            revert ZeroAddress();
        }
        if (stockTokens_.length == 0) revert EmptyStockSet();
        usdg = usdg_;
        identity = IIdentityRegistry(identity_);
        validation = IValidationRegistry(validation_);
        dex = IMockDEX(dex_);

        // Validate the shared stock set up front so launches can't all silently revert later.
        for (uint256 i = 0; i < stockTokens_.length; i++) {
            address token = stockTokens_[i];
            if (token == address(0) || token == usdg_) revert InvalidStockToken(token);
            for (uint256 j = 0; j < i; j++) {
                if (stockTokens_[j] == token) revert InvalidStockToken(token);
            }
            stockTokens.push(token);
        }
    }

    /// @notice Launch a new agent and its official vault in one transaction. The agent NFT is
    ///         transferred to the caller, who becomes the agent owner.
    /// @param agentURI off-chain metadata URI for the agent (name, strategy, etc.).
    /// @param trader the key the agent's bot will trade from (only address allowed to trade()).
    /// @return agentId the new ERC-8004 agent id.
    /// @return vault the deployed StrategyVault address.
    function launchAgent(string calldata agentURI, address trader)
        external
        returns (uint256 agentId, address vault)
    {
        if (trader == address(0)) revert ZeroTrader();

        // Factory registers the agent → it is the momentary owner, which lets it set the wallet.
        agentId = identity.register(agentURI);

        StrategyVault v = new StrategyVault(
            usdg, address(identity), address(validation), address(dex), agentId, trader, stockTokens
        );
        vault = address(v);

        // Wire the vault as the agent's operator so it can open & answer its own validations.
        identity.setAgentWallet(agentId, vault);

        // Record as official BEFORE handing over ownership.
        isOfficialVault[vault] = true;
        allVaults.push(vault);
        vaultOf[agentId] = vault;

        // Hand the agent NFT to the caller (non-safe transfer: no receiver callback needed,
        // and the caller may be a contract that doesn't implement onERC721Received).
        identity.transferFrom(address(this), msg.sender, agentId);

        emit VaultLaunched(agentId, vault, msg.sender, trader);
    }

    // -------------------------------- Views ------------------------------- //

    /// @notice All official vault addresses (for leaderboards / allocation filtering).
    function officialVaults() external view returns (address[] memory) {
        return allVaults;
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    function stockTokenCount() external view returns (uint256) {
        return stockTokens.length;
    }
}
