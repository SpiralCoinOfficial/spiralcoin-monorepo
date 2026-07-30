// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV3PositionManager is IERC721 {
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1);
}

/**
 * @title SPLCLPLock
 * @notice Time-locks a Uniswap V3 LP NFT position for a fixed duration.
 *         Collected trading fees CAN be withdrawn to the fee recipient
 *         during the lock period (industry standard), but the LP position
 *         itself cannot be withdrawn until `unlockTime`.
 *
 *  Used for both:
 *    - Founder LP lock (12-month minimum, recommended 24 months)
 *    - LP partner positions (12-month minimum per term sheet)
 *
 *  Trust property: `unlockTime` can ONLY be EXTENDED, never shortened.
 */
contract SPLCLPLock is IERC721Receiver, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address depositor;
        address feeRecipient;
        uint64  unlockTime;
        bool    withdrawn;
    }

    IUniswapV3PositionManager public immutable positionManager;
    mapping(uint256 => Lock) public locks; // tokenId => Lock

    event Locked(uint256 indexed tokenId, address indexed depositor, address indexed feeRecipient, uint64 unlockTime);
    event LockExtended(uint256 indexed tokenId, uint64 newUnlockTime);
    event FeesCollected(uint256 indexed tokenId, uint256 amount0, uint256 amount1);
    event Withdrawn(uint256 indexed tokenId, address indexed to);

    constructor(IUniswapV3PositionManager _pm, address _owner) Ownable(_owner) {
        positionManager = _pm;
    }

    /// @notice Lock an LP NFT. Caller must `approve` or use `safeTransferFrom`.
    function lock(uint256 tokenId, address feeRecipient, uint64 lockDurationSec) external nonReentrant {
        require(feeRecipient != address(0), "fee recipient");
        require(lockDurationSec >= 365 days, "min 12 months");
        require(locks[tokenId].depositor == address(0), "already locked");

        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);

        uint64 unlockAt = uint64(block.timestamp) + lockDurationSec;
        locks[tokenId] = Lock({
            depositor: msg.sender,
            feeRecipient: feeRecipient,
            unlockTime: unlockAt,
            withdrawn: false
        });

        emit Locked(tokenId, msg.sender, feeRecipient, unlockAt);
    }

    /// @notice Extend the lock. Only forward in time. Anyone can call (trust++).
    function extend(uint256 tokenId, uint64 newUnlockTime) external {
        Lock storage l = locks[tokenId];
        require(l.depositor != address(0), "no lock");
        require(newUnlockTime > l.unlockTime, "must extend");
        l.unlockTime = newUnlockTime;
        emit LockExtended(tokenId, newUnlockTime);
    }

    /// @notice Collect trading fees during the lock. Anyone may trigger.
    function collectFees(uint256 tokenId) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        Lock memory l = locks[tokenId];
        require(l.depositor != address(0), "no lock");

        (amount0, amount1) = positionManager.collect(
            IUniswapV3PositionManager.CollectParams({
                tokenId: tokenId,
                recipient: l.feeRecipient,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        emit FeesCollected(tokenId, amount0, amount1);
    }

    /// @notice Withdraw the LP NFT after unlock. Only the original depositor.
    function withdraw(uint256 tokenId) external nonReentrant {
        Lock storage l = locks[tokenId];
        require(msg.sender == l.depositor, "not depositor");
        require(!l.withdrawn, "withdrawn");
        require(block.timestamp >= l.unlockTime, "still locked");

        l.withdrawn = true;
        positionManager.safeTransferFrom(address(this), msg.sender, tokenId);
        emit Withdrawn(tokenId, msg.sender);
    }

    /// @notice ERC721 receiver hook for safeTransferFrom.
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Rescue unrelated ERC20 tokens (NOT the locked LP NFT or its fees in-transit).
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
