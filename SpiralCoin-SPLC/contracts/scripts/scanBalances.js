/**
 * scanBalances.js
 *
 * Read-only multi-chain native + SPLC balance scan for the founder/deployer wallet.
 * No private key needed — uses public RPCs (Alchemy if ALCHEMY_API_KEY present).
 *
 * Usage:
 *   node scripts/scanBalances.js                  # uses FOUNDER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY address
 *   node scripts/scanBalances.js 0xabc...         # scan a specific address
 *
 * Output: console table + writes ../_balance_scan.json at repo root.
 */
"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// ---- chain registry ----------------------------------------------------------
const ALCHEMY = process.env.ALCHEMY_API_KEY;
function alchemy(slug, fallback) {
  return ALCHEMY ? `https://${slug}.g.alchemy.com/v2/${ALCHEMY}` : fallback;
}

const CHAINS = [
  // mainnets
  { name: "ethereum",        kind: "mainnet", native: "ETH",  rpc: process.env.MAINNET_RPC_URL        || alchemy("eth-mainnet",      "https://cloudflare-eth.com"),         explorer: "etherscan.io" },
  { name: "arbitrum",        kind: "mainnet", native: "ETH",  rpc: process.env.ARBITRUM_RPC_URL       || alchemy("arb-mainnet",      "https://arb1.arbitrum.io/rpc"),       explorer: "arbiscan.io" },
  { name: "base",            kind: "mainnet", native: "ETH",  rpc: process.env.BASE_RPC_URL           || alchemy("base-mainnet",     "https://mainnet.base.org"),           explorer: "basescan.org" },
  { name: "optimism",        kind: "mainnet", native: "ETH",  rpc: process.env.OPTIMISM_RPC_URL       || alchemy("opt-mainnet",      "https://mainnet.optimism.io"),        explorer: "optimistic.etherscan.io" },
  { name: "polygon",         kind: "mainnet", native: "POL",  rpc: process.env.POLYGON_RPC_URL        || alchemy("polygon-mainnet",  "https://polygon-rpc.com"),            explorer: "polygonscan.com" },
  { name: "bsc",             kind: "mainnet", native: "BNB",  rpc: process.env.BSC_RPC_URL            || "https://bsc-dataseed.bnbchain.org",                                explorer: "bscscan.com" },
  // testnets
  { name: "sepolia",         kind: "testnet", native: "ETH",  rpc: process.env.SEPOLIA_RPC_URL        || alchemy("eth-sepolia",      "https://rpc.sepolia.org"),            explorer: "sepolia.etherscan.io" },
  { name: "arbitrumSepolia", kind: "testnet", native: "ETH",  rpc: process.env.ARB_SEPOLIA_RPC_URL    || alchemy("arb-sepolia",      "https://sepolia-rollup.arbitrum.io/rpc"), explorer: "sepolia.arbiscan.io" },
  { name: "baseSepolia",     kind: "testnet", native: "ETH",  rpc: process.env.BASE_SEPOLIA_RPC_URL   || alchemy("base-sepolia",     "https://sepolia.base.org"),           explorer: "sepolia.basescan.org" },
  { name: "optimismSepolia", kind: "testnet", native: "ETH",  rpc: process.env.OPTIMISM_SEPOLIA_RPC_URL || alchemy("opt-sepolia",    "https://sepolia.optimism.io"),        explorer: "sepolia-optimism.etherscan.io" },
  { name: "polygonAmoy",     kind: "testnet", native: "POL",  rpc: process.env.POLYGON_AMOY_RPC_URL   || alchemy("polygon-amoy",     "https://rpc-amoy.polygon.technology"), explorer: "amoy.polygonscan.com" },
  { name: "bscTestnet",      kind: "testnet", native: "tBNB", rpc: process.env.BSC_TESTNET_RPC_URL    || "https://bsc-testnet-rpc.publicnode.com",                              explorer: "testnet.bscscan.com" },
];

