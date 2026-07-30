// Quick balance scan across all configured EVM chains for the deployer wallet.
// Uses parallel JSON-RPC calls with a hard 8s timeout per chain.
const https = require('https');

const ADDR = '0x396157D2De70247dBc6895c5d835E46E6eB0BD22';

const CHAINS = [
  { name: 'Arbitrum One',     symbol: 'ETH',   url: 'https://arb1.arbitrum.io/rpc' },
  { name: 'Arbitrum Sepolia', symbol: 'ETH',   url: 'https://sepolia-rollup.arbitrum.io/rpc' },
  { name: 'Ethereum L1',      symbol: 'ETH',   url: 'https://ethereum-rpc.publicnode.com' },
  { name: 'Sepolia',          symbol: 'ETH',   url: 'https://ethereum-sepolia-rpc.publicnode.com' },
  { name: 'Base',             symbol: 'ETH',   url: 'https://mainnet.base.org' },
  { name: 'Base Sepolia',     symbol: 'ETH',   url: 'https://sepolia.base.org' },
  { name: 'Optimism',         symbol: 'ETH',   url: 'https://mainnet.optimism.io' },
  { name: 'Polygon',          symbol: 'MATIC', url: 'https://polygon-rpc.com' },
  { name: 'BSC',              symbol: 'BNB',   url: 'https://bsc-rpc.publicnode.com' },
];

function rpcCall(url, method, params, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const u = new URL(url);
    const req = https.request({
      method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
      port: u.port || 443,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function weiToEth(hex) {
  if (!hex || hex === '0x') return '0';
  const wei = BigInt(hex);
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').slice(0, 6);
  return `${whole}.${fracStr}`;
}

(async () => {
  console.log(`\nDeployer: ${ADDR}\n${'='.repeat(70)}`);
  const results = await Promise.all(CHAINS.map(async (c) => {
    try {
      const [bal, nonce] = await Promise.all([
        rpcCall(c.url, 'eth_getBalance', [ADDR, 'latest']),
        rpcCall(c.url, 'eth_getTransactionCount', [ADDR, 'latest']),
      ]);
      if (bal.error) return { ...c, eth: 'ERR', nonce: '-' };
      return { ...c, eth: weiToEth(bal.result), nonce: parseInt(nonce.result || '0x0', 16) };
    } catch (e) {
      return { ...c, eth: 'timeout', nonce: '-' };
    }
  }));
  let totalMain = 0;
  for (const r of results) {
    const tag = r.name.includes('Sepolia') ? '(test)' : '';
    console.log(`${r.name.padEnd(20)} ${r.eth.padStart(14)} ${r.symbol.padEnd(6)} nonce=${String(r.nonce).padEnd(4)} ${tag}`);
    if (!r.name.includes('Sepolia') && r.eth !== 'timeout' && r.eth !== 'ERR') {
      totalMain += parseFloat(r.eth);
    }
  }
  console.log('='.repeat(70));
  console.log(`Mainnet native total: ~${totalMain.toFixed(6)} (mixed symbols)`);
  console.log(`Nonce > 0 means the wallet has sent at least one tx on that chain.`);
})();
