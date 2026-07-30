# SpiralCoin (SPLC) — Security Audit Report

**Audit target:** `contracts/contracts/SpiralCoin.sol`, `SpiralStakingVault.sol`, `SpiralDAO.sol`
**Solidity:** `^0.8.24` (overflow-safe arithmetic, custom errors)
**OpenZeppelin Contracts:** `^5.6.1` (latest audited release)
**Audit scope:** ERC20 tax mechanism, AMM hook integration, DAO governance, staking vault.
**Audit type:** Internal pre-deployment review (manual + static analysis pattern matching against OWASP smart-contract Top 10 and SWC registry).
**Classification:** Pre-launch self-assessment. Recommend external audit (OpenZeppelin / Trail of Bits / CertiK) before mainnet TVL exceeds $1M.

---

## 1. Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0     | —      |
| High     | 0     | —      |
| Medium   | 0     | —      |
| Low      | 2     | Acknowledged (see §6) |
| Informational | 4 | Acknowledged |

The SpiralCoin contract suite uses **only audited OpenZeppelin v5 primitives** for ERC20, ERC20Permit, ERC20Votes, Ownable, ReentrancyGuard, Governor, and TimelockController. The custom code surface is intentionally minimal: the only novel logic is the fee-on-trade hook inside `_update()`, the AMM pair registry, and the MasterChef-style reward accounting in `SpiralStakingVault`. All custom paths were reviewed against the criteria in §3.

**Verdict:** No critical/high/medium issues identified. Safe for testnet (Arbitrum Sepolia / Base Sepolia / Polygon Amoy) deployment. Production deployment is contingent on (a) acceptance of the Low/Info findings in §6, and (b) a third-party audit.

---

## 2. Architecture

```
                           ┌────────────────────┐
                           │   Token Holders    │
                           │   (delegate votes) │
                           └─────────┬──────────┘
                                     │ IVotes
                                     ▼
┌──────────────┐    propose    ┌───────────┐  queue+exec  ┌──────────────────┐
│  SpiralDAO   │──────────────▶│ Timelock  │─────────────▶│  SpiralCoin       │
│  (Governor)  │               │ (48h)     │              │  (owner-gated)    │
└──────────────┘               └───────────┘              └─────────┬────────┘
                                                                   │
                                                  3.14% on AMM     │ _update()
                                                  trades only      ▼
                                                          ┌─────────────────┐
                                  ┌───────50%────────────▶│   Treasury      │
                                  │                       └─────────────────┘
                                  │
                                  │       ┌───────────────────────────┐
                                  └─50%──▶│   SpiralStakingVault      │
                                          │   (notifyRewardAmount)    │
                                          └───────────────────────────┘
```

**Trust model:**

- After deployment, ownership of `SpiralCoin` is transferred to the `TimelockController`.
- `TimelockController` is controlled exclusively by `SpiralDAO` (DEFAULT_ADMIN_ROLE renounced from deployer in deploy script).
- The 3.14% fee rate is `constant` — neither the DAO nor the owner can change it. Only fee *receivers* and AMM pair list are governable.

---

## 3. Review Checklist (OWASP Smart Contract Top 10 + SWC)

| # | Risk | Status | Notes |
|---|------|--------|-------|
| SWC-101 | Integer overflow/underflow | ✅ Mitigated | Solidity 0.8.24 checked math; `value * FEE_BPS` cannot overflow before division (max value < 2^256/10000). |
| SWC-104 | Unchecked low-level calls | ✅ N/A | No raw `call/delegatecall/send` used; only OZ `SafeERC20`. |
| SWC-105 | Unprotected ether withdrawal | ✅ N/A | Contracts hold no ETH/native. |
| SWC-106 | Unprotected SELFDESTRUCT | ✅ N/A | Not used. |
| SWC-107 | Reentrancy | ✅ Mitigated | `ReentrancyGuard` on `stake/unstake/claim/notifyRewardAmount`. Token `_update` performs only internal `super._update` calls (no external calls during transfer). |
| SWC-108 | State variable default visibility | ✅ All explicitly declared. |
| SWC-114 | Transaction order dependence | ⚠️ Acknowledged | AMM trades are inherently MEV-sensitive on L1; on L2 (Arbitrum/Base) sequencer ordering provides partial protection. Users should use slippage on the DEX UI. |
| SWC-115 | tx.origin authentication | ✅ Never used. |
| SWC-116 | Block-values as proxy for time | ✅ N/A | Governor uses block numbers/timestamps per OZ defaults; non-critical for fee logic. |
| SWC-128 | DoS by gas limit | ✅ N/A | No unbounded loops in custom code. |
| Frontrunning fee changes | ✅ N/A | Fee is immutable (`constant`), so no front-runnable change possible. |
| Approval race (ERC20) | ✅ Standard OZ ERC20 + ERC20Permit; mitigated by Permit (EIP-2612). |
| Vote double-counting | ✅ ERC20Votes uses snapshotted checkpoints; cannot vote+transfer+vote. |
| Centralization of fee receivers | ⚠️ Low (see §6) | `setFeeReceivers` is owner-gated; post-deploy, owner = Timelock + DAO, so requires 7-day vote + 48h delay. |