// ---- address resolution ------------------------------------------------------
function deriveAddress() {
  if (process.argv[2] && ethers.isAddress(process.argv[2])) return ethers.getAddress(process.argv[2]);
  const key = process.env.FOUNDER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("No address arg and no FOUNDER_PRIVATE_KEY/DEPLOYER_PRIVATE_KEY in env");
  const norm = key.startsWith("0x") ? key : `0x${key}`;
  return new ethers.Wallet(norm).address;
}

// ---- SPLC deployment lookup --------------------------------------------------
function loadSplcAddress(network) {
  const flatPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  const dirPath  = path.join(__dirname, "..", "deployments", network, "SpiralCoinUpgradeable.json");
  try {
    if (fs.existsSync(flatPath)) {
      const j = JSON.parse(fs.readFileSync(flatPath, "utf8"));
      return j.contracts?.SpiralCoinUpgradeable || j.SpiralCoinUpgradeable || null;
    }
    if (fs.existsSync(dirPath)) {
      const j = JSON.parse(fs.readFileSync(dirPath, "utf8"));
      return j.address || null;
    }
  } catch (_) {}
  return null;
}

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

// ---- per-chain probe ---------------------------------------------------------
async function probe(chain, address) {
  const out = { chain: chain.name, kind: chain.kind, native: chain.native, balance: null, balanceWei: null, splc: null, splcAddr: null, error: null };
  try {
    const provider = new ethers.JsonRpcProvider(chain.rpc, undefined, { staticNetwork: true });
    const wei = await Promise.race([
      provider.getBalance(address),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    out.balanceWei = wei.toString();
    out.balance = Number(ethers.formatEther(wei));

    const splcAddr = loadSplcAddress(chain.name);
    if (splcAddr) {
      out.splcAddr = splcAddr;
      try {
        const splc = new ethers.Contract(splcAddr, ERC20_ABI, provider);
        const [bal, dec] = await Promise.all([splc.balanceOf(address), splc.decimals().catch(() => 18)]);
        out.splc = Number(ethers.formatUnits(bal, dec));
      } catch (e) { out.splc = `err: ${e.shortMessage || e.message}`; }
    }
  } catch (e) {
    out.error = e.shortMessage || e.message;
  }
  return out;
}

(async () => {
  const address = deriveAddress();
  console.log(`\n>> scanning ${address}\n`);

  const results = await Promise.all(CHAINS.map((c) => probe(c, address)));

  // pretty print
  const rows = results.map((r) => ({
    chain: r.chain,
    kind: r.kind,
    native: r.native,
    balance: r.error ? `ERR` : (r.balance ?? 0).toFixed(6),
    SPLC: r.splcAddr ? (typeof r.splc === "number" ? r.splc.toFixed(2) : r.splc) : "—",
    notes: r.error || (r.balance > 0 ? "funded" : "empty"),
  }));
  console.table(rows);

  // funding summary
  const fundedTestnets = results.filter((r) => r.kind === "testnet" && r.balance > 0.001).map((r) => r.chain);
  const fundedMainnets = results.filter((r) => r.kind === "mainnet" && r.balance > 0.0001).map((r) => r.chain);
  const splcChains     = results.filter((r) => typeof r.splc === "number" && r.splc > 0).map((r) => `${r.chain}=${r.splc.toFixed(2)}`);

  console.log("\n── summary ──");
  console.log(`testnets funded: ${fundedTestnets.length ? fundedTestnets.join(", ") : "none"}`);
  console.log(`mainnets funded: ${fundedMainnets.length ? fundedMainnets.join(", ") : "none"}`);
  console.log(`SPLC holdings : ${splcChains.length ? splcChains.join(", ") : "none"}`);

  const outFile = path.join(__dirname, "..", "..", "_balance_scan.json");
  fs.writeFileSync(outFile, JSON.stringify({ address, scannedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nfull report: ${outFile}`);
})().catch((e) => { console.error(e); process.exit(1); });
