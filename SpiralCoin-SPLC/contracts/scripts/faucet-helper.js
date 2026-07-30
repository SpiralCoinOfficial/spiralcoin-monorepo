/**
 * faucet-helper.js — opens every legitimate Sepolia (and a few Arb Sepolia)
 * faucet in your default browser, with the deployer address pre-filled where
 * the faucet supports a URL parameter. The rest you'll complete with a captcha
 * or GitHub login — that's the faucet's anti-abuse policy, not something we
 * should script around.
 *
 * Run:  node scripts/faucet-helper.js
 *
 * Faucet abuse warning: each of these has its own per-address / per-IP / per-day
 * limits. Hitting them all in one shot is fine for an honest dev; hitting them
 * repeatedly on a cron is what gets you blocked.
 */
const { exec } = require('child_process');
const os = require('os');
const { ADDRESS } = require('./deployer-info');

// Many faucets do not accept URL-prefilled addresses. We open them anyway and
// copy the address to clipboard so you can paste with Ctrl+V.
const FAUCETS = [
  // --- Sepolia ETH faucets ---
  { name: 'Alchemy Sepolia Faucet',     url: 'https://www.alchemy.com/faucets/ethereum-sepolia',                       prefill: false, notes: 'Needs Alchemy login' },
  { name: 'Infura / MetaMask Faucet',   url: 'https://www.infura.io/faucet/sepolia',                                   prefill: false, notes: 'Needs Infura login' },
  { name: 'QuickNode Sepolia Faucet',   url: 'https://faucet.quicknode.com/ethereum/sepolia',                          prefill: false, notes: 'Needs QuickNode account' },
  { name: 'Google Cloud Web3 Faucet',   url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia',     prefill: false, notes: 'Needs Google login' },
  { name: 'Chainlink Sepolia Faucet',   url: 'https://faucets.chain.link/sepolia',                                     prefill: false, notes: 'Needs GitHub login' },
  { name: 'PoW Faucet (sepolia-faucet)',url: 'https://sepolia-faucet.pk910.de/',                                       prefill: false, notes: 'Mine to claim (CPU PoW)' },
  { name: 'Stakely Sepolia Faucet',     url: 'https://stakely.io/en/faucet/ethereum-sepolia-eth',                      prefill: false, notes: 'Captcha' },

  // --- Arbitrum Sepolia ETH faucets ---
  { name: 'Alchemy Arb Sepolia Faucet', url: 'https://www.alchemy.com/faucets/arbitrum-sepolia',                       prefill: false, notes: 'Needs Alchemy login' },
  { name: 'QuickNode Arb Sepolia',      url: 'https://faucet.quicknode.com/arbitrum/sepolia',                          prefill: false, notes: 'Needs QuickNode account' },
  { name: 'Chainlink Arb Sepolia',      url: 'https://faucets.chain.link/arbitrum-sepolia',                            prefill: false, notes: 'Needs GitHub login' },
];

function openUrl(url) {
  const platform = os.platform();
  if (platform === 'win32') {
    // PowerShell-safe: Start-Process handles URL with no extra quoting issues.
    exec(`powershell -NoProfile -Command "Start-Process '${url.replace(/'/g, "''")}'"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function copyToClipboard(text) {
  return new Promise((resolve) => {
    const platform = os.platform();
    let cmd, child;
    if (platform === 'win32') {
      child = exec('clip');
    } else if (platform === 'darwin') {
      child = exec('pbcopy');
    } else {
      child = exec('xclip -selection clipboard');
    }
    child.on('exit', resolve);
    child.on('error', resolve);
    child.stdin.end(text);
  });
}

async function main() {
  console.log('\n=== SpiralCoin · Sepolia / Arb Sepolia Faucet Helper ===');
  console.log('Deployer address: ' + ADDRESS);
  console.log('(copied to clipboard — paste with Ctrl+V into each faucet)\n');

  await copyToClipboard(ADDRESS);

  for (const f of FAUCETS) {
    console.log(' → opening: ' + f.name.padEnd(34) + ' [' + f.notes + ']');
    openUrl(f.url);
    // Small stagger so the browser doesn't drop tabs.
    await new Promise(r => setTimeout(r, 350));
  }

  console.log('\nDone. Switch to your browser and complete each faucet\'s captcha/auth.');
  console.log('Run `node scripts/check-balance.js` afterward to confirm funding.');
  console.log('\nReminder: Sepolia / Arb Sepolia ETH has no monetary value. Do not');
  console.log('attempt to sell or trade it.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
