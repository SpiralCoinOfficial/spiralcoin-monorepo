/**
 * Check deployer native-token balance on every mainnet configured in
 * hardhat.config.js. Use this to figure out which chain has enough to
 * actually deploy SPLC + Staking + Timelock + DAO (~0.003 ETH on L2s,
 * ~0.05+ ETH on Ethereum mainnet at typical gas).
 *
 *   $env:NODE_OPTIONS=''
 *   node contracts/scripts/check-mainnet-balances.js
 */
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { ethers } = require("ethers");

const KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!KEY) { console.error("DEPLOYER_PRIVATE_KEY missing"); process.exit(1); }
const wallet = new ethers.Wallet(KEY.startsWith("0x") ? KEY : "0x" + KEY);
const ADDR = wallet.address;

const ALCH = process.env.ALCHEMY_API_KEY || "";

const NETS = [
  { name: "Ethereum",       symbol: "ETH",   chainId: 1,     rpc: process.env.MAINNET_RPC_URL    || (ALCH && `https://eth-mainnet.g.alchemy.com/v2/${ALCH}`) || "https://cloudflare-eth.com",     explorer: "https://etherscan.io",            recDeploy: 0.05 },
  { name: "Arbitrum One",   symbol: "ETH",   chainId: 42161, rpc: process.env.ARBITRUM_RPC_URL   || (ALCH && `https://arb-mainnet.g.alchemy.com/v2/${ALCH}`) || "https://arb1.arbitrum.io/rpc",   explorer: "https://arbiscan.io",             recDeploy: 0.003 },
  { name: "Base",           symbol: "ETH",   chainId: 8453,  rpc: process.env.BASE_RPC_URL       || (ALCH && `https://base-mainnet.g.alchemy.com/v2/${ALCH}`) || "https://mainnet.base.org",     explorer: "https://basescan.org",            recDeploy: 0.003 },
  { name: "Optimism",       symbol: "ETH",   chainId: 10,    rpc: process.env.OPTIMISM_RPC_URL   || (ALCH && `https://opt-mainnet.g.alchemy.com/v2/${ALCH}`) || "https://mainnet.optimism.io",  explorer: "https://optimistic.etherscan.io", recDeploy: 0.003 },
  { name: "Polygon PoS",    symbol: "MATIC", chainId: 137,   rpc: process.env.POLYGON_RPC_URL    || (ALCH && `https://polygon-mainnet.g.alchemy.com/v2/${ALCH}`) || "https://polygon-rpc.com",   explorer: "https://polygonscan.com",         recDeploy: 5 },
  { name: "BNB Smart Chain",symbol: "BNB",   chainId: 56,    rpc: process.env.BSC_RPC_URL        || "https://bsc-dataseed.bnbchain.org",                                                            explorer: "https://bscscan.com",             recDeploy: 0.05 },
];

async function balanceOn(n) {
  try {
    const provider = new ethers.JsonRpcProvider(n.rpc, n.chainId, { staticNetwork: true });
    const wei = await provider.getBalance(ADDR);
    return ethers.formatEther(wei);
  } catch (e) {
    return `ERR: ${e.code || e.message || e}`;
  }
}

(async () => {
  console.log(`Deployer: ${ADDR}\n`);
  console.log("Network           Balance                Recommended    Status   Explorer");
  console.log("-".repeat(110));
  const results = await Promise.all(NETS.map(async n => ({ n, bal: await balanceOn(n) })));
  for (const { n, bal } of results) {
    const numeric = parseFloat(bal);
    const ok = !isNaN(numeric) && numeric >= n.recDeploy;
    const status = isNaN(numeric) ? "N/A " : (ok ? "READY" : "LOW  ");
    console.log(
      n.name.padEnd(18) +
      `${bal} ${n.symbol}`.padEnd(23) +
      `${n.recDeploy} ${n.symbol}`.padEnd(15) +
      status.padEnd(9) +
      `${n.explorer}/address/${ADDR}`
    );
  }
  console.log("\nCheapest path: deploy to Arbitrum One or Base (~$1-3 in ETH).");
})();
