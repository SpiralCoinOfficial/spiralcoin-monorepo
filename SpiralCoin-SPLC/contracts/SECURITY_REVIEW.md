# SPLC Smart-Contract Security Review (Internal Pre-Audit)

> This is **NOT** a professional audit. It's an internal pre-flight check
> before paying Hacken / PeckShield / CertiK to do the real one.
> Findings are categorized by severity. **No mainnet deploy without external audit.**

Date: 2026-05-25
Reviewer: GitHub Copilot (model-assisted)
Scope: `SpiralCoinUpgradeable`, `SPLCPresaleVesting`, `SPLCLPLock`, `SPLCPaymaster`, `SPLCTwapOracle`
Compiler target: Solidity `^0.8.24`
Library versions: OZ contracts 5.x, OZ contracts-upgradeable 5.x, LayerZero OFT v2 (upgradeable)

---

## H-1 (HIGH) — `SPLCPaymaster.processCollectedFees` ignores in-flight reserved SPLC

**File:** `contracts/SPLCPaymaster.sol` · `processCollectedFees(uint256)`

The function reads `splc.balanceOf(address(this))` and treats the entire balance as collected fees, but **does not subtract `totalReserved`** (the sum of `lockedSplc[userOpHash]` for all in-flight UserOps). Under heavy paymaster load, a triggerer could swap SPLC that is escrowed for users waiting on `postOp` refunds. The user refund would then revert or short-pay.

**Fix:** add a `uint256 public totalReserved;` and update it in `validatePaymasterUserOp` (+) and `postOp` (-). In `processCollectedFees`, compute `available = balance - totalReserved` and require `available >= lpThreshold`.

---

## M-1 (MEDIUM) — Double owner-init in `SpiralCoinUpgradeable.initialize`

**File:** `contracts/SpiralCoinUpgradeable.sol` · `initialize(...)`

```solidity
__Ownable_init(initialOwner);
...
__OFT_init(initialOwner);   // OFT also initializes Ownable internally
```

