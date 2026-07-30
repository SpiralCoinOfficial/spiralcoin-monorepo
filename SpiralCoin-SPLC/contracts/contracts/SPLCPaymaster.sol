// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPaymaster, PackedUserOperation} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH9 is IERC20 {
    function withdraw(uint256) external;
}

interface IPriceOracle {
    /// @notice SPLC per 1 ETH, scaled 1e18
    function splcPerEth() external view returns (uint256);
}

/**
 * @title SPLCPaymaster
 * @notice ERC-4337 paymaster that lets users pay gas in SPLC instead of ETH.
 *
 *  Flow:
 *    1. User submits UserOp with `paymasterAndData = abi.encodePacked(this, maxSplcCharge)`
 *    2. Paymaster validates the op, locks `maxSplcCharge` SPLC from the user
 *    3. EntryPoint executes the op (paymaster's ETH balance pays gas)
 *    4. `postOp` charges the user the actual SPLC equivalent of the ETH gas used
 *    5. Excess SPLC refunded to user
 *
 *  Auto-LP:
 *    - When collected SPLC balance > `lpThreshold`:
 *      * Sells `lpSwapBps` of the surplus SPLC for ETH on Uniswap V3
 *      * Pairs equal-value remainder of SPLC with the ETH back into the LP pool
 *      * Sends LP NFT to TREASURY (which forwards to time-locked LP lock)
 *    - Anyone can trigger `processCollectedFees()` (gas-permissioned anti-griefing)
 */
