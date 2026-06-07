// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMockDEX — minimal swap venue used by StrategyVault
/// @notice A deterministic, admin-priced swap contract. Lets the agent move between USDG and
///         tokenized stocks, and lets us simulate a price crash on demand for the demo.
/// @dev Prices are expressed as USDG (6 decimals) per 1 whole unit of the token.
interface IMockDEX {
    /// @notice Swap `amountIn` of `tokenIn` for `tokenOut`. Pulls `tokenIn` from the caller
    ///         (caller must approve first) and sends `tokenOut` back to the caller.
    /// @return amountOut amount of `tokenOut` sent to the caller.
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut);

    /// @notice Current price of `token` in USDG (6 decimals) per 1 whole token.
    function getPrice(address token) external view returns (uint256);
}
