// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StrategyVault} from "./StrategyVault.sol";
import {MockDEX} from "./mocks/MockDEX.sol";

/// @title AgentRunner — one-click, on-chain trading rounds for demo agents
/// @notice Executes a FULL epoch — open → buy → (simulated) market move → sell → settle — in a
///         single transaction, so a UI can trigger a live, real, on-chain trading round and the
///         vault itself writes the resulting realized-P&L score.
///
/// @dev What is real vs. simulated (be explicit): the price move is a SIMULATED market — this
///      contract owns the MockDEX and sets the price. Everything else is real and trustless: the
///      swaps execute on-chain, the vault's donation-proof accounting measures realized P&L, and
///      the 0–100 score is written to the ERC-8004 ValidationRegistry by the vault. On a real
///      deployment the MockDEX is swapped for a real DEX/oracle and this price-setting goes away.
///
///      For this to work the runner must be (a) each demo vault's `trader`, set at launch via the
///      factory, and (b) the owner of the MockDEX, transferred after deployment.
contract AgentRunner {
    MockDEX public immutable dex;
    address public immutable usdg;

    address public owner;
    uint256 public basePrice = 100e6; // USDG (6 decimals) per whole stock token at epoch open
    uint256 private _nonce;

    mapping(address => address) public stockOf; // vault => the stock token it trades
    mapping(address => int256) public biasBps; // vault => skill bias in bps (e.g. +1500 = +15% mean)

    event AgentConfigured(address indexed vault, address indexed stock, int256 biasBps);
    event EpochRun(address indexed vault, address indexed stock, int256 moveBps, uint8 score);

    error NotOwner();
    error AgentNotConfigured(address vault);

    constructor(address dex_, address usdg_) {
        dex = MockDEX(dex_);
        usdg = usdg_;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ----------------------------- Admin ----------------------------- //

    function configureAgent(address vault, address stock, int256 bias) external onlyOwner {
        stockOf[vault] = stock;
        biasBps[vault] = bias;
        emit AgentConfigured(vault, stock, bias);
    }

    function setBasePrice(uint256 p) external onlyOwner {
        basePrice = p;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // --------------------------- Run a round -------------------------- //

    /// @notice Run one live trading round for `vault`. Public so anyone can trigger a round in the
    ///         demo; the outcome is pseudo-random around the vault's configured bias — NOT chosen
    ///         by the caller — so scores stay meaningful.
    function runEpoch(address vault) external returns (uint8 score) {
        return _run(vault, _moveBps(vault));
    }

    /// @notice Owner-only deterministic round (used to seed clean initial track records).
    function runEpochManual(address vault, int256 moveBps) external onlyOwner returns (uint8 score) {
        return _run(vault, _clamp(moveBps));
    }

    // ----------------------------- Internal --------------------------- //

    function _run(address vaultAddr, int256 move) internal returns (uint8 score) {
        address stock = stockOf[vaultAddr];
        if (stock == address(0)) revert AgentNotConfigured(vaultAddr);
        StrategyVault vault = StrategyVault(vaultAddr);
        string memory uri = "ipfs://live-epoch";

        // Open the epoch (snapshots starting USDG, opens the on-chain validation request).
        vault.startEpoch(uri);

        // Buy: deploy all tradable USDG into the stock at the base price.
        dex.setPrice(stock, basePrice);
        uint256 amt = vault.tradableUSDG();
        vault.trade(usdg, stock, amt, 0);

        // Simulated market move, then sell everything back to USDG (vault must be flat to settle).
        dex.setPrice(stock, _apply(basePrice, move));
        uint256 held = vault.accountedStock(stock);
        vault.trade(stock, usdg, held, 0);

        // Settle: the vault computes realized P&L and writes the 0–100 score on-chain.
        (, score) = vault.settleEpoch(uri, keccak256(abi.encode(vaultAddr, block.number, _nonce)));
        emit EpochRun(vaultAddr, stock, move, score);
    }

    /// @dev Pseudo-random move (±20%) around the vault's bias, clamped to ±50% (score range).
    function _moveBps(address vault) internal returns (int256) {
        uint256 r = uint256(keccak256(abi.encode(block.prevrandao, block.timestamp, vault, _nonce++)));
        int256 rand = int256(r % 4001) - 2000; // -2000..+2000 bps
        return _clamp(biasBps[vault] + rand);
    }

    function _clamp(int256 move) internal pure returns (int256) {
        if (move > 5000) return 5000; // +50% -> score 100
        if (move < -5000) return -5000; // -50% -> score 0
        return move;
    }

    function _apply(uint256 price, int256 bps) internal pure returns (uint256) {
        int256 np = (int256(price) * (10000 + bps)) / 10000;
        return np < 1 ? 1 : uint256(np);
    }
}
