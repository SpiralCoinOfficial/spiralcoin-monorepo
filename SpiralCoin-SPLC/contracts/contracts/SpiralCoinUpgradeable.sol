// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {NoncesUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {OFTUpgradeable} from "@layerzerolabs/oft-evm-upgradeable/contracts/oft/OFTUpgradeable.sol";

/**
 * @title SpiralCoinUpgradeable (SPLC)
 * @notice Upgradeable ERC-20 with immutable 3.14% AMM tax,
 *         ERC20Votes governance, ERC20Permit gasless approvals,
 *         and LayerZero V2 OFT cross-chain transfers.
 * @dev OFTUpgradeable already extends ERC20Upgradeable. ERC20PermitUpgradeable
 *      and ERC20VotesUpgradeable are layered via their own ERC20 base; Solidity
 *      C3-linearizes the shared ERC20Upgradeable parent.
 */
contract SpiralCoinUpgradeable is
    Initializable,
    OFTUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    UUPSUpgradeable
{
    // ── Immutable tax ────────────────────────────────────────────────────────
    uint256 public constant FEE_BPS = 314;          // 3.14%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ── Storage (append-only on upgrades!) ───────────────────────────────────────
    address public treasury;
    address public stakingVault;
    mapping(address => bool) public isAmmPair;
    mapping(address => bool) public isFeeExempt;

    // Reserved storage slots for future upgrades. NEVER reduce this.
    uint256[44] private __gap;

    // ── Events ───────────────────────────────────────────────────────────────────
    event FeeTaken(address indexed from, address indexed to, uint256 treasuryAmount, uint256 stakingAmount);
    event AmmPairUpdated(address indexed pair, bool isPair);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event FeeReceiversUpdated(address indexed treasury, address indexed stakingVault);

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    constructor(address _lzEndpoint) OFTUpgradeable(_lzEndpoint) {
        _disableInitializers();
    }

    /**
     * @notice Initialize the proxy. Called ONCE by the deployer.
     * @param premineWallet   receives the circulating premine
     * @param premineAmount   wei amount of premine (use 0 on non-origin chains)
     * @param founderWallet   receives founder allocation
     * @param founderAmount   wei amount of founder allocation (use 0 on non-origin chains)
     * @param treasury_       50% tax destination
     * @param stakingVault_   50% tax destination
     * @param initialOwner    proxy admin AND LayerZero delegate
     *                        (transfer to DAO Timelock post-deploy via
     *                         transferOwnership + endpoint.setDelegate)
     */
    // slither-disable-next-line reentrancy-no-eth
    function initialize(
        address premineWallet,
        uint256 premineAmount,
        address founderWallet,
        uint256 founderAmount,
        address treasury_,
        address stakingVault_,
        address initialOwner
    ) external initializer {
        require(treasury_ != address(0), "treasury");
        require(stakingVault_ != address(0), "staking vault");
        require(initialOwner != address(0), "owner");

        // LayerZero's OAppCoreUpgradeable intentionally does NOT call
        // __Ownable_init (source comment: "Ownable is not initialized here
        // on purpose. It should be initialized in the child contract.").
        // We must call it explicitly so owner() is set before the M-1 assert.
        __Ownable_init(initialOwner);

        // __OFT_init calls __ERC20_init then __OFTCore_init which calls
        // __OApp_init -> __OAppCore_init_unchained -> endpoint.setDelegate().
        // endpoint.setDelegate() is an external call; any state write after
        // this point would normally trigger Slither's reentrancy-no-eth
        // detector. The slither-disable-next-line above suppresses this:
        // (a) the `initializer` modifier prevents re-entry into initialize(),
        // (b) the trusted LayerZero endpoint does not call back into this
        //     contract during setDelegate.
        __OFT_init("SpiralCoin", "SPLC", initialOwner);
        __ERC20Permit_init("SpiralCoin");
        __ERC20Votes_init();
        // Note: UUPSUpgradeable in OZ v5 has no __UUPSUpgradeable_init().

        // M-1 post-init invariants.
        require(owner() == initialOwner, "M-1: owner init mismatch");
        require(address(endpoint) != address(0), "M-1: endpoint not set");

        treasury = treasury_;
        stakingVault = stakingVault_;

        isFeeExempt[initialOwner] = true;
        isFeeExempt[treasury_] = true;
        isFeeExempt[stakingVault_] = true;

        if (premineWallet != address(0)) {
            isFeeExempt[premineWallet] = true;
            if (premineAmount > 0) _mint(premineWallet, premineAmount);
        }
        if (founderWallet != address(0)) {
            isFeeExempt[founderWallet] = true;
            if (founderAmount > 0) _mint(founderWallet, founderAmount);
        }

        emit FeeReceiversUpdated(treasury_, stakingVault_);
    }

    // ── Owner-gated config ─────────────────────────────────────────────────
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
        // M-3 fix: auto-exempt new receivers from tax
        isFeeExempt[treasury_] = true;
        isFeeExempt[stakingVault_] = true;
        emit FeeReceiversUpdated(treasury_, stakingVault_);
    }

    // ── Tax logic — only on AMM trades, never on P2P ───────────────────────
    // OFT _debit/_credit go through _burn/_mint → _update with from/to == 0,
    // so cross-chain transfers correctly bypass the AMM tax.
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
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
        uint256 stakingCut = fee - treasuryCut;
        uint256 netAmount = value - fee;

        super._update(from, treasury, treasuryCut);
        super._update(from, stakingVault, stakingCut);
        super._update(from, to, netAmount);

        emit FeeTaken(from, to, treasuryCut, stakingCut);
    }

    // ── Multiple inheritance disambiguation ──────────────────────────────────
    function nonces(address owner_)
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner_);
    }

    // ── IERC6372: timestamp-based governance clock ────────────────────────
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // ── UUPS authorization (owner only — transfer to DAO Timelock) ────────
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
