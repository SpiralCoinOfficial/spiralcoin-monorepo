/**
 * check-balance.js — checks deployer ETH balance on Sepolia + Arb Sepolia,
 * prints status, and writes an alert line to balance-alerts.log when either
 * chain falls below the configured threshold.
 *
 * Usage (one-shot):
 *   node scripts/check-balance.js
 *
 * Cron / Task Scheduler: see scripts/setup-balance-watch.ps1 for a Windows
 * scheduled-task wrapper that runs this every 15 minutes.
 *
 * Thresholds (override via env):
 *   BALANCE_WARN_SEPOLIA_ETH     default 0.05
 *   BALANCE_WARN_ARB_SEPOLIA_ETH default 0.01
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { ADDRESS, RPC } = require('./deployer-info');

const WARN_SEPOLIA = parseFloat(process.env.BALANCE_WARN_SEPOLIA_ETH || '0.05');
const WARN_ARB     = parseFloat(process.env.BALANCE_WARN_ARB_SEPOLIA_ETH || '0.01');
const LOG_FILE     = path.join(__dirname, '..', 'balance-alerts.log');

function ts() { return new Date().toISOString(); }
function logAlert(line) {
  const row = `[${ts()}] ${line}\n`;
  fs.appendFileSync(LOG_FILE, row);
  console.log('ALERT  ' + line);
}

async function balanceOn(chainCfg) {
  if (!chainCfg.https) return { ok: false, error: 'no RPC URL configured' };
  try {
    const provider = new ethers.JsonRpcProvider(chainCfg.https);
    const wei = await provider.getBalance(ADDRESS);
    return { ok: true, wei, eth: parseFloat(ethers.formatEther(wei)) };
  } catch (e) {
    return { ok: false, error: e.shortMessage || e.message || String(e) };
  }
}

async function main() {
  console.log('=== Deployer Balance Check · ' + ts() + ' ===');
  console.log('Address: ' + ADDRESS);
  console.log('');

  const results = await Promise.all([
    balanceOn(RPC.sepolia).then(r => ({ chain: RPC.sepolia, warn: WARN_SEPOLIA, ...r })),
    balanceOn(RPC.arbSepolia).then(r => ({ chain: RPC.arbSepolia, warn: WARN_ARB, ...r })),
  ]);

  let anyLow = false;
  for (const r of results) {
    if (!r.ok) {
      console.log(r.chain.name.padEnd(18) + ' : RPC ERROR — ' + r.error);
      continue;
    }
    const flag = r.eth < r.warn ? '⚠ LOW' : 'OK   ';
    console.log(
      r.chain.name.padEnd(18) + ' : ' +
      r.eth.toFixed(6).padStart(12) + ' ETH   ' + flag +
      '   (warn < ' + r.warn + ')'
    );
    if (r.eth < r.warn) {
      anyLow = true;
      logAlert(
        r.chain.name + ' deployer balance ' + r.eth.toFixed(6) +
        ' ETH < threshold ' + r.warn + ' — top up at ' +
        r.chain.explorer + '/address/' + ADDRESS
      );
    }
  }

  console.log('\nLog file: ' + LOG_FILE);

  if (anyLow) {
    console.log('\nNext step: refill via  node scripts/faucet-helper.js');
    console.log('           or bridge: node scripts/bridge-to-arb-sepolia.js <amount>');
    process.exit(2); // non-zero so cron wrappers can detect "low" state
  }
}

main().catch(e => { console.error(e); process.exit(1); });
