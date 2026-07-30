# SpiralCoin database

Two MySQL databases — one for testnet indexing, one for mainnet.

| File | Purpose |
|---|---|
| `schema.sql` | All tables (chains, contracts, users, wallets, balances, transactions, staking_positions, proposals, votes, price_history, audit_log, indexer_state). Idempotent — safe to re-run. |
| `seed_testnet.sql` | Seeds Sepolia + Arb Sepolia chain rows and the 8 verified v2 contract addresses. |
| `seed_mainnet.sql` | Seeds Ethereum / Arbitrum / Polygon / Base chain rows. Contract rows commented out — uncomment and fill after mainnet deploy. |

## Import to your existing testnet DB (`dbs15711921`)

1. Open <https://phpmyadmin.us.ionos.host/db_structure.php?server=1&db=dbs15711921>
2. Click **Import** tab
3. Upload `schema.sql` → **Go**
4. Click **Import** again → upload `seed_testnet.sql` → **Go**
5. Verify in **Structure** tab — you should see 12 tables, and `contracts` should have 8 rows.

## Create the mainnet DB

You can't create a database from inside phpMyAdmin on IONOS shared hosting — you must do it in the IONOS control panel:

1. Sign in to <https://my.ionos.com> → **Hosting** → your package → **Databases**
2. Click **Create database** → name suggestion: `spiralcoin_mainnet`
3. IONOS will assign a `dbsXXXXXXXX` name and credentials — save them
4. Open phpMyAdmin → switch to the new DB
5. Import `schema.sql` → **Go**
6. Import `seed_mainnet.sql` → **Go**
7. After each mainnet deploy, run an `UPDATE contracts SET ...` or uncomment + edit the INSERT block in `seed_mainnet.sql`.

## Hooking the app up

Add to your app `.env` (NOT committed):

```
DB_HOST=db5XXXXXXXX.hosting-data.io
DB_PORT=3306
DB_NAME_TESTNET=dbs15711921
DB_NAME_MAINNET=dbsYYYYYYYY
DB_USER=dboXXXXXXXX
DB_PASS=...
```

Then point the indexer at one DB or the other based on `NODE_ENV`.
