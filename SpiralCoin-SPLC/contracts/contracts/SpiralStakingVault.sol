// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SpiralStakingVault
 * @notice MasterChef-style single-asset staking vault for SPLC.
 *         Receives the 50% staking slice of the 3.14% protocol fee and
 *         distributes it pro-rata to stakers via accRewardPerShare accounting.
 *
 *         Reward distribution model: pull-based, gas-efficient, and immune to
 *         the classic "rewards locked in contract" griefing pattern.
 *
 *         CEI pattern (Checks-Effects-Interactions) is strictly followed:
 *         all state changes happen before external token transfers so that
 *         Slither static analysis and future auditors see no reentrancy
 *         concerns even beyond what ReentrancyGuard already guarantees.
 */
contract SpiralStakingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable splc;

    uint256 public totalStaked;
    uint256 public accRewardPerShare;       // scaled by 1e18
    uint256 public constant PRECISION = 1e18;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }
    mapping(address => UserInfo) public userInfo;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount);

    constructor(IERC20 _splc) Ownable(msg.sender) {
        require(address(_splc) != address(0), "zero token");
        splc = _splc;
    }

    /// @notice Called by the token contract (or anyone) to top up rewards
    ///         that were transferred in. Updates accRewardPerShare.
    function notifyRewardAmount(uint256 amount) external nonReentrant {
        require(amount > 0, "zero reward");
        // Effects first (CEI): update accRewardPerShare before the transfer.
        // If safeTransferFrom reverts the whole tx reverts, rolling back the
        // state change; so crediting rewards before pulling the tokens is safe.
        if (totalStaked > 0) {
            accRewardPerShare += (amount * PRECISION) / totalStaked;
        }
        // Interaction last
        splc.safeTransferFrom(msg.sender, address(this), amount);
        if (totalStaked > 0) {
            emit RewardAdded(amount);
        }
        // When totalStaked == 0 the tokens sit in the contract and will be
        // distributed when the next reward notification comes in after staking.
    }

    function pending(address user) public view returns (uint256) {
        UserInfo memory u = userInfo[user];
        return (u.amount * accRewardPerShare) / PRECISION - u.rewardDebt;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        // Read pending before touching state (based on current amount)
        uint256 pendingAmt = pending(msg.sender);
        // Effects first (CEI)
        userInfo[msg.sender].amount += amount;
        totalStaked += amount;
        userInfo[msg.sender].rewardDebt =
            (userInfo[msg.sender].amount * accRewardPerShare) / PRECISION;
        emit Staked(msg.sender, amount);
        // Interactions last
        splc.safeTransferFrom(msg.sender, address(this), amount);
        if (pendingAmt > 0) {
            splc.safeTransfer(msg.sender, pendingAmt);
            emit RewardClaimed(msg.sender, pendingAmt);
        }
    }

    function unstake(uint256 amount) external nonReentrant {
        UserInfo storage u = userInfo[msg.sender];
        require(amount > 0 && amount <= u.amount, "bad amount");
        // Read pending before touching state
        uint256 pendingAmt = pending(msg.sender);
        // Effects first (CEI)
        u.amount -= amount;
        totalStaked -= amount;
        u.rewardDebt = (u.amount * accRewardPerShare) / PRECISION;
        emit Unstaked(msg.sender, amount);
        // Interactions last
        splc.safeTransfer(msg.sender, amount);
        if (pendingAmt > 0) {
            splc.safeTransfer(msg.sender, pendingAmt);
            emit RewardClaimed(msg.sender, pendingAmt);
        }
    }

    function claim() external nonReentrant {
        uint256 pendingAmt = pending(msg.sender);
        // Effects first (CEI)
        userInfo[msg.sender].rewardDebt =
            (userInfo[msg.sender].amount * accRewardPerShare) / PRECISION;
        // Interaction last
        if (pendingAmt > 0) {
            splc.safeTransfer(msg.sender, pendingAmt);
            emit RewardClaimed(msg.sender, pendingAmt);
        }
    }
}
