-- ============================================================
-- SpiralCoin TESTNET seed
-- Target DB: dbs15711921 (IONOS)
-- Run AFTER schema.sql
-- ============================================================

SET NAMES utf8mb4;

-- Chains
INSERT INTO chains (chain_id, name, short_name, is_testnet, explorer_url, rpc_url) VALUES
  (11155111, 'Ethereum Sepolia',  'sepolia',          1, 'https://sepolia.etherscan.io',  'https://eth-sepolia.g.alchemy.com/v2/'),
  (421614,   'Arbitrum Sepolia',  'arbitrum-sepolia', 1, 'https://sepolia.arbiscan.io',   'https://arb-sepolia.g.alchemy.com/v2/')
ON DUPLICATE KEY UPDATE name = VALUES(name), explorer_url = VALUES(explorer_url);

-- v2 contracts: Sepolia
INSERT INTO contracts (chain_id, kind, address, version, verified) VALUES
  (11155111, 'token',    '0xABe0130Fa0c05743D3CC6412283Bb042fce70dD0', 'v2', 1),
  (11155111, 'vault',    '0x71160B5aa3075f563E0221dF9720c04Fad64EA17', 'v2', 1),
  (11155111, 'timelock', '0x080e214ffD1c52837741e2415d86206A4bC7684b', 'v2', 1),
  (11155111, 'dao',      '0x4D7E17AE9bd65b6E4a944C88D60E560B626Abb04', 'v2', 1)
ON DUPLICATE KEY UPDATE verified = VALUES(verified);

-- v2 contracts: Arbitrum Sepolia
INSERT INTO contracts (chain_id, kind, address, version, verified) VALUES
  (421614, 'token',    '0x3B53560de911913f35b42C19F6601153855dD5ab', 'v2', 1),
  (421614, 'vault',    '0x85eeDab1423AA6F667B02a83A945F88624C0d88e', 'v2', 1),
  (421614, 'timelock', '0x2B4db09d9f8372d90644F4004cfeBfF1f3912386', 'v2', 1),
  (421614, 'dao',      '0x01De6da74330C4CBf61aECBb3888Ba08a8231de6', 'v2', 1)
ON DUPLICATE KEY UPDATE verified = VALUES(verified);

-- Indexer cursors start at 0
INSERT INTO indexer_state (chain_id, stream, last_block) VALUES
  (11155111, 'transfers', 0),
  (11155111, 'votes',     0),
  (11155111, 'staking',   0),
  (421614,   'transfers', 0),
  (421614,   'votes',     0),
  (421614,   'staking',   0)
ON DUPLICATE KEY UPDATE last_block = VALUES(last_block);