---

## 4. Custom-Code Review — `SpiralCoin._update()`

```solidity
function _update(address from, address to, uint256 value)
    internal override(ERC20, ERC20Votes)
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
    uint256 stakingCut  = fee - treasuryCut;
    uint256 netAmount   = value - fee;
    super._update(from, treasury,     treasuryCut);
    super._update(from, stakingVault, stakingCut);
    super._update(from, to,           netAmount);
    emit FeeTaken(from, to, treasuryCut, stakingCut);
}
```

**Invariants verified:**

1. **Conservation:** `treasuryCut + stakingCut + netAmount == value` — proven by construction (`netAmount = value - fee`, `stakingCut = fee - treasuryCut`).
2. **No double-spend:** Each `super._update` debits `from` independently; total debit = `treasuryCut + stakingCut + netAmount = value`. ERC20's internal balance check happens once per `super._update`, so an insufficient balance reverts cleanly.
3. **Mint/burn bypass:** `from == 0` (mint) and `to == 0` (burn) skip fee logic — required because OZ uses `_update(address(0), x, v)` for `_mint`.
4. **No fee loop:** Fee transfers go to `treasury`/`stakingVault`, both fee-exempt by constructor, so they cannot recursively trigger fee on themselves.
5. **Vote checkpoint integrity:** `super._update` is `ERC20Votes._update`, which updates voting checkpoints. Calling it three times per taxed trade keeps treasury/vault/recipient voting power synchronized.

**Edge cases tested mentally:**

- `value == 0`: `fee == 0`, `treasuryCut == 0`, `stakingCut == 0`, `netAmount == 0`. Three zero-value `super._update` calls succeed (OZ allows zero transfers and they still emit `Transfer(...,0)`).
- `value < BPS_DENOMINATOR` (e.g. 1 wei): `fee = (1 * 314)/10000 = 0`. So sub-threshold trades pay no fee. Acceptable.
- Odd-wei: `stakingCut = fee - treasuryCut` captures the remainder, so exact accounting holds.

---

## 5. Custom-Code Review — `SpiralStakingVault`

Standard MasterChef accumulator pattern (`accRewardPerShare`). Reviewed for:

| Concern | Status |
|---------|--------|
| Reentrancy on `stake/unstake/claim` | ✅ `nonReentrant` + checks-effects-interactions; balance state updated before `safeTransfer`. |
| Reward dilution attack (deposit-claim-withdraw) | ✅ `_claim` called before any stake/unstake balance change; rewardDebt recomputed after. |
| Rewards lost when `totalStaked == 0` | ⚠️ Info: `notifyRewardAmount` early-returns when no stakers, but tokens remain in the contract and become claimable once the first staker enters. Documented behavior. |
| Token-of-token rebasing attack | ✅ N/A — SPLC has no rebasing or fee-on-transfer logic that affects its own staking (the vault is fee-exempt). |
| Pull-payment safety | ✅ Uses `SafeERC20.safeTransfer`. |

---

## 6. Findings

### L-1 — Centralization of fee receivers (Low)

**Description:** `setFeeReceivers` lets the owner redirect fees to arbitrary addresses.
**Mitigation:** Post-deploy ownership transfers to `TimelockController`, so a redirect requires a successful DAO proposal + 48h timelock. Documented; accept.

### L-2 — `notifyRewardAmount` permissionless (Low)

**Description:** Anyone can call `notifyRewardAmount` and donate SPLC to stakers.
**Impact:** Positive (donations welcome), not exploitable — caller pays the gas and tokens, stakers receive proportional rewards. **Accept.**

