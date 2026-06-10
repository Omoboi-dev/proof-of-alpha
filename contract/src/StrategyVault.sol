// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IValidationRegistry} from "./interfaces/IValidationRegistry.sol";
import {IMarket} from "./interfaces/IMarket.sol";

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
    IMarket public immutable dex;

    // ------------------------------- Storage ------------------------------ //

    mapping(address => uint256) public shares; // depositor => shares
    uint256 public totalShares;

    /// @notice Accounted USDG = principal in/out adjusted by realized epoch P&L.
    /// @dev This — NOT `usdg.balanceOf` — is the source of truth for share pricing and the
    ///      score denominator. Using internal accounting makes both immune to donation
    ///      manipulation (a direct USDG transfer can never inflate the score or a share price).
    uint256 public totalManagedUSDG;

    address[] public stockTokens; // whitelisted tradable stock tokens
    mapping(address => bool) public isStock;

    bool public epochActive;
    uint256 public epochId; // increments each time an epoch starts
    uint256 public epochStartUSDG; // managed-USDG snapshot at epoch open (score denominator)
    /// @notice Realized P&L accumulated from USDG trade legs during the active epoch.
    /// @dev Only swaps with a USDG leg move this; donations to the vault do not. At settle
    ///      (vault flat) this equals the epoch's true realized trading P&L.
    int256 public epochTradePnL;
    /// @notice Accounted USDG currently available to spend on buys this epoch (ring-fence).
    /// @dev Initialized to the epoch's starting managed USDG and adjusted by USDG trade legs.
    ///      Buys cannot exceed it, so DONATED (un-accounted) USDG can never be deployed.
    uint256 public tradableUSDG;
    /// @notice Accounted units of each stock the vault actually bought (ring-fence).
    /// @dev A sell can only move accounted stock, so DONATED stock can never be sold, and
    ///      `_requireFlat` checks this ledger (not raw balanceOf) so a dust donation cannot
    ///      brick the vault. Together with `tradableUSDG`, donations of ANY asset are inert.
    mapping(address => uint256) public accountedStock;

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
    error ExceedsTradableUSDG(uint256 amountIn, uint256 available);
    error ExceedsAccountedStock(address token, uint256 amountIn, uint256 available);
    error InvalidStockToken(address token);

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
        dex = IMarket(dex_);
        agentId = agentId_;
        trader = trader_;
        for (uint256 i = 0; i < stockTokens_.length; i++) {
            address token = stockTokens_[i];
            // A stock token must not be USDG, the zero address, or a duplicate — otherwise
            // _requireFlat could permanently brick the vault or the set would be polluted.
            if (token == address(0) || token == usdg_ || isStock[token]) {
                revert InvalidStockToken(token);
            }
            stockTokens.push(token);
            isStock[token] = true;
        }
    }

    // --------------------------- Capital in/out --------------------------- //

    /// @notice Deposit USDG and receive shares. Frozen while an epoch is active.
    function deposit(uint256 amount) external nonReentrant returns (uint256 mintedShares) {
        if (epochActive) revert DepositsFrozen();
        if (amount == 0) revert ZeroAmount();

        // Share price uses internal accounting, not balanceOf (donation-proof). A fresh pool
        // (no shares) OR a fully-wiped pool (managed == 0) mints 1:1 to avoid div-by-zero.
        uint256 managed = totalManagedUSDG;
        mintedShares = (totalShares == 0 || managed == 0) ? amount : (amount * totalShares) / managed;
        if (mintedShares == 0) revert ZeroAmount();

        // Effects before interaction (CEI).
        totalShares += mintedShares;
        shares[msg.sender] += mintedShares;
        totalManagedUSDG = managed + amount;

        usdg.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, mintedShares);
    }

    /// @notice Burn shares and withdraw USDG pro-rata. Frozen while an epoch is active.
    function withdraw(uint256 shareAmount) external nonReentrant returns (uint256 usdgOut) {
        if (epochActive) revert DepositsFrozen();
        if (shareAmount == 0) revert ZeroAmount();
        uint256 userShares = shares[msg.sender];
        if (userShares < shareAmount) revert NothingToWithdraw();

        uint256 managed = totalManagedUSDG;
        usdgOut = (shareAmount * managed) / totalShares;

        // Effects before interaction (CEI).
        shares[msg.sender] = userShares - shareAmount;
        totalShares -= shareAmount;
        totalManagedUSDG = managed - usdgOut;

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

        // Ring-fence the INPUT: the agent may only move capital the vault accounts for, so
        // donated USDG or donated stock can never enter the trade flow (or the score).
        if (tokenIn == address(usdg)) {
            if (amountIn > tradableUSDG) revert ExceedsTradableUSDG(amountIn, tradableUSDG);
        } else {
            if (amountIn > accountedStock[tokenIn]) {
                revert ExceedsAccountedStock(tokenIn, amountIn, accountedStock[tokenIn]);
            }
        }

        IERC20(tokenIn).forceApprove(address(dex), amountIn);
        amountOut = dex.swap(tokenIn, tokenOut, amountIn, minAmountOut);
        IERC20(tokenIn).forceApprove(address(dex), 0); // M2: leave no residual allowance

        // Debit the input asset's accounted ledger.
        if (tokenIn == address(usdg)) {
            tradableUSDG -= amountIn;
            epochTradePnL -= int256(amountIn); // spent USDG (buy)
        } else {
            accountedStock[tokenIn] -= amountIn;
        }
        // Credit the output asset's accounted ledger.
        if (tokenOut == address(usdg)) {
            tradableUSDG += amountOut;
            epochTradePnL += int256(amountOut); // received USDG (sell)
        } else {
            accountedStock[tokenOut] += amountOut;
        }

        emit Traded(tokenIn, tokenOut, amountIn, amountOut);
    }

    // -------------------------- Epoch lifecycle --------------------------- //

    /// @notice Open a scoring epoch: snapshot starting USDG, freeze flows, and open this
    ///         vault's ERC-8004 validation request (vault names itself as validator).
    function startEpoch(string calldata requestURI) external nonReentrant returns (bytes32 requestHash) {
        _onlyTraderOrOwner();
        if (epochActive) revert EpochIsActive();
        _requireFlat();

        uint256 startUSDG = totalManagedUSDG;
        if (startUSDG == 0) revert EmptyVault();

        epochId += 1;
        epochStartUSDG = startUSDG;
        epochTradePnL = 0;
        tradableUSDG = startUSDG; // ring-fence: only accounted capital can be traded
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
        nonReentrant
        returns (int256 realizedPnL, uint8 score)
    {
        _onlyTraderOrOwner();
        if (!epochActive) revert EpochNotActive();
        _requireFlat();

        // Realized P&L comes from the tracked USDG trade legs, never from balanceOf — so a
        // direct USDG donation to the vault cannot inflate the score.
        realizedPnL = epochTradePnL;
        score = _scoreFromPnL(realizedPnL, epochStartUSDG);

        // Roll the epoch's realized P&L into the accounted principal (clamp at 0; a vault
        // cannot owe more than it managed).
        int256 newManaged = int256(totalManagedUSDG) + realizedPnL;
        totalManagedUSDG = newManaged < 0 ? 0 : uint256(newManaged);

        epochActive = false;

        bytes32 requestHash = epochRequestHash(epochId);
        validation.validationResponse(requestHash, score, responseURI, responseHash, "realizedPnL");
        emit EpochSettled(epochId, realizedPnL, score, requestHash);
    }

    // -------------------------------- Views ------------------------------- //

    /// @notice Accounted USDG assets backing shares (donation-proof; not raw balanceOf).
    function totalAssets() external view returns (uint256) {
        return totalManagedUSDG;
    }

    /// @notice Raw USDG token balance held by the vault (may exceed totalAssets if donated).
    function usdgBalance() external view returns (uint256) {
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

    /// @dev Revert unless every accounted stock position is closed (vault fully in USDG).
    ///      Uses the accounted ledger, NOT raw balanceOf, so a dust donation of a stock token
    ///      cannot brick startEpoch/settleEpoch.
    function _requireFlat() internal view {
        for (uint256 i = 0; i < stockTokens.length; i++) {
            uint256 pos = accountedStock[stockTokens[i]];
            if (pos != 0) revert VaultNotFlat(stockTokens[i], pos);
        }
    }

    function _onlyTraderOrOwner() internal view {
        if (msg.sender != trader && msg.sender != identity.ownerOf(agentId)) {
            revert NotTraderOrOwner();
        }
    }
}
