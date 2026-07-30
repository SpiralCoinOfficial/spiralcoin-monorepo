# SpiralCoin contracts

This folder contains a minimal OpenZeppelin-based ERC-20 token that mints a **premine** allocation and a **founder** allocation at deployment time.

## Quick start

```bash
cd contracts
cp .env.example .env
npm install
npm run compile
```

If your environment can’t reach `binaries.soliditylang.org`, you can still sanity-check compilation offline:

```bash
npm run compile:solcjs
```

## Deploy (Sepolia)

1. Fill in `.env`:
   - `DEPLOYER_PRIVATE_KEY`
   - `SEPOLIA_RPC_URL`
   - `SUPPLY_VAULT_WALLET` (or `PREMINE_WALLET`), `PREMINE_AMOUNT`
   - `FOUNDER_WALLET`, `FOUNDER_AMOUNT`
   - Optional consistency checks: `TOTAL_SUPPLY`, `CIRCULATING_SUPPLY`, `FOUNDER_SUPPLY`
2. Deploy:

```bash
npm run deploy:sepolia
```

The deploy script writes `deployments/<network>.json` with the deployed token address and constructor arguments.

## Verify (optional)

Fill in `ETHERSCAN_API_KEY`, then:

```bash
npm run verify:sepolia
```
