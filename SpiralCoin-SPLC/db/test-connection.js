// SpiralCoin DB connectivity smoke test.
// Usage:
//   cp .env.example .env  (fill in passwords)
//   npm install
//   node test-connection.js                   # tests both DBs
//   SPLC_ENV=testnet node test-connection.js  # only testnet
//   SPLC_ENV=mainnet node test-connection.js  # only mainnet

const mysql = require('mysql2/promise');
require('dotenv').config();

const TARGETS = {
  testnet: {
    host: process.env.DB_HOST_TESTNET,
    port: Number(process.env.DB_PORT_TESTNET || 3306),
    user: process.env.DB_USER_TESTNET,
    password: process.env.DB_PASS_TESTNET,
    database: process.env.DB_NAME_TESTNET,
  },
  mainnet: {
    host: process.env.DB_HOST_MAINNET,
    port: Number(process.env.DB_PORT_MAINNET || 3306),
    user: process.env.DB_USER_MAINNET,
    password: process.env.DB_PASS_MAINNET,
    database: process.env.DB_NAME_MAINNET,
  },
};

const EXPECTED_TABLES = [
  'audit_log', 'balances', 'chains', 'contracts', 'indexer_state',
  'price_history', 'proposals', 'staking_positions', 'transactions',
  'users', 'votes', 'wallets',
];

async function testOne(label, cfg) {
  console.log(`\n[${label}] connecting to ${cfg.user}@${cfg.host}/${cfg.database} ...`);
  if (!cfg.host || !cfg.user || !cfg.password || !cfg.database) {
    console.log(`[${label}] SKIP - missing env vars`);
    return false;
  }
  let conn;
  try {
    conn = await mysql.createConnection(cfg);
    const [rows] = await conn.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]).sort();
    const missing = EXPECTED_TABLES.filter(t => !tables.includes(t));
    const extra = tables.filter(t => !EXPECTED_TABLES.includes(t));

    console.log(`[${label}] connected OK - ${tables.length} tables`);
    if (missing.length) console.log(`[${label}] MISSING tables: ${missing.join(', ')}`);
    if (extra.length)   console.log(`[${label}] extra tables: ${extra.join(', ')}`);

    const [chains] = await conn.query('SELECT chain_id, name FROM chains ORDER BY chain_id');
    console.log(`[${label}] chains seeded: ${chains.length}`);
    chains.forEach(c => console.log(`  - ${c.chain_id}  ${c.name}`));

    const [contracts] = await conn.query('SELECT chain_id, kind, address FROM contracts ORDER BY chain_id, kind');
    console.log(`[${label}] contracts seeded: ${contracts.length}`);
    contracts.forEach(c => console.log(`  - chain ${c.chain_id}  ${c.kind.padEnd(8)}  ${c.address}`));

    return missing.length === 0;
  } catch (err) {
    console.error(`[${label}] FAILED: ${err.code || ''} ${err.message}`);
    return false;
  } finally {
    if (conn) await conn.end();
  }
}

async function main() {
  const only = process.env.SPLC_ENV;
  const targets = only ? [only] : ['testnet', 'mainnet'];
  let allOk = true;
  for (const t of targets) {
    const ok = await testOne(t, TARGETS[t]);
    allOk = allOk && ok;
  }
  console.log(`\n${allOk ? 'ALL DBs OK' : 'One or more checks failed'}`);
  process.exit(allOk ? 0 : 1);
}

main();
