# Deployer Key Rotation — REQUIRED BEFORE MAINNET

## Why this matters

The current `.env` in this repo contains a **plaintext private key** for
deployer address `0x396157D2De70247dBc6895c5d835E46E6eB0BD22`. Even though
the file is gitignored, the key has been:

- Sitting on disk in cleartext for the entire dev cycle
- Visible in editor windows
- Visible in PowerShell history (`Get-Content .env`)
- Visible in any AI assistant context that read the file
- Visible to any process running under your Windows user

**Treat this key as fully compromised for mainnet purposes.** Use it for
testnet only. Generate a fresh key for any deploy that will hold real
value.

## What to do

### Step 1 — Generate a fresh deployer key (hardware wallet preferred)

**Option A: Ledger / Trezor (recommended)**

1. Plug in your Ledger
2. Open the Ethereum app
3. In MetaMask, connect Ledger and add a new account
4. Note the address (e.g. `0xABCD...`)
5. **Never export the private key.** Hardhat can sign via `hardhat-deploy` + `ledger` plugin.

**Option B: Fresh software key (if no hardware wallet)**

```powershell
# Generate offline, on an air-gapped machine ideally
node -e "const w = require('ethers').Wallet.createRandom(); console.log({address: w.address, key: w.privateKey, mnemonic: w.mnemonic.phrase})"
```

Save the mnemonic to paper. Do not photograph it. Do not type it into any cloud-synced app.

### Step 2 — Fund it with minimal gas

Send only the gas needed for that day's deployment (~$50 worth of ETH per chain). Refill as needed. Never let the deployer hold more than a few hundred dollars.

### Step 3 — Migrate ownership AFTER deploy

Right after `deployUpgradeable.js`, call:

```javascript
await splc.transferOwnership(timelockAddress);
```

…where `timelockAddress` is your 48-hour `TimelockController`. From that point, the deployer key can be discarded — it has no remaining authority.

### Step 4 — Burn the old key (after testnet wrap-up)

When you're done with the testnet phase, send any remaining ETH out of `0x396157...` to your treasury, then never use that address again. Document the burn in the repo: `git commit -m "burn old testnet deployer 0x396157..."`.

## Hardhat config snippet for Ledger signing

Add to `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-ledger");

module.exports = {
  networks: {
    arbitrum: {
      url: process.env.RPC_ARBITRUM,
      ledgerAccounts: [process.env.DEPLOYER_LEDGER_ADDRESS], // address only
    },
    // ... same for each mainnet
  },
};
```

Install: `npm install --save-dev @nomicfoundation/hardhat-ledger`

## What stays in `.env` for the rotated setup

- `DEPLOYER_ADDRESS` — public address (no key, hardware-wallet signs)
- All RPC and explorer API keys (these are not critical-loss material; rotate periodically)
- Tokenomics and wallet config values
- **NEVER:** founder, treasury, or signer private keys

## Verify before deploy

```powershell
# Should print empty for production
Select-String -Path .env -Pattern "PRIVATE_KEY=0x" | Select-String -NotMatch "=$"
```

Any hit on the above means you still have a plaintext key in the file. Move it out before deploying.

---

> Trading involves risk. Past performance does not guarantee future results.
