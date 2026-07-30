# SpiralCoin — Technical Addendum

Attach this to any grant program that asks for engineering / security depth.

## 1. Repository layout

```text
contracts/
├── contracts/
│   ├── SpiralCoin.sol          6497 B   ERC20 + ERC20Permit + ERC20Votes + fee router
│   ├── SpiralStakingVault.sol  3713 B   MasterChef-style accumulator
│   └── SpiralDAO.sol           4331 B   OZ Governor + TimelockController
├── scripts/
│   ├── deploy-multichain.js              Deterministic deploy across all 8 networks
│   ├── find-funded-contracts.js
│   └── _check-l2-balances.js
├── test/                                  26 passing tests (premine, AMM tax, fee split,
│                                          exemptions, edge cases, staking lifecycle,
│                                          ERC20Votes, ERC20Permit, DAO quorum)
├── deployments/sepolia.json               Live verified addresses
├── hardhat.config.js                      Sepolia / Base{+S} / Arb{+S} / OP{+S} / Polygon{+Amoy}
├── AUDIT.md                               Full internal audit
└── package.json
```

## 2. Toolchain

| Tool | Version |
| --- | --- |
| Solidity | 0.8.24 (`evmVersion: cancun`) |
| OpenZeppelin Contracts | 5.6.1 |
| Hardhat | 2.28.0 |
| `@nomicfoundation/hardhat-ethers` | 3.1.3 |
| `@nomicfoundation/hardhat-chai-matchers` | latest |
| `@nomicfoundation/hardhat-verify` | 2.1.3 (Etherscan v2 unified API) |
| `ethers` | 6.16.0 |
| `chai` | 4.5.0 |

## 3. Networks configured

`contracts/hardhat.config.js` defines all of:

| Network | Chain ID | RPC |
| --- | --- | --- |
| sepolia | 11155111 | Alchemy fallback |
| base | 8453 | Alchemy fallback |
| baseSepolia | 84532 | Alchemy fallback |
| arbitrum | 42161 | Alchemy fallback |
| arbitrumSepolia | 421614 | Alchemy fallback |
| polygon | 137 | Alchemy fallback |
| polygonAmoy | 80002 | Alchemy fallback |
| optimism | 10 | Alchemy fallback |
| optimismSepolia | 11155420 | Alchemy fallback |

Etherscan v2 unified API (single `ETHERSCAN_API_KEY`) handles verification on every
chain. `sourcify` is disabled to avoid duplicate-publish race conditions.

## 4. Security posture

Full audit lives at `contracts/AUDIT.md`. Headline:

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 2 (centralization of fee receivers — gated by 48h DAO timelock; permissionless `notifyRewardAmount` — donations only) |
| Informational | 4 (no pause; AMM pair discovery; clock mode note; P2P fee evasion) |

### Custom-code surface (audited)

The only custom logic outside of OZ primitives is **17 lines** inside `_update()`:

```solidity
function _update(address from, address to, uint256 value)
    internal override(ERC20, ERC20Votes)
{
    if (from == address(0) || to == address(0)) { super._update(from, to, value); return; }
    bool takeFee = !isFeeExempt[from] && !isFeeExempt[to] &&
                   (isAmmPair[from] || isAmmPair[to]);
    if (!takeFee) { super._update(from, to, value); return; }
    uint256 fee         = (value * FEE_BPS) / BPS_DENOMINATOR;   // FEE_BPS = 314
    uint256 treasuryCut = fee / 2;
    uint256 stakingCut  = fee - treasuryCut;
    uint256 netAmount   = value - fee;
    super._update(from, treasury,     treasuryCut);
    super._update(from, stakingVault, stakingCut);
    super._update(from, to,           netAmount);
    emit FeeTaken(from, to, treasuryCut, stakingCut);
}
```

Conservation, no double-spend, mint/burn bypass, fee loop avoidance, and vote-checkpoint
integrity invariants are all proven inline in AUDIT.md §4.

### Cryptographic integrity (verify with `Get-FileHash`)

```text
SpiralCoin.sol          6497 B   eda241ba428633ea0f4f309acadbe86364ab144ccc2a5b84321de3e04db62db2
SpiralStakingVault.sol  3713 B   15dee2f3b8e55df52f1fee8b2de330d3e5286424ac776a6d3fd2ffa3f098e1b4
SpiralDAO.sol           4331 B   635500a93210717d6825e60b2f775389a5e53e3fecb7d439c0c8432387e12d35
```

## 5. Deployment manifests

### Ethereum Sepolia (chainId 11155111)

| Contract | Address | Verified |
| --- | --- | --- |
| SpiralCoin (SPLC) | `0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0` | ✅ Etherscan v2 |
| SpiralStakingVault | `0x71160B5aa3075f563E0221dF9720c04Fad64EA17` | ✅ Etherscan v2 |
| TimelockController (48h) | `0x080e214ffD1c52837741e2415d86206A4bC7684b` | ✅ |
| SpiralDAO (Governor) | `0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04` | ✅ Etherscan v2 |

Deployer: `0x396157D2De70247dBc6895c5d835E46E6eB0BD22`
Deployed: 2026-05-23

### Arbitrum Sepolia (chainId 421614)

| Contract | Address | Verified |
| --- | --- | --- |
| SpiralCoin (SPLC) | `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C` | ✅ Arbiscan (Etherscan v2) |
| SpiralStakingVault | `0x4cEC763B2750B09272b70f040EaB6d0E6196A94D` | ✅ Arbiscan |
| TimelockController (48h) | `0x651462CD78a783a74c67e3bE9bED79b391570b98` | ✅ |
| SpiralDAO (Governor) | `0x7Cc9E93178798192f37e84449893c602235AE40F` | ✅ Arbiscan |

Deployer: `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` (founder faucet wallet on testnet)
Deployed: 2026-05-24

Premine distribution (deploy-script enforced):

- 900,000,000 SPLC → supply vault `0xc4f2b48be432fd7e4a7bd7f531571d822ca23f8a`
- 100,000,000 SPLC → founder `0xa1766d57a3102763ED89e9a543E960B5243ef2EE`

Post-deploy state:

- `SpiralCoin.owner()` = TimelockController
- `TimelockController` proposer / executor = SpiralDAO
- Deployer's `DEFAULT_ADMIN_ROLE` on Timelock = renounced

## 6. Reproduce locally

```bash
git clone https://github.com/SpiralCoinOfficial/ionos-migration
cd ionos-migration/contracts
npm install --legacy-peer-deps
npx hardhat test                 # 26 passing
npx hardhat compile              # bytecode determinism check
```

## 7. Next milestones

| Milestone | Blocker |
| --- | --- |
| L2 testnet deploys (4 chains) | Native gas on deployer (free faucets) |
| Third-party audit | Funding |
| Mainnet deploy (Base / Arb / OP / Polygon) | Funding + audit signoff |
| Initial Uniswap V3 pool | Mainnet + seed liquidity |
| `setAmmPair(pool, true)` DAO proposal | Pool address from previous step |
| Immunefi bug bounty | Funding |