`OFTUpgradeable.__OFT_init` (LayerZero) calls `__Ownable_init(_delegate)` again. Calling `__Ownable_init` twice in the same `initialize()` is technically allowed by OZ v5 (the inner init is unguarded in `OwnableUpgradeable.__Ownable_init` since it's `internal onlyInitializing`), but the precedence is fragile. If LayerZero ever changes their init, ownership could end up pointing at zero.

**Fix:** call `__OFT_init` first, then either skip `__Ownable_init` or wrap in a `try` and assert `owner() == initialOwner` at the end of `initialize`.

---

## M-2 (MEDIUM) — `SPLCPaymaster.processCollectedFees` allows sandwiching via `minEthOut = 0`

**File:** `contracts/SPLCPaymaster.sol` · `processCollectedFees(uint256 minEthOut)`

The function is permissionless and accepts an arbitrary `minEthOut`. A MEV bot can pass `0`, sandwich the swap, and extract value. Loss is capped at one swap's worth of fees, but it's free money for the attacker.

**Fix:** require `minEthOut >= (toSwap * oraclePrice * (BPS - maxSlippageBps)) / (1e18 * BPS)`, where `maxSlippageBps` is a configurable owner-set value (default ~100 bps). Use the same oracle the paymaster already uses for gas pricing.

---

## M-3 (MEDIUM) — `SpiralCoinUpgradeable.setFeeReceivers` does not auto-mark new receivers fee-exempt

**File:** `contracts/SpiralCoinUpgradeable.sol`

When `setFeeReceivers(newTreasury, newStaking)` is called, the new addresses are *not* automatically added to `isFeeExempt`. If either ends up on the receive side of an AMM trade in the future (e.g. someone makes a pool where treasury is `to`), the tax recurses (treasury receives tax → forwarded to itself) and accounting becomes confusing.

**Fix:** auto-mark `isFeeExempt[newTreasury] = isFeeExempt[newStaking] = true` inside `setFeeReceivers`. The old addresses can stay exempt; that's not a security issue.

---

## L-1 (LOW) — `SPLCLPLock.collectFees` permanent recipient binding

**File:** `contracts/SPLCLPLock.sol`

`feeRecipient` is set at lock time and cannot be rotated. If the recipient wallet is compromised, all future fees flow to the attacker until the lock expires.

**Fix:** add `setFeeRecipient(uint256 tokenId, address newRecipient)` callable only by the original `depositor`. Restrict to *not* affect the unlockTime (no overlap with the time-lock guarantee).

---

## L-2 (LOW) — `SPLCPaymaster` uses `weth.transfer` instead of `safeTransfer`

**File:** `contracts/SPLCPaymaster.sol` · `processCollectedFees`

Canonical WETH9 returns `true` on success, so direct `.transfer` works. But inconsistency with the rest of the file (which uses `SafeERC20`) invites bugs if WETH is ever replaced with a non-standard wrapper on a future chain.

**Fix:** `IERC20(address(weth)).safeTransfer(treasury, ethGot);`

---

## L-3 (LOW) — `SPLCTwapOracle.splcPerEth` no staleness sanity check

**File:** `contracts/SPLCTwapOracle.sol`

If the pool has zero liquidity, `observe()` returns whatever the most recent observation was, even if no swap has happened in days. The paymaster then prices gas off a possibly-stale value.

**Fix:** add a `_validateObservation()` that requires `slot0().observationCardinality >= 4` and revert if not. Optionally compare TWAP to spot and bound divergence.

---

## L-4 (LOW) — `SPLCPresaleVesting.rescueOther` indirect drain vector

**File:** `contracts/SPLCPresaleVesting.sol`

If a future bridged or wrapped SPLC variant exists (e.g. a LayerZero peer-chain wrap), `rescueOther` could be used to siphon those tokens before they're meaningfully integrated. Low impact in practice — those tokens shouldn't sit in this contract anyway.

**Fix:** none required; documented behavior.

---

## L-5 (LOW) — ERC20Votes writes 3 checkpoints per AMM trade

**File:** `contracts/SpiralCoinUpgradeable.sol` · `_update`

Splitting the tax into three `super._update` calls means three checkpoint writes per AMM trade (sender × 1, treasury × 1, staking × 1, recipient × 1). Voting-power snapshots become noisy. Gas cost on the trader is real (~20k extra per trade).

**Fix:** acceptable. Alternative is to batch the fee into a single transfer to a `FeeSplitter` proxy, then have the splitter forward. Not worth the added attack surface for the gas savings.

---

## INFO — General observations

- All contracts use `^0.8.24` — overflow checks active by default.
- `nonReentrant` modifier correctly applied to all functions with external token movement.
- `Ownable` is used; transfer to a `TimelockController` is mandatory before sensitive ops.
- No `selfdestruct`, no `delegatecall`, no `assembly` (except inlined Uniswap `TickMath`).
- UUPS upgrade path is owner-gated and storage layout uses `__gap[44]` reservation.

---

## Action plan

| Severity | Item | Action |
|----------|------|--------|
| H-1 | Reserved SPLC tracking | Patch before any paymaster deploy |
| M-1 | Double owner init | Add post-init assert + reorder calls |
| M-2 | Sandwich `processCollectedFees` | Add min-out validator from oracle |
| M-3 | setFeeReceivers exempts | Auto-exempt new receivers |
| L-1 | LP lock recipient | Add depositor-only rotation |
| L-2 | WETH safeTransfer | Switch to SafeERC20 |
| L-3 | TWAP staleness | Cardinality check + spot bound |

All H/M findings should be **fixed before testnet deploy**. L findings should be fixed before mainnet audit submission.

---

## Remediation status (2026-05-25)

| ID | Status | Notes |
| --- | --- | --- |
| H-1 | Applied | `totalReserved` counter added; `processCollectedFees` uses `bal - totalReserved`. |
| M-1 | Applied | OFT re-added to `SpiralCoinUpgradeable`. Init order: `__Ownable_init` → `__OFT_init` → permit/votes; post-init `require(owner() == initialOwner)` + `require(endpoint != 0)` guards. |
| M-2 | Applied | `maxSlippageBps` (default 100) added; `minEthOut` floor enforced from oracle quote. |
| M-3 | Applied | `setFeeReceivers` now auto-marks new treasury + staking as fee-exempt. |
| L-1 | Applied | `setFeeRecipient(tokenId, newRecipient)` added, depositor-only, does not touch `unlockTime`. |
| L-2 | Applied | Paymaster uses `IERC20(address(weth)).safeTransfer(...)`. |
| L-3 | Applied | `MIN_CARDINALITY = 4` check before `observe()` in `SPLCTwapOracle`. |
| L-4 | Doc only | Behavior accepted; no code change. |
| L-5 | Doc only | Gas trade-off accepted; no code change. |

**Verification:** 121/121 tests passing as of this date (`npx hardhat test`).

External audit is still mandatory before mainnet. Status above represents internal remediation only.

---

> Trading involves risk. Past performance does not guarantee future results.
