// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IValidationRegistry} from "./interfaces/IValidationRegistry.sol";
import {IMockDEX} from "./interfaces/IMockDEX.sol";

/// @title StrategyVault — the "vault is the validator"
/// @notice A non-custodial vault for ONE agent. Capital providers deposit USDG and receive
///         shares. The agent's `trader` key may move funds between USDG and whitelisted stock
///         tokens through the DEX — but has NO way to send funds to itself. Each epoch the
///         vault computes the agent's REALIZED P&L on-chain (USDG in vs USDG out) and writes
///         the resulting 0–100 score to the ERC-8004 ValidationRegistry as the agent's
///         designated validator. The score is therefore impossible to fake.
///
/// @dev Epoch lifecycle keeps accounting trustless and oracle-free:
///      - Between epochs the vault is FLAT (holds only USDG) → share pricing is unambiguous.
///      - `startEpoch` freezes deposits/withdrawals and snapshots the starting USDG.
///      - The agent trades; before settling it must sell everything back to USDG (flat).
///      - `settleEpoch` measures realized P&L = endUSDG − startUSDG, scores it, and reports it.
///      Because start and end are both fully in USDG, the difference is realized P&L by
///      construction — no price oracle is ever trusted for the score.
///
///      For the vault to act as the agent's ERC-8004 validator, deployment must set this vault
///      as the agent's `agentWallet` (operator) in the IdentityRegistry. Then the vault can
///      open its own validation request and answer it.
contract StrategyVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ----------------------------- Immutables ----------------------------- //

    IERC20 public immutable usdg; // base asset (6 decimals)
    uint256 public immutable agentId; // ERC-8004 identity
    address public immutable trader; // the only key allowed to call trade()
    IIdentityRegistry public immutable identity;
    IValidationRegistry public immutable validation;
    IMockDEX public immutable dex;

    // ------------------------------- Storage ------------------------------ //

    mapping(address => uint256) public shares; // depositor => shares
    uint256 public totalShares;

    address[] public stockTokens; // whitelisted tradable stock tokens
    mapping(address => bool) public isStock;

    bool public epochActive;
    uint256 public epochId; // increments each time an epoch starts
    uint256 public epochStartUSDG; // USDG snapshot at epoch open

    // ------------------------------- Events ------------------------------- //

    event Deposited(address indexed user, uint256 usdgIn, uint256 sharesOut);
    event Withdrawn(address indexed user, uint256 sharesIn, uint256 usdgOut);
    event Traded(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event EpochStarted(uint256 indexed epochId, uint256 startUSDG, bytes32 requestHash);
    event EpochSettled(uint256 indexed epochId, int256 realizedPnL, uint8 score, bytes32 requestHash);

    // ------------------------------- Errors ------------------------------- //

    error NotTrader();
    error NotTraderOrOwner();
    error EpochIsActive();
    error EpochNotActive();
    error DepositsFrozen();
    error VaultNotFlat(address token, uint256 balance);
    error EmptyVault();
    error ZeroAmount();
    error TokenNotAllowed(address token);
    error SameToken();
    error NothingToWithdraw();

    constructor(
        address usdg_,
        address identity_,
        address validation_,
        address dex_,
        uint256 agentId_,
        address trader_,
        address[] memory stockTokens_
    ) {
        usdg = IERC20(usdg_);
        identity = IIdentityRegistry(identity_);
        validation = IValidationRegistry(validation_);
        dex = IMockDEX(dex_);
        agentId = agentId_;
        trader = trader_;
        for (uint256 i = 0; i < stockTokens_.length; i++) {
            stockTokens.push(stockTokens_[i]);
            isStock[stockTokens_[i]] = true;
        }
    }

    // --------------------------- Capital in/out --------------------------- //

    /// @notice Deposit USDG and receive shares. Frozen while an epoch is active.
    function deposit(uint256 amount) external nonReentrant returns (uint256 mintedShares) {
        if (epochActive) revert DepositsFrozen();
        if (amount == 0) revert ZeroAmount();

        // Between epochs the vault holds only USDG, so total assets == USDG balance.
        uint256 assetsBefore = usdg.balanceOf(address(this));
        mintedShares = totalShares == 0 ? amount : (amount * totalShares) / assetsBefore;
        if (mintedShares == 0) revert ZeroAmount();

        // Effects before interaction (CEI).
        totalShares += mintedShares;
        shares[msg.sender] += mintedShares;

        usdg.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, mintedShares);
    }

    /// @notice Burn shares and withdraw USDG pro-rata. Frozen while an epoch is active.
    function withdraw(uint256 shareAmount) external nonReentrant returns (uint256 usdgOut) {
        if (epochActive) revert DepositsFrozen();
        if (shareAmount == 0) revert ZeroAmount();
        uint256 userShares = shares[msg.sender];
        if (userShares < shareAmount) revert NothingToWithdraw();

        uint256 assets = usdg.balanceOf(address(this));
        usdgOut = (shareAmount * assets) / totalShares;

        // Effects before interaction (CEI).
        shares[msg.sender] = userShares - shareAmount;
        totalShares -= shareAmount;

        usdg.safeTransfer(msg.sender, usdgOut);
        emit Withdrawn(msg.sender, shareAmount, usdgOut);
    }

    // ------------------------------- Trading ------------------------------ //

    /// @notice The agent trades between USDG and whitelisted stock tokens via the DEX.
    /// @dev Only the `trader` key. There is NO path here to send funds to an arbitrary
    ///      address — tokens only ever move vault → DEX → vault. This is the non-custodial
    ///      guarantee: the agent can trade your money, never take it.
    function trade(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (msg.sender != trader) revert NotTrader();
        if (!epochActive) revert EpochNotActive();
        if (amountIn == 0) revert ZeroAmount();
        if (tokenIn == tokenOut) revert SameToken();
        if (tokenIn != address(usdg) && !isStock[tokenIn]) revert TokenNotAllowed(tokenIn);
        if (tokenOut != address(usdg) && !isStock[tokenOut]) revert TokenNotAllowed(tokenOut);

        IERC20(tokenIn).forceApprove(address(dex), amountIn);
        amountOut = dex.swap(tokenIn, tokenOut, amountIn, minAmountOut);
        emit Traded(tokenIn, tokenOut, amountIn, amountOut);
    }

    // -------------------------- Epoch lifecycle --------------------------- //

    /// @notice Open a scoring epoch: snapshot starting USDG, freeze flows, and open this
    ///         vault's ERC-8004 validation request (vault names itself as validator).
    function startEpoch(string calldata requestURI) external returns (bytes32 requestHash) {
        _onlyTraderOrOwner();
        if (epochActive) revert EpochIsActive();
        _requireFlat();

        uint256 startUSDG = usdg.balanceOf(address(this));
        if (startUSDG == 0) revert EmptyVault();

        epochId += 1;
        epochStartUSDG = startUSDG;
        epochActive = true;

        requestHash = epochRequestHash(epochId);
        // Vault is the agent's operator → allowed to open the request; names itself validator.
        validation.validationRequest(address(this), agentId, requestURI, requestHash);
        emit EpochStarted(epochId, startUSDG, requestHash);
    }

    /// @notice Close the epoch: requires the vault is flat (all positions sold to USDG),
    ///         computes realized P&L, maps it to a 0–100 score, and writes it to the
    ///         ValidationRegistry as the agent's validator.
    function settleEpoch(string calldata responseURI, bytes32 responseHash)
        external
        returns (int256 realizedPnL, uint8 score)
    {
        _onlyTraderOrOwner();
        if (!epochActive) revert EpochNotActive();
        _requireFlat();

        uint256 endUSDG = usdg.balanceOf(address(this));
        realizedPnL = int256(endUSDG) - int256(epochStartUSDG);
        score = _scoreFromPnL(realizedPnL, epochStartUSDG);

        epochActive = false;

        bytes32 requestHash = epochRequestHash(epochId);
        validation.validationResponse(requestHash, score, responseURI, responseHash, "realizedPnL");
        emit EpochSettled(epochId, realizedPnL, score, requestHash);
    }

    // -------------------------------- Views ------------------------------- //

    /// @notice Total USDG assets (valid between epochs, when the vault is flat).
    function totalAssets() external view returns (uint256) {
        return usdg.balanceOf(address(this));
    }

    function stockTokenCount() external view returns (uint256) {
        return stockTokens.length;
    }

    /// @notice Deterministic request hash for an epoch (opener and responder agree on it).
    function epochRequestHash(uint256 epochId_) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), agentId, epochId_));
    }

    // ------------------------------- Internal ----------------------------- //

    /// @dev Maps realized P&L to a score in [0,100], centered at 50 (= breakeven).
    ///      score = 50 + percentReturn, clamped. e.g. +50% → 100, 0% → 50, −50% → 0.
    function _scoreFromPnL(int256 pnl, uint256 startUSDG) internal pure returns (uint8) {
        int256 returnBps = (pnl * 10_000) / int256(startUSDG);
        int256 score = 50 + returnBps / 100; // returnBps/100 == percent return
        if (score < 0) score = 0;
        if (score > 100) score = 100;
        return uint8(uint256(score));
    }

    /// @dev Revert unless the vault holds zero of every stock token (fully in USDG).
    function _requireFlat() internal view {
        for (uint256 i = 0; i < stockTokens.length; i++) {
            uint256 bal = IERC20(stockTokens[i]).balanceOf(address(this));
            if (bal != 0) revert VaultNotFlat(stockTokens[i], bal);
        }
    }

    function _onlyTraderOrOwner() internal view {
        if (msg.sender != trader && msg.sender != identity.ownerOf(agentId)) {
            revert NotTraderOrOwner();
        }
    }
}
