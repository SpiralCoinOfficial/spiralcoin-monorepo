// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title SPLCAirdropMerkle
 * @notice Claim-driven Merkle airdrop for the 50,000,000 SPLC community bucket.
 *         Pre-fund the contract with the entire airdrop amount, set the Merkle
 *         root, and recipients call `claim(amount, proof)` from their wallet.
 *
 *  Properties:
 *    - One-shot per address (mapping flips at claim time)
 *    - `claimDeadline` enforces a hard expiry; after expiry the owner can
 *      sweep unclaimed tokens to the treasury
 *    - Owner CAN rotate the root before any claims (typo recovery) but
 *      CANNOT once claims have begun (prevents rug)
 *    - Owner CAN'T claw back individual claims
 */
contract SPLCAirdropMerkle is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable splc;
    bytes32 public merkleRoot;
    uint64 public claimDeadline;
    uint256 public totalClaimed;
    bool public rootLocked;            // flips true after first claim

    mapping(address => bool) public claimed;

    event RootUpdated(bytes32 newRoot, uint64 newDeadline);
    event Claimed(address indexed account, uint256 amount);
    event UnclaimedSwept(address indexed to, uint256 amount);

    constructor(IERC20 _splc, address _owner, uint64 _deadline) Ownable(_owner) {
        require(address(_splc) != address(0), "splc");
        require(_deadline > block.timestamp, "deadline in past");
        splc = _splc;
        claimDeadline = _deadline;
    }

    function setMerkleRoot(bytes32 newRoot, uint64 newDeadline) external onlyOwner {
        require(!rootLocked, "locked after first claim");
        require(newDeadline > block.timestamp, "deadline in past");
        merkleRoot = newRoot;
        claimDeadline = newDeadline;
        emit RootUpdated(newRoot, newDeadline);
    }

    /// @notice Recipients call this with the leaf (account, amount) + proof.
    function claim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        require(block.timestamp <= claimDeadline, "expired");
        require(!claimed[msg.sender], "already claimed");
        require(merkleRoot != bytes32(0), "root not set");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        // OZ uses double-hashed leaves to prevent second-preimage attacks
        bytes32 doubleLeaf = keccak256(bytes.concat(leaf));
        require(MerkleProof.verify(proof, merkleRoot, doubleLeaf), "bad proof");

        claimed[msg.sender] = true;
        rootLocked = true;
        totalClaimed += amount;

        splc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice After deadline, owner sweeps unclaimed tokens to the treasury.
    function sweepUnclaimed(address to) external onlyOwner {
        require(block.timestamp > claimDeadline, "still active");
        uint256 bal = splc.balanceOf(address(this));
        splc.safeTransfer(to, bal);
        emit UnclaimedSwept(to, bal);
    }

    /// @notice Rescue unrelated tokens.
    function rescueOther(IERC20 other, address to, uint256 amount) external onlyOwner {
        require(address(other) != address(splc), "cannot drain airdrop SPLC");
        other.safeTransfer(to, amount);
    }
}
