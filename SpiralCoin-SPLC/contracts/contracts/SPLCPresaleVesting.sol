// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SPLCPresaleVesting
 * @notice Generic per-beneficiary linear vesting with cliff. Used for:
 *           - LP partner service fee (100M SPLC, 6m cliff + 18m linear)
 *           - Seed / strategic investors
 *           - Team / advisor allocations
 *
 *  - Each schedule is independent (different cliff, slope, amount)
 *  - Tokens deposited up-front by owner into the contract
 *  - Beneficiary calls `release()` after cliff to claim vested portion
 *  - Owner CANNOT revoke or steal tokens (unrecoverable design = trust signal)
 */
contract SPLCPresaleVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct Schedule {
        uint128 total;          // total SPLC vested over the period
        uint128 released;       // amount already claimed
        uint64  start;          // unix timestamp
        uint64  cliff;          // seconds after start before any vests
        uint64  duration;       // total vesting duration in seconds (incl. cliff)
        bool    exists;
    }

    mapping(address => Schedule) public schedules;
    uint256 public totalAllocated;

    event ScheduleCreated(address indexed beneficiary, uint256 total, uint64 start, uint64 cliff, uint64 duration);
    event Released(address indexed beneficiary, uint256 amount);

    constructor(IERC20 _token, address _owner) Ownable(_owner) {
        require(address(_token) != address(0), "token");
        token = _token;
    }

    /// @notice Owner funds the contract first, then creates a schedule.
    function createSchedule(
        address beneficiary,
        uint128 total,
        uint64 start,
        uint64 cliff,
        uint64 duration
    ) external onlyOwner {
        require(beneficiary != address(0), "beneficiary");
        require(!schedules[beneficiary].exists, "exists");
        require(total > 0, "total");
        require(duration >= cliff, "duration<cliff");
        require(duration > 0, "duration");
        require(token.balanceOf(address(this)) >= totalAllocated + total, "underfunded");

        schedules[beneficiary] = Schedule({
            total: total,
            released: 0,
            start: start,
            cliff: cliff,
            duration: duration,
            exists: true
        });
        totalAllocated += total;

        emit ScheduleCreated(beneficiary, total, start, cliff, duration);
    }

    function vestedAmount(address beneficiary) public view returns (uint256) {
        Schedule memory s = schedules[beneficiary];
        if (!s.exists) return 0;
        uint256 nowTs = block.timestamp;
        if (nowTs < uint256(s.start) + uint256(s.cliff)) return 0;
        uint256 elapsed = nowTs - uint256(s.start);
        if (elapsed >= uint256(s.duration)) return uint256(s.total);
        return (uint256(s.total) * elapsed) / uint256(s.duration);
    }

    function releasable(address beneficiary) public view returns (uint256) {
        return vestedAmount(beneficiary) - uint256(schedules[beneficiary].released);
    }

    function release() external nonReentrant {
        uint256 amount = releasable(msg.sender);
        require(amount > 0, "nothing");
        schedules[msg.sender].released += uint128(amount);
        token.safeTransfer(msg.sender, amount);
        emit Released(msg.sender, amount);
    }

    /// @notice No `revoke()`. By design — gives beneficiaries hard guarantees.
    /// Owner can rescue OTHER (unrelated) tokens accidentally sent here.
    function rescueOther(IERC20 other, address to, uint256 amount) external onlyOwner {
        require(address(other) != address(token), "cannot drain vesting token");
        other.safeTransfer(to, amount);
    }
}
