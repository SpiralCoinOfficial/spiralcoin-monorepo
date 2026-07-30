# SpiralCoin (SPLC)

SpiralCoin is an open-source ERC-20 token and accompanying web platform exploring a community-driven trading/portfolio experience. This repository contains the smart contracts, the migration of the marketing site to IONOS hosting, and a small Web3Auth-based dapp scaffold.

> **Status: pre-launch / testnet.** The SPLC contract is currently deployed on the Ethereum **Sepolia testnet** for testing only. There is no liquidity pool, no exchange listing, and no USD price. Tokens on Sepolia have no monetary value. A Base mainnet deployment and Uniswap V2 liquidity pool are planned and scripted; see [contracts/scripts/deployAndSeedLP.js](contracts/scripts/deployAndSeedLP.js).

## Contents

| Path | What it is |
|---|---|
| [contracts/](contracts/) | Hardhat project: SpiralCoin ERC-20, deploy + LP-seed scripts |
| [w3a-quick-start/](w3a-quick-start/) | Vite + React + Web3Auth dapp scaffold |
| Root `*.html` | Static marketing / platform pages migrated to IONOS hosting |

## SpiralCoin token (SPLC)

- **Standard:** ERC-20 (OpenZeppelin 5.x), Solidity 0.8.24
- **Total supply:** 1,000,000,000 SPLC (fixed, minted once at construction)
- **Decimals:** 18
- **Allocations at construction:**
  - Premine / supply vault: 900,000,000 SPLC
  - Founder: 100,000,000 SPLC
- **Mintable / upgradable / pausable:** No. The contract has no `mint`, no owner, no admin functions. Supply is fixed forever after deployment.

### Arbitrum One deployment

| Field | Value |
|---|---|
| Network | Arbitrum One (chainId 42161) |
| Token address (UUPS proxy) | `0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C` |
| Premine holder | `0x3a1Dc8a78AE204C1EBAEe58699826f0b21c30D7F` |
| Founder holder | `0xa1766d57a3102763ED89e9a543E960B5243ef2EE` |

Explorer: <https://arbiscan.io/address/0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C>

## Planned Base mainnet deployment

The script [contracts/scripts/deployAndSeedLP.js](contracts/scripts/deployAndSeedLP.js) performs, in a single Hardhat run:

1. Deploys SpiralCoin to Base mainnet (chainId 8453).
2. Approves the Uniswap V2 router (`0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`) to spend SPLC.
3. Calls `addLiquidityETH` to create a WETH/SPLC pool with operator-specified initial amounts.

The script is **dry-run by default**. `EXECUTE_LP=1` is required to broadcast.

## Risk and compliance notes

- SpiralCoin is a self-published project. It is not registered with any securities regulator, is not audited, and is not insured.
- Trading any cryptocurrency involves risk, including total loss of capital. Past performance does not guarantee future results.
- No USD price exists for SPLC until a liquidity pool is created on a public DEX with real liquidity.
- Any forward-looking language on the SpiralCoin website refers to planned features, not delivered ones, unless explicitly stated.
- The token contract grants no rights, no revenue share, no governance power, and no claim on any underlying asset.

## License

See the LICENSE file in this repository for the licensing terms of the source code.
