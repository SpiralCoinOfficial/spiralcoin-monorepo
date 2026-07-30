// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SPLCStakingVault
 * @notice Holds the 150,000,000 SPLC staking allocation and emits rewards to
 *         stakers at a rate that is *capped* but adjustable by the owner
 *         (post-launch, owned by the DAO Timelock).
 *
 *  Design:
 *    - Single staking token = SPLC; single reward token = SPLC
 *    - Reward rate set in SPLC-per-second; owner can lower, but cannot exceed
 *      `MAX_REWARD_RATE` (anti-griefing safety cap)
 *    - Rewards accrue from the contract's pre-funded balance; once depleted,
 *      `claim()` returns whatever is left and stops
 *    - No lockup on staked principal — users can withdraw anytime
 *    - Pausable in case of emergency (e.g. discovered exploit upstream)
 *
 *  "Released based on platform usage" is implemented externally: the
 *  governance DAO calls `setRewardRate()` periodically based on observed
 *  on-chain usage metrics (volume, holders, txs) up to MAX_REWARD_RATE.
 */
contract SPLCStakingVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable splc;

    // ── Reward accounting ────────────────────────────────────────────────
    uint256 public rewardRate;              // SPLC per second, globally
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;    // 1e18-scaled

    // Cap: 150M SPLC released linearly over 48 months ≈ 1.19 SPLC/sec.
    // Set the cap at ~3x that so the DAO can frontload but not infinite-print.
    // (150_000_000 * 1e18) / (48 * 30 * 86400) ≈ 1.19e18
    uint256 public constant MAX_REWARD_RATE = 4 ether; // 4 SPLC per second

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ── Stake state ──────────────────────────────────────────────────────
    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalance;

    // ── Cumulative payout cap (cannot exceed contract's funded balance) ──
    uint256 public totalRewardsPaid;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    constructor(IERC20 _splc, address _owner) Ownable(_owner) {
        require(address(_splc) != address(0), "splc");
        splc = _splc;
        lastUpdateTime = block.timestamp;
    }

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ── Views ────────────────────────────────────────────────────────────
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        uint256 dt = block.timestamp - lastUpdateTime;
        return rewardPerTokenStored + (dt * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return (stakedBalance[account] *
            (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18
            + rewards[account];
    }

    /// @notice SPLC tokens left in the vault available for future rewards.
    function rewardReserves() external view returns (uint256) {
        uint256 bal = splc.balanceOf(address(this));
        return bal > totalStaked ? bal - totalStaked : 0;
    }

    // ── Stake / unstake / claim ──────────────────────────────────────────
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "zero");
        totalStaked += amount;
        stakedBalance[msg.sender] += amount;
        splc.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero");
        require(stakedBalance[msg.sender] >= amount, "insufficient");
        totalStaked -= amount;
        stakedBalance[msg.sender] -= amount;
        splc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claim() public nonReentrant updateReward(msg.sender) {
        uint256 r = rewards[msg.sender];
        if (r == 0) return;

        // Cap to actual unstaked reserves
        uint256 bal = splc.balanceOf(address(this));
        uint256 reserves = bal > totalStaked ? bal - totalStaked : 0;
        if (r > reserves) r = reserves;
        if (r == 0) return;

        rewards[msg.sender] -= r; // partial-payout aware: only subtract what we actually pay
        totalRewardsPaid += r;
        splc.safeTransfer(msg.sender, r);
        emit RewardPaid(msg.sender, r);
    }

    function exit() external {
        withdraw(stakedBalance[msg.sender]);
        claim();
    }

    /// @notice Withdraw stake without claiming rewards (e.g. paused state).
    function emergencyWithdraw() external nonReentrant {
        uint256 amt = stakedBalance[msg.sender];
        require(amt > 0, "zero");
        stakedBalance[msg.sender] = 0;
        totalStaked -= amt;
        // forfeit accrued rewards
        rewards[msg.sender] = 0;
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;
        splc.safeTransfer(msg.sender, amt);
        emit EmergencyWithdraw(msg.sender, amt);
    }

    // ── Owner / DAO controls ─────────────────────────────────────────────
    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        require(newRate <= MAX_REWARD_RATE, "rate cap");
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Rescue tokens that are NOT SPLC (e.g. accidental sends).
    function rescueOther(IERC20 other, address to, uint256 amount) external onlyOwner {
        require(address(other) != address(splc), "cannot drain SPLC");
        other.safeTransfer(to, amount);
    }
}
