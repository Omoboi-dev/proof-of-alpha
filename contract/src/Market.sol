// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMarket} from "./interfaces/IMarket.sol";

/// @title Market — oracle-priced swap venue for tokenized equities
/// @notice Swaps USDG ⇄ tokenized stocks at the venue's quoted price. Must be pre-funded with
///         liquidity of any token it will pay out.
/// @dev Price is "USDG (6 decimals) per 1 whole unit of the token". USDG's own price is 1e6.
///      The price feed is admin-gated so that on a public testnet an outsider cannot move quotes to
///      grief an agent's score. The pricing interface is a drop-in for a production DEX/oracle.
contract Market is IMarket, Ownable {
    using SafeERC20 for IERC20;

    address public immutable usdg;
    mapping(address => uint256) public priceUSDG6;

    error NoPrice(address token);
    error Slippage(uint256 amountOut, uint256 minAmountOut);

    constructor(address usdg_) Ownable(msg.sender) {
        usdg = usdg_;
        priceUSDG6[usdg_] = 1e6; // 1 USDG == 1.000000 USDG
    }

    /// @notice Set the quoted price of `token` in USDG (6 decimals) per 1 whole token. Owner only.
    function setPrice(address token, uint256 priceUSDG6_) external onlyOwner {
        priceUSDG6[token] = priceUSDG6_;
    }

    /// @inheritdoc IMarket
    function getPrice(address token) external view returns (uint256) {
        return priceUSDG6[token];
    }

    /// @inheritdoc IMarket
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut)
    {
        uint256 pIn = priceUSDG6[tokenIn];
        uint256 pOut = priceUSDG6[tokenOut];
        if (pIn == 0) revert NoPrice(tokenIn);
        if (pOut == 0) revert NoPrice(tokenOut);

        uint8 decIn = IERC20Metadata(tokenIn).decimals();
        uint8 decOut = IERC20Metadata(tokenOut).decimals();

        // Convert input to a common USDG (6-decimal) value, then to the output token.
        uint256 valueUSDG6 = (amountIn * pIn) / (10 ** decIn);
        amountOut = (valueUSDG6 * (10 ** decOut)) / pOut;
        if (amountOut < minAmountOut) revert Slippage(amountOut, minAmountOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
    }
}