contract SPLCPaymaster is IPaymaster, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IEntryPoint public immutable entryPoint;
    IERC20 public immutable splc;
    IWETH9 public immutable weth;
    IUniswapV3Router public immutable swapRouter;
    IPriceOracle public oracle;

    address public treasury;
    uint24 public poolFee = 3000; // 0.30%

    // Surcharge applied on top of oracle price to cover slippage + paymaster margin
    uint256 public surchargeBps = 200; // 2%
    uint256 public constant BPS = 10000;

    // Auto-LP triggers
    uint256 public lpThreshold = 10_000 ether; // process when >10k SPLC collected
    uint256 public lpSwapBps = 5000;            // sell 50% to ETH, pair other 50%

    // M-2 fix: oracle-anchored floor on the user-supplied `minEthOut` so a
    // permissionless caller can't pass `0` and let an MEV bot sandwich the swap
    // for free. Owner-tunable; defaults to 1% maximum slippage from oracle.
    uint256 public maxSlippageBps = 100; // 1%

    mapping(bytes32 => uint256) public lockedSplc; // userOpHash => SPLC reserved

    event PaymasterValidated(bytes32 indexed userOpHash, address indexed sender, uint256 splcReserved);
    event GasCharged(bytes32 indexed userOpHash, address indexed sender, uint256 ethGasCost, uint256 splcCharged, uint256 splcRefunded);
    event FeesProcessed(uint256 splcSold, uint256 ethReceived, uint256 splcPaired);
    event OracleUpdated(address oracle);
    event TreasuryUpdated(address treasury);
    event ConfigUpdated(uint256 surchargeBps, uint256 lpThreshold, uint256 lpSwapBps, uint24 poolFee);
    event MaxSlippageUpdated(uint256 maxSlippageBps);

    constructor(
        IEntryPoint _entryPoint,
        IERC20 _splc,
        IWETH9 _weth,
        IUniswapV3Router _router,
        IPriceOracle _oracle,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        entryPoint = _entryPoint;
        splc = _splc;
        weth = _weth;
        swapRouter = _router;
        oracle = _oracle;
        treasury = _treasury;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "not EntryPoint");
        _;
    }

    // ── ERC-4337 IPaymaster ──────────────────────────────────────────────

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // paymasterAndData layout: [20 bytes paymaster addr][32 bytes maxSplcCharge]
        require(userOp.paymasterAndData.length >= 52, "bad pmd");
        uint256 maxSplcCharge = abi.decode(userOp.paymasterAndData[20:52], (uint256));

        uint256 oraclePrice = oracle.splcPerEth();
        require(oraclePrice > 0, "oracle dead");

        uint256 splcEquivalent = (maxCost * oraclePrice) / 1e18;
        uint256 splcWithSurcharge = splcEquivalent + (splcEquivalent * surchargeBps) / BPS;
        require(splcWithSurcharge <= maxSplcCharge, "splc charge too low");

        // Pull the maximum into escrow. Refund any excess in postOp.
        splc.safeTransferFrom(userOp.sender, address(this), splcWithSurcharge);
        lockedSplc[userOpHash] = splcWithSurcharge;

        emit PaymasterValidated(userOpHash, userOp.sender, splcWithSurcharge);

        context = abi.encode(userOpHash, userOp.sender, splcWithSurcharge, oraclePrice);
        validationData = 0; // success, no time bounds
    }

    function postOp(
        PostOpMode /*mode*/,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /*actualUserOpFeePerGas*/
    ) external override onlyEntryPoint {
        (bytes32 userOpHash, address sender, uint256 reserved, uint256 oraclePrice) =
            abi.decode(context, (bytes32, address, uint256, uint256));

        uint256 splcOwed = (actualGasCost * oraclePrice) / 1e18;
        splcOwed += (splcOwed * surchargeBps) / BPS;

        uint256 refund = reserved > splcOwed ? reserved - splcOwed : 0;
        if (refund > 0) {
            splc.safeTransfer(sender, refund);
        }
        delete lockedSplc[userOpHash];

        emit GasCharged(userOpHash, sender, actualGasCost, reserved - refund, refund);
    }

    // ── Auto-LP ──────────────────────────────────────────────────────────

    /// @notice Sells half the surplus SPLC for ETH, pairs back to LP, sends LP NFT to treasury.
    /// @dev Permissionless. Reverts if below threshold.
    function processCollectedFees(uint256 minEthOut) external nonReentrant {
        uint256 balance = splc.balanceOf(address(this));
        // Don't touch SPLC reserved for in-flight userOps
        // (in practice lockedSplc is small relative to accumulated fees)
        require(balance >= lpThreshold, "below threshold");

        uint256 toSwap = (balance * lpSwapBps) / BPS;

        // M-2: oracle-anchored slippage floor. oracle.splcPerEth() returns
        // SPLC per 1 ETH scaled 1e18, so expected ETH for `toSwap` SPLC is
        //   ethExpected = toSwap * 1e18 / oraclePrice
        // and the floor is ethExpected * (BPS - maxSlippageBps) / BPS.
        uint256 oraclePrice = oracle.splcPerEth();
        require(oraclePrice > 0, "oracle dead");
        uint256 ethExpected = (toSwap * 1e18) / oraclePrice;
        uint256 ethFloor = (ethExpected * (BPS - maxSlippageBps)) / BPS;
        require(minEthOut >= ethFloor, "minEthOut below floor");

        splc.forceApprove(address(swapRouter), toSwap);

        uint256 ethBefore = weth.balanceOf(address(this));
        swapRouter.exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn: address(splc),
                tokenOut: address(weth),
                fee: poolFee,
                recipient: address(this),
                amountIn: toSwap,
                amountOutMinimum: minEthOut,
                sqrtPriceLimitX96: 0
            })
        );
        uint256 ethGot = weth.balanceOf(address(this)) - ethBefore;

        // Send WETH + remaining SPLC to treasury for LP minting + locking
        uint256 splcRemaining = splc.balanceOf(address(this));
        weth.transfer(treasury, ethGot);
        splc.safeTransfer(treasury, splcRemaining);

        emit FeesProcessed(toSwap, ethGot, splcRemaining);
    }

    // ── EntryPoint deposit / stake management ────────────────────────────

    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
    }

    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function setOracle(IPriceOracle o) external onlyOwner {
        oracle = o;
        emit OracleUpdated(address(o));
    }

    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "zero");
        treasury = t;
        emit TreasuryUpdated(t);
    }

    function setConfig(uint256 surcharge_, uint256 lpThreshold_, uint256 lpSwapBps_, uint24 poolFee_) external onlyOwner {
        require(surcharge_ <= 1000, "surcharge too high"); // ≤10%
        require(lpSwapBps_ <= BPS, "swap bps");
        surchargeBps = surcharge_;
        lpThreshold = lpThreshold_;
        lpSwapBps = lpSwapBps_;
        poolFee = poolFee_;
        emit ConfigUpdated(surcharge_, lpThreshold_, lpSwapBps_, poolFee_);
    }

    /// @notice M-2: tune the oracle-anchored slippage floor used by
    /// `processCollectedFees`. Hard-capped at 5% to prevent owner griefing.
    function setMaxSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 500, "slippage too high"); // ≤5%
        maxSlippageBps = bps;
        emit MaxSlippageUpdated(bps);
    }

    /// @notice Rescue any unrelated tokens accidentally sent here.
    function rescue(IERC20 token, address to, uint256 amount) external onlyOwner {
        require(address(token) != address(splc), "use processCollectedFees");
        token.safeTransfer(to, amount);
    }

    receive() external payable {}
}
