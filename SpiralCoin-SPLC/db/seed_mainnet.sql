-- ============================================================
-- SpiralCoin MAINNET seed
-- Target DB: spiralcoin_mainnet (new IONOS DB — create separately)
-- Run AFTER schema.sql
-- Contract addresses are PLACEHOLDERS — replace after mainnet deploy.
-- ============================================================

SET NAMES utf8mb4;

-- Mainnets
INSERT INTO chains (chain_id, name, short_name, is_testnet, explorer_url, rpc_url) VALUES
  (1,     'Ethereum Mainnet',  'ethereum', 0, 'https://etherscan.io',     'https://eth-mainnet.g.alchemy.com/v2/'),
  (42161, 'Arbitrum One',      'arbitrum', 0, 'https://arbiscan.io',      'https://arb-mainnet.g.alchemy.com/v2/'),
  (137,   'Polygon',           'polygon',  0, 'https://polygonscan.com',  'https://polygon-mainnet.g.alchemy.com/v2/'),
  (8453,  'Base',              'base',     0, 'https://basescan.org',     'https://base-mainnet.g.alchemy.com/v2/')
ON DUPLICATE KEY UPDATE name = VALUES(name), explorer_url = VALUES(explorer_url);

-- Placeholder contract rows (update after deploy with real addresses + tx hashes)
-- DELETE these rows or UPDATE them once mainnet deploy completes.
-- INSERT INTO contracts (chain_id, kind, address, version, verified) VALUES
--   (1,     'token',    '0x0000000000000000000000000000000000000000', 'v2', 0),
--   (1,     'vault',    '0x0000000000000000000000000000000000000000', 'v2', 0),
--   (1,     'timelock', '0x0000000000000000000000000000000000000000', 'v2', 0),
--   (1,     'dao',      '0x0000000000000000000000000000000000000000', 'v2', 0);

-- Indexer cursors
INSERT INTO indexer_state (chain_id, stream, last_block) VALUES
  (1,     'transfers', 0), (1,     'votes', 0), (1,     'staking', 0),
  (42161, 'transfers', 0), (42161, 'votes', 0), (42161, 'staking', 0),
  (137,   'transfers', 0), (137,   'votes', 0), (137,   'staking', 0),
  (8453,  'transfers', 0), (8453,  'votes', 0), (8453,  'staking', 0)
ON DUPLICATE KEY UPDATE last_block = VALUES(last_block);
