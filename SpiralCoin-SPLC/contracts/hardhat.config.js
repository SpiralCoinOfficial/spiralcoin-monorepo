require("dotenv").config();

// --- Node 22+/24 compat shim ---------------------------------------------
// `ethereumjs-util@7.1.5` (transitive dep of @openzeppelin/upgrades-core@1.44.2)
// returns a plain Uint8Array from keccak256 on Node v22+, instead of a Buffer.
// Downstream code does `hash.toString('hex')` which on Uint8Array produces
// comma-separated bytes ("54,8,148,..."), then BigInt() throws.
// Patch keccak/keccak256 to always return a Buffer. Idempotent + safe.
try {
  const hash = require("ethereumjs-util/dist/hash");
  const wrap = (fn) => (...args) => {
    const out = fn(...args);
    return Buffer.isBuffer(out) ? out : Buffer.from(out);
  };
  if (hash.keccak) hash.keccak = wrap(hash.keccak);
  if (hash.keccak256) hash.keccak256 = wrap(hash.keccak256);
} catch (_) { /* package not present yet */ }
// -------------------------------------------------------------------------

require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
// Loaded only when package is installed (D: drive / NTFS volume required for npm install).
try { require("@openzeppelin/hardhat-upgrades"); } catch (_) { /* not installed yet */ }

const KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;
function normalize(k) {
  if (!k || !KEY_RE.test(k)) return null;
  return k.startsWith("0x") ? k : `0x${k}`;
}
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const FOUNDER_PRIVATE_KEY = process.env.FOUNDER_PRIVATE_KEY;
const normalizedKey = normalize(DEPLOYER_PRIVATE_KEY);
const normalizedFounderKey = normalize(FOUNDER_PRIVATE_KEY);
// Testnets use FOUNDER_PRIVATE_KEY if set (founder wallet funded via faucet),
// otherwise fall back to the standard deployer key. Mainnets always use deployer key.
const testnetKey = normalizedFounderKey || normalizedKey;
const arbSepoliaKey = testnetKey; // back-compat alias

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun", // required by OZ v5.6 (uses mcopy opcode)
    },
  },
  networks: {
    // ── Local / fork ──────────────────────────────────────────────────────
    // When FORK_RPC_URL is set, the in-process Hardhat network forks that
    // chain's live state — letting us rehearse the real mainnet deploy with
    // zero real ETH spent. Without it, behaves as a normal local network
    // (so the test suite is unaffected). Used by the mainnet-dryrun workflow.
    //
    // FIX: use object spread so 'forking' key is absent (not undefined)
    // when FORK_RPC_URL is unset. Hardhat validates with the `in` operator;
    // forking:undefined (key present, value undefined) would cause a
    // TypeError when the network starts: "Cannot read properties of undefined"
    hardhat: {
      chainId: Number(process.env.FORK_CHAIN_ID || 31337),
      ...(process.env.FORK_RPC_URL ? {
        forking: {
          url: process.env.FORK_RPC_URL,
          ...(process.env.FORK_BLOCK_NUMBER ? {
            blockNumber: Number(process.env.FORK_BLOCK_NUMBER),
          } : {}),
        },
      } : {}),
    },

    // ── L1 ───────────────────────────────────────────────────────────────────
    mainnet: {
      url: process.env.MAINNET_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://cloudflare-eth.com"),
      chainId: 1,
      accounts: normalizedKey ? [normalizedKey] : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_INFURA_RPC_URL || "",
      accounts: testnetKey ? [testnetKey] : [],
    },

    // ── BNB Smart Chain ────────────────────────────────────────────
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org",
      chainId: 56,
      accounts: normalizedKey ? [normalizedKey] : [],
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com",
      chainId: 97,
      accounts: testnetKey ? [testnetKey] : [],
    },

    // ── Base (OP Stack L2) ───────────────────────────────────────────
    base: {
      url: process.env.BASE_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://mainnet.base.org"),
      chainId: 8453,
      accounts: normalizedKey ? [normalizedKey] : [],
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://sepolia.base.org"),
      chainId: 84532,
      accounts: testnetKey ? [testnetKey] : [],
    },

    // ── Arbitrum (Nitro L2 rollup) ──────────────────────────────────────
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://arb1.arbitrum.io/rpc"),
      chainId: 42161,
      accounts: normalizedKey ? [normalizedKey] : [],
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://sepolia-rollup.arbitrum.io/rpc"),
      chainId: 421614,
      accounts: arbSepoliaKey ? [arbSepoliaKey] : [],
    },

    // ── Polygon PoS ───────────────────────────────────────────────────────
    polygon: {
      url: process.env.POLYGON_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://polygon-rpc.com"),
      chainId: 137,
      accounts: normalizedKey ? [normalizedKey] : [],
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://rpc-amoy.polygon.technology"),
      chainId: 80002,
      accounts: testnetKey ? [testnetKey] : [],
    },

    // ── Optimism (OP Stack L2) ───────────────────────────────────────
    optimism: {
      url: process.env.OPTIMISM_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://mainnet.optimism.io"),
      chainId: 10,
      accounts: normalizedKey ? [normalizedKey] : [],
    },
    optimismSepolia: {
      url: process.env.OPTIMISM_SEPOLIA_RPC_URL
        || (process.env.ALCHEMY_API_KEY ? `https://opt-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://sepolia.optimism.io"),
      chainId: 11155420,
      accounts: testnetKey ? [testnetKey] : [],
    },
  },
  // Per-chain API keys (hardhat-verify v2.0.14 uses legacy per-chain Etherscan endpoints)
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
    },
  },
  sourcify: { enabled: false },
};
