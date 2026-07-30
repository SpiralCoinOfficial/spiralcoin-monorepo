// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV3PoolImmutables {
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IUniswapV3PoolState {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
    function observe(uint32[] calldata secondsAgos) external view returns (
        int56[] memory tickCumulatives,
        uint160[] memory secondsPerLiquidityCumulativeX128
    );
}

/**
 * @title SPLCTwapOracle
 * @notice Uniswap V3 30-minute TWAP oracle. Returns SPLC per 1 ETH (scaled 1e18)
 *         so SPLCPaymaster can price gas in SPLC.
 *
 *  Why TWAP not spot: a 30-min TWAP requires ~$millions of flash-loan capital
 *  to manipulate, vs spot which costs only a few hundred dollars to push 5%.
 *
 *  Owner can swap to a Chainlink oracle later by deploying a new oracle
 *  contract and calling `paymaster.setOracle(newOracle)`.
 */
contract SPLCTwapOracle is Ownable {
    address public immutable pool;
    address public immutable splc;
    address public immutable weth;
    uint32 public twapPeriod = 1800; // 30 minutes

    bool public immutable splcIsToken0;

    event TwapPeriodUpdated(uint32 newPeriod);

    constructor(address _pool, address _splc, address _weth, address _owner) Ownable(_owner) {
        require(_pool != address(0) && _splc != address(0) && _weth != address(0), "zero");
        pool = _pool;
        splc = _splc;
        weth = _weth;
        address t0 = IUniswapV3PoolImmutables(_pool).token0();
        address t1 = IUniswapV3PoolImmutables(_pool).token1();
        require(
            (t0 == _splc && t1 == _weth) || (t0 == _weth && t1 == _splc),
            "wrong pool"
        );
        splcIsToken0 = (t0 == _splc);
    }

    function setTwapPeriod(uint32 secs) external onlyOwner {
        require(secs >= 300 && secs <= 3600, "300-3600");
        twapPeriod = secs;
        emit TwapPeriodUpdated(secs);
    }

    /// @notice Returns SPLC per 1 ETH, scaled 1e18.
    function splcPerEth() external view returns (uint256) {
        uint32 period = twapPeriod;
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;
        (int56[] memory tickCumulatives,) = IUniswapV3PoolState(pool).observe(secondsAgos);
        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 avgTick = int24(tickDelta / int56(uint56(period)));

        // priceX96 = 1.0001^tick * 2^96 ; for our purpose use OZ-style math via getSqrtRatioAtTick
        // Inline approximation: convert tick to ratio via Uniswap's TickMath equivalent.
        uint160 sqrtPriceX96 = _getSqrtRatioAtTick(avgTick);

        // Compute price = (sqrtPriceX96 / 2^96)^2
        // Then return as splc per eth scaled 1e18.
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        // price of token1 in terms of token0 = priceX192 / 2^192
        // If SPLC is token0: token1 per token0 = price; we want SPLC per ETH:
        //   If WETH = token1: SPLC (token0) per WETH (token1) = 1 / price
        //   If WETH = token0: SPLC (token1) per WETH (token0) = price

        if (splcIsToken0) {
            // splc per eth = 2^192 / priceX192, scaled 1e18
            // = (1e18 * 2^192) / priceX192
            return (1e18 * (1 << 192)) / priceX192;
        } else {
            // splc per eth = priceX192 / 2^192, scaled 1e18
            return (priceX192 * 1e18) >> 192;
        }
    }

    // ── Minimal TickMath.getSqrtRatioAtTick (Uniswap V3 library, MIT) ───
    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= 887272, "T");

        uint256 ratio = absTick & 0x1 != 0 ? 0xfffcb933bd6fad37aa2d162d1a594001 : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;

        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }
}
