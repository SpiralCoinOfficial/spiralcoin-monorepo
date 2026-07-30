// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title SPLCPresalePublic
 * @notice Fixed-price ETH presale for SPLC. Holds the 250,000,000 public
 *         allocation. Buyers send ETH and receive SPLC instantly (or vested,
 *         depending on `vestingDuration`).
 *
 *  Compliance gates (enforced ON-CHAIN as defense-in-depth -- the website
 *  geo-blocks US visitors and the Reg D path is a separate contract):
 *    - Optional Merkle allowlist (set `allowRoot != 0` to require)
 *    - Per-wallet min/max contribution
 *    - Global hard cap (ETH)
 *    - Time-windowed (`startTime` ... `endTime`)
 *    - Pausable kill switch
 *
 *  Vesting: if `vestingDuration > 0`, buyers receive a pull-vested claim
 *  (linear, no cliff). If 0, buyers receive SPLC immediately.
 *
 *  Owner = DAO Timelock post-launch.
 */
contract SPLCPresalePublic is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable splc;

    uint256 public splcPerEth;

    uint256 public hardCapEth;
    uint256 public minContributionEth;
    uint256 public maxContributionEth;

    uint64 public startTime;
    uint64 public endTime;

    bytes32 public allowRoot;          // 0 = open sale (subject to geo block on web)
    bool public allowRootLocked;

    uint64 public vestingDuration;     // seconds; 0 = instant delivery
    uint64 public vestingStart;        // unix timestamp at which vesting begins (typically TGE)

    uint256 public totalRaisedEth;
    address payable public treasury;

    struct Position {
        uint256 ethContributed;
        uint256 splcOwed;
        uint256 splcClaimed;
    }
    mapping(address => Position) public positions;

    // Tracks cumulative SPLC owed for vault-balance checks
    uint256 private _splcOwedAccumulator;

    event Bought(address indexed buyer, uint256 ethIn, uint256 splcOut);
    event Claimed(address indexed buyer, uint256 amount);
    event ConfigUpdated();
    event AllowRootUpdated(bytes32 root);
    event TreasuryUpdated(address treasury);
    event Swept(address to, uint256 amountEth);

    constructor(
        IERC20 _splc,
        address _owner,
        address payable _treasury,
        uint256 _splcPerEth,
        uint256 _hardCapEth,
        uint256 _minEth,
        uint256 _maxEth,
        uint64 _startTime,
        uint64 _endTime,
        uint64 _vestingDuration,
        uint64 _vestingStart
    ) Ownable(_owner) {
        require(address(_splc) != address(0), "splc");
        require(_treasury != address(0), "treasury");
        require(_splcPerEth > 0, "price");
        require(_endTime > _startTime, "window");
        require(_maxEth >= _minEth && _minEth > 0, "min/max");

        splc = _splc;
        treasury = _treasury;
        splcPerEth = _splcPerEth;
        hardCapEth = _hardCapEth;
        minContributionEth = _minEth;
        maxContributionEth = _maxEth;
        startTime = _startTime;
        endTime = _endTime;
        vestingDuration = _vestingDuration;
        vestingStart = _vestingStart;
    }

    // ------------------------------------------------------------------ Buy

    /// @param proof empty array if allowRoot is unset.
    function buy(bytes32[] calldata proof) external payable nonReentrant whenNotPaused {
        require(block.timestamp >= startTime, "not started");
        require(block.timestamp <= endTime, "ended");
        require(msg.value >= minContributionEth, "below min");
        require(totalRaisedEth + msg.value <= hardCapEth, "hard cap");

        Position storage p = positions[msg.sender];
        require(p.ethContributed + msg.value <= maxContributionEth, "wallet cap");

        if (allowRoot != bytes32(0)) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encodePacked(msg.sender))));
            require(MerkleProof.verify(proof, allowRoot, leaf), "not allowlisted");
            allowRootLocked = true;
        }

        uint256 splcOut = (msg.value * splcPerEth) / 1 ether;
        require(splc.balanceOf(address(this)) >= _splcOwedAccumulator + splcOut, "vault dry");

        // --- Checks-Effects-Interactions: ALL state writes before external calls ---
        p.ethContributed += msg.value;
        p.splcOwed       += splcOut;
        totalRaisedEth   += msg.value;
        _splcOwedAccumulator += splcOut;

        // Record claim upfront so the write is before any ETH or token transfer.
        // This fixes the reentrancy-eth (HIGH) finding: previously p.splcClaimed
        // was written after treasury.call{value:}(), violating CEI.
        bool deliverNow = (vestingDuration == 0);
        if (deliverNow) {
            p.splcClaimed += splcOut;
        }

        // --- External interactions (no state writes below this line) ---

        // Forward ETH to treasury immediately (no escrow).
        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "eth fwd");

        if (deliverNow) {
            splc.safeTransfer(msg.sender, splcOut);
        }

        emit Bought(msg.sender, msg.value, splcOut);
    }

    // -------------------------------------------------------- Claim (vested)

    function claim() external nonReentrant {
        Position storage p = positions[msg.sender];
        uint256 vested = _vested(p.splcOwed);
        uint256 amt = vested > p.splcClaimed ? vested - p.splcClaimed : 0;
        require(amt > 0, "nothing");
        p.splcClaimed += amt;
        splc.safeTransfer(msg.sender, amt);
        emit Claimed(msg.sender, amt);
    }

    function claimable(address user) external view returns (uint256) {
        Position memory p = positions[user];
        uint256 v = _vested(p.splcOwed);
        return v > p.splcClaimed ? v - p.splcClaimed : 0;
    }

    function _vested(uint256 total) internal view returns (uint256) {
        if (vestingDuration == 0) return total;
        if (block.timestamp < vestingStart) return 0;
        uint256 elapsed = block.timestamp - vestingStart;
        if (elapsed >= vestingDuration) return total;
        return (total * elapsed) / vestingDuration;
    }

    function _totalSplcOwed() internal view returns (uint256) {
        return _splcOwedAccumulator;
    }

    // -------------------------------------------------------------- Admin

    function setConfig(
        uint256 _splcPerEth,
        uint256 _hardCapEth,
        uint256 _minEth,
        uint256 _maxEth,
        uint64 _startTime,
        uint64 _endTime
    ) external onlyOwner {
        require(totalRaisedEth == 0, "sale started");
        require(_splcPerEth > 0, "price");
        require(_endTime > _startTime, "window");
        require(_maxEth >= _minEth && _minEth > 0, "min/max");
        splcPerEth = _splcPerEth;
        hardCapEth = _hardCapEth;
        minContributionEth = _minEth;
        maxContributionEth = _maxEth;
        startTime = _startTime;
        endTime = _endTime;
        emit ConfigUpdated();
    }

    function setAllowRoot(bytes32 root) external onlyOwner {
        require(!allowRootLocked, "locked after first verified buy");
        allowRoot = root;
        emit AllowRootUpdated(root);
    }

    function setTreasury(address payable t) external onlyOwner {
        require(t != address(0), "zero");
        treasury = t;
        emit TreasuryUpdated(t);
    }

    function setVesting(uint64 duration_, uint64 start_) external onlyOwner {
        require(totalRaisedEth == 0, "sale started");
        vestingDuration = duration_;
        vestingStart = start_;
        emit ConfigUpdated();
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice After endTime, sweep unsold SPLC back to a destination address.
    function sweepUnsoldSplc(address to) external onlyOwner {
        require(block.timestamp > endTime, "sale active");
        require(to != address(0), "zero");
        uint256 bal = splc.balanceOf(address(this));
        uint256 stillOwed = _splcOwedAccumulator;
        require(bal >= stillOwed, "vault < owed");
        uint256 sweepable = bal - stillOwed;
        splc.safeTransfer(to, sweepable);
        emit Swept(to, sweepable);
    }
}