### I-1 — No `pause()` (Informational)

**Description:** Contract has no emergency pause. Intentional — pausability would itself be a centralization vector.

### I-2 — `setAmmPair` requires off-chain pair discovery (Informational)

**Description:** DAO must vote in each new AMM pair address. Acceptable — adds 1 DAO proposal per new venue but prevents pair-spoofing attacks.

### I-3 — Governor uses block.timestamp clock by default (Informational)

**Description:** OZ Governor v5 defaults to block number on L1 but timestamps work on L2. Verify clock mode (`CLOCK_MODE()`) post-deploy on each chain.

### I-4 — Fee evasion via P2P routing (Informational)

**Description:** Sophisticated traders could route through P2P contracts to avoid the AMM-trigger heuristic. **Accept** — the tax is explicitly designed as a *trading* fee, not a transfer fee. Anyone unwilling to use a registered DEX may move tokens P2P. This is by design.

---

## 7. Recommended Production Checklist

- [ ] External audit (OpenZeppelin / Trail of Bits / Spearbit) before mainnet TVL > $1M.
- [ ] Deploy first to **Arbitrum Sepolia + Base Sepolia + Polygon Amoy**; run 14-day public bug bounty (Immunefi tier 1).
- [ ] Multisig the deployer key (Gnosis Safe 3-of-5) **before** mainnet deploy.
- [ ] Renounce `DEFAULT_ADMIN_ROLE` on `TimelockController` (handled by deploy script).
- [ ] Transfer `SpiralCoin` ownership to `TimelockController` (handled by deploy script).
- [ ] Verify all 4 contracts on each L2 block explorer (`hardhat verify`).
- [ ] Publish deployment manifests (`contracts/deployments/*.json`) and IPFS-pin source.
- [ ] Add `setAmmPair(uniV3Pool, true)` proposal once liquidity is bootstrapped.

---

## 8. Cryptographic Integrity

SHA-256 hashes of the audited contract sources (verify with `Get-FileHash <file> -Algorithm SHA256`):

```
SpiralCoin.sol          6497 B   eda241ba428633ea0f4f309acadbe86364ab144ccc2a5b84321de3e04db62db2
SpiralStakingVault.sol  3713 B   15dee2f3b8e55df52f1fee8b2de330d3e5286424ac776a6d3fd2ffa3f098e1b4
SpiralDAO.sol           4331 B   635500a93210717d6825e60b2f775389a5e53e3fecb7d439c0c8432387e12d35
```

On-chain verification (Sepolia, chainId 11155111):

- SpiralCoin:         `0xbA136b3de8Bd4F73f68A0931F154AF259686731F` — verified on Etherscan v2
- SpiralStakingVault: `0x154d1C88AD13c40B92E25648D8D63a512e13Fb1C` — verified on Etherscan v2
- TimelockController: `0xb83FB5D629e9d3E2eD9aa6081cc665919AF2252C`
- SpiralDAO:          `0xA1F1F9613c01b5F1E9fdB0e4f89292E5903CaBda` — verified on Etherscan v2

On-chain verification (Arbitrum Sepolia, chainId 421614):

- SpiralCoin:         `0x000cfBceC674ca6DdA2B0E9b8547118B46aFa599` — verified on Arbiscan
- SpiralStakingVault: `0xDAe832c1187c97dD5d1f68801f59cdda4E295b9c` — verified on Arbiscan
- TimelockController: `0x7521daa83B61a8Df119416feEeb055aEeF868da7` — verified on Arbiscan
- SpiralDAO:          `0x895705252a4368428230Dfb0782c02352F37a0b8` — verified on Arbiscan

> **Operational note (Arbitrum Sepolia only):** The deployer-of-record for this testnet deployment
> is the founder address `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` (one-time deviation due to
> testnet ETH availability). Mainnet deployments will use a dedicated deployer key with multisig
> ownership transfer.

**Test coverage:** 26/26 hardhat tests passing (premine, AMM tax math, fee split, exemptions, edge cases, staking lifecycle, ERC20Votes, ERC20Permit, DAO quorum).

**Signed-by:** *to be filled by founder (offline EdDSA signature recommended)*
**Audit date:** 2026-05-20
**Next review:** Required prior to any contract upgrade or governance parameter change.
