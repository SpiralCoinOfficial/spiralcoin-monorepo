-- =====================================================================
-- SpiralCoin DB verification - run ONE BLOCK AT A TIME
--
-- Each block starts with USE <db>; so it does NOT matter which DB or
-- table you currently have selected in phpMyAdmin. Just open the SQL
-- tab anywhere and paste a block.
--
-- TO CHECK MAINNET (dbs15711971): use the blocks as-is below.
-- TO CHECK TESTNET (dbs15711921): change every "USE dbs15711971;" to
--                                 "USE dbs15711921;" before running.
--
-- Run ONE block at a time. phpMyAdmin only displays the LAST result
-- when multiple statements are pasted together.
-- =====================================================================


-- ===== BLOCK 1: Table count (expect 12) =====
USE dbs15711971;
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'dbs15711971';


-- ===== BLOCK 2: List all tables =====
USE dbs15711971;
SELECT table_name, table_rows, engine
FROM information_schema.tables
WHERE table_schema = 'dbs15711971'
ORDER BY table_name;


-- ===== BLOCK 3: Chains seeded? =====
USE dbs15711971;
SELECT chain_id, name, short_name, native_symbol, is_testnet
FROM dbs15711971.chains
ORDER BY chain_id;


-- ===== BLOCK 4: Contracts seeded? =====
-- Testnet (dbs15711921) should show 8 rows. Mainnet (dbs15711971) shows 0 until deploy.
USE dbs15711971;
SELECT chain_id, kind, address, version
FROM dbs15711971.contracts
ORDER BY chain_id, kind;


-- ===== BLOCK 5: Indexer cursors exist? =====
USE dbs15711971;
SELECT chain_id, stream, last_block
FROM dbs15711971.indexer_state
ORDER BY chain_id, stream;
