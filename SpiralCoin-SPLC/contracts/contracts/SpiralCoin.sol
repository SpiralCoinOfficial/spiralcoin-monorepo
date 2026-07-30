// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SpiralCoin (SPLC)
 * @notice ERC20 governance token with a hard-coded 3.14% protocol fee
 *         applied to trades against registered AMM pairs (buys/sells only).
 *         Wallet-to-wallet transfers are NEVER taxed.
 *
 *  - Tax is split: 50% to treasury (utility / buybacks / liquidity),
 *                  50% to staking/rewards vault.
 *  - Tax is IMMUTABLE (314 bps = 3.14%). No setter exists — no governance,
 *    no owner, no upgrade path can raise it. Only `setFeeReceivers`,
 *    `setAmmPair`, and `setFeeExempt` are mutable (owner-gated, event-logged).
 *  - Includes ERC20Permit (gasless approvals) + ERC20Votes (DAO snapshot
 *    voting). Designed for L2 deployment (Arbitrum / Base / Polygon).
 */
contract SpiralCoin is ERC20, ERC20Permit, ERC20Votes, Ownable, ReentrancyGuard {
    // ── Immutable tax (cannot be changed by anyone, ever) ────────────────
    uint256 public constant FEE_BPS = 314;          // 3.14%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ── Fee receivers ────────────────────────────────────────────────────
    address public treasury;     // 50% of fee — utility / buybacks
    address public stakingVault; // 50% of fee — staking rewards

    /// @dev AMM pair addresses that trigger the fee (Uniswap v2/v3, Camelot,
    ///      QuickSwap, Aerodrome, etc.). Transfers TO or FROM these addresses
    ///      are taxed; wallet-to-wallet transfers are not.
    mapping(address => bool) public isAmmPair;

    /// @dev Addresses exempt from fee (treasury, DAO, vesting contracts).
    mapping(address => bool) public isFeeExempt;

    // ── Events ───────────────────────────────────────────────────────────
    event FeeTaken(address indexed from, address indexed to, uint256 treasuryAmount, uint256 stakingAmount);
    event AmmPairUpdated(address indexed pair, bool isPair);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event FeeReceiversUpdated(address indexed treasury, address indexed stakingVault);

    constructor(
        address premineWallet,
        uint256 premineAmount,
        address founderWallet,
        uint256 founderAmount,
        address treasury_,
        address stakingVault_
    )
        ERC20("SpiralCoin", "SPLC")
        ERC20Permit("SpiralCoin")
        Ownable(msg.sender)
    {
        require(premineWallet != address(0), "premine wallet");
        require(founderWallet != address(0), "founder wallet");
        require(treasury_ != address(0), "treasury");
        require(stakingVault_ != address(0), "staking vault");
        require(premineAmount > 0 || founderAmount > 0, "supply");

        treasury = treasury_;
        stakingVault = stakingVault_;

        // Exempt initial distribution wallets so liquidity seeding and
        // founder allocation don't burn 3.14% to themselves.
        isFeeExempt[msg.sender] = true;
        isFeeExempt[premineWallet] = true;
        isFeeExempt[founderWallet] = true;
        isFeeExempt[treasury_] = true;
        isFeeExempt[stakingVault_] = true;

        if (premineAmount > 0) {
            _mint(premineWallet, premineAmount);
        }
        if (founderAmount > 0) {
            _mint(founderWallet, founderAmount);
        }

        emit FeeReceiversUpdated(treasury_, stakingVault_);
    }

    // ── Owner config (no setter for FEE_BPS — it is a `constant`) ────────
    function setAmmPair(address pair, bool isPair_) external onlyOwner {
        require(pair != address(0), "zero pair");
        isAmmPair[pair] = isPair_;
        emit AmmPairUpdated(pair, isPair_);
    }

    function setFeeExempt(address account, bool exempt) external onlyOwner {
        require(account != address(0), "zero acct");
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    function setFeeReceivers(address treasury_, address stakingVault_) external onlyOwner {
        require(treasury_ != address(0) && stakingVault_ != address(0), "zero receiver");
        treasury = treasury_;
        stakingVault = stakingVault_;
        emit FeeReceiversUpdated(treasury_, stakingVault_);
    }

    // ── Tax logic — only on AMM trades, never on P2P transfers ──────────
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        // Mint / burn paths skip fee logic
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        bool takeFee = !isFeeExempt[from]
                    && !isFeeExempt[to]
                    && (isAmmPair[from] || isAmmPair[to]);

        if (!takeFee) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / BPS_DENOMINATOR;
        uint256 treasuryCut = fee / 2;
        uint256 stakingCut  = fee - treasuryCut; // captures odd-wei rounding
        uint256 netAmount   = value - fee;

        super._update(from, treasury,     treasuryCut);
        super._update(from, stakingVault, stakingCut);
        super._update(from, to,           netAmount);

        emit FeeTaken(from, to, treasuryCut, stakingCut);
    }

    // ── Multiple inheritance disambiguation ──────────────────────────────
    function nonces(address owner_)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner_);
    }

    // ── IERC6372: switch governance clock from blocks to timestamps ─────
    // Chain-agnostic voting windows (works the same on L1 and any L2).
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }
}
