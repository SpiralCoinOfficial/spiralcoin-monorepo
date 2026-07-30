# SpiralCoin PHP Indexer

Lightweight EVM event indexer that runs on **IONOS shared hosting** — no Node, no Docker, no VPS.

## Files

| File | Purpose |
|---|---|
| `config.example.php` | Template config. Copy to `config.php` on the host, fill secrets. **`config.php` is gitignored.** |
| `db.php` | PDO connection helper + atomic cursor claim |
| `rpc.php` | JSON-RPC client (cURL based) |
| `abi.php` | Event topic0 constants + log decoders |
| `index_transfers.php` | ERC20 Transfer event indexer |
| `cron.php` | Entry point (CLI or HTTPS-triggered) |

## Setup on IONOS

1. **Upload** the `indexer/` folder to IONOS via SFTP (e.g. to `/spiralcoin/indexer/`). Do NOT put it under the public webroot if you can avoid it — or protect with `.htaccess`.
2. **SSH/SFTP** in and copy the config template:

   ```
   cp config.example.php config.php
   ```

3. **Edit `config.php`**:
   - Fill in `password` for both DB entries
   - Replace `__ALCHEMY_KEY__` with your real Alchemy key for each chain
4. **Set up a cron job** in IONOS control panel:
   - Command: `php /home/USER/spiralcoin/indexer/cron.php`
   - Frequency: every 5 minutes
   - Set environment variable `SPLC_ENV=testnet` (run a second cron with `SPLC_ENV=mainnet`)
5. **Or** trigger via web (requires `CRON_SECRET` env set on the host):

   ```
   curl "https://www.spiralcoin.net/indexer/cron.php?env=testnet&secret=XXX"
   ```

## What it does (per run)

For each token contract in the current env:

1. Reads `indexer_state.last_block` for `(chain_id, 'transfers')`
2. Calls `eth_getLogs` for the next batch of blocks (default 1000) from Alchemy
3. Decodes each `Transfer(from, to, value)` event
4. Inserts a row into `transactions` (idempotent via `UNIQUE(chain_id, tx_hash, log_index)`)
5. Updates `balances` (subtract from sender, add to recipient, skip mint/burn zero address)
6. Advances cursor to last processed block

All in one DB transaction per batch — crash-safe, restartable.

## Reorg safety

Stays `confirmations=5` blocks behind chain head. Tune in `config.php`.

## Adding more event types

Drop a new `index_<eventname>.php` modeled on `index_transfers.php`, add its topic0 to `abi.php`, and call it from `cron.php`. The cursor system already supports multiple streams per chain (`staking`, `votes` rows are pre-seeded).
