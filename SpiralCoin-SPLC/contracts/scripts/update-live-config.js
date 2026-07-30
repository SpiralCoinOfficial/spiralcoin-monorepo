/**
 * Reads contracts/deployments/<network>.json and patches assets/live-config.js
 * so the new mainnet/L2 addresses light up the on-chain live-feed.
 *
 * Usage:
 *   $env:NODE_OPTIONS=''
 *   node contracts/scripts/update-live-config.js arbitrum
 *   node contracts/scripts/update-live-config.js mainnet
 *   node contracts/scripts/update-live-config.js base
 *   node contracts/scripts/update-live-config.js sepolia
 *
 * Maps hardhat network name -> key inside SPIRAL_LIVE_CONFIG.splc:
 *   arbitrum         -> arbitrum
 *   arbitrumSepolia  -> arbSepolia
 *   mainnet          -> mainnet
 *   base             -> base
 *   baseSepolia      -> baseSepolia      (added if missing)
 *   sepolia          -> sepolia
 *   optimism         -> optimism         (added if missing)
 *   polygon          -> polygon          (added if missing)
 *
 * The script does a backup -> in-place edit using a targeted regex on the
 * block: <key>: { chainId: <n>, token: '...', staking: '...', ... }.
 * If the block isn't present yet, it inserts a new one inside the splc:{}
 * object.
 */
const fs = require("node:fs");
const path = require("node:path");

const NET_TO_KEY = {
  arbitrum: "arbitrum",
  arbitrumSepolia: "arbSepolia",
  mainnet: "mainnet",
  base: "base",
  baseSepolia: "baseSepolia",
  sepolia: "sepolia",
  optimism: "optimism",
  optimismSepolia: "opSepolia",
  polygon: "polygon",
  polygonAmoy: "polygonAmoy",
  bsc: "bsc",
  bscTestnet: "bscTestnet",
};

function die(msg) { console.error("update-live-config:", msg); process.exit(1); }

const network = (process.argv[2] || "").trim();
if (!network) die("usage: node update-live-config.js <hardhat-network-name>");
const key = NET_TO_KEY[network];
if (!key) die(`unknown network "${network}". Supported: ${Object.keys(NET_TO_KEY).join(", ")}`);

const repoRoot = path.join(__dirname, "..", "..");
const manifestPath = path.join(repoRoot, "contracts", "deployments", `${network}.json`);
const configPath = path.join(repoRoot, "assets", "live-config.js");

if (!fs.existsSync(manifestPath)) die(`missing manifest: ${manifestPath}`);
if (!fs.existsSync(configPath))   die(`missing config: ${configPath}`);

const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const block = {
  chainId:  m.chainId,
  token:    m.contracts.SpiralCoin         || "",
  staking:  m.contracts.SpiralStakingVault || "",
  timelock: m.contracts.TimelockController || "",
  dao:      m.contracts.SpiralDAO          || "",
  treasury: (m.wallets && m.wallets.treasury) || "",
  founder:  (m.wallets && m.wallets.founder)  || "",
};

function fmt(b, indent) {
  const pad = " ".repeat(indent);
  const inner = " ".repeat(indent + 2);
  return [
    `${pad}${key}: {`,
    `${inner}chainId:  ${b.chainId},`,
    `${inner}token:    '${b.token}',`,
    `${inner}staking:  '${b.staking}',`,
    `${inner}timelock: '${b.timelock}',`,
    `${inner}dao:      '${b.dao}',`,
    `${inner}treasury: '${b.treasury}',`,
    `${inner}founder:  '${b.founder}'`,
    `${pad}}`,
  ].join("\n");
}

const src = fs.readFileSync(configPath, "utf8");

// Match the entire `<key>: { ... }` block inside splc:{}. Tolerates trailing commas.
const blockRe = new RegExp(
  String.raw`(^\s{4})${key}\s*:\s*\{[\s\S]*?^\s{4}\}`,
  "m"
);

let out;
if (blockRe.test(src)) {
  out = src.replace(blockRe, fmt(block, 4));
  console.log(`Replaced existing splc.${key} block.`);
} else {
  // Insert before the closing brace of the splc:{} object.
  // splc:{} ends with `^  },` at indent 2 (the splc property closer).
  const splcCloseRe = /(^\s{2}\},\s*\n\s*\/\/[^\n]*Preferred provider)/m;
  if (!splcCloseRe.test(src)) {
    die("could not find splc:{} closing brace; please add the block manually.");
  }
  out = src.replace(splcCloseRe, `,\n${fmt(block, 4)}\n  },\n  // Preferred provider`);
  console.log(`Inserted new splc.${key} block.`);
}

// Backup
const bak = configPath + ".bak-" + new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(bak, src);
fs.writeFileSync(configPath, out);
console.log(`Wrote ${configPath}`);
console.log(`Backup: ${bak}`);
console.log(`\nNew ${key} block:`);
console.log(fmt(block, 4));
console.log(`\nNext: deploy assets/live-config.js to IONOS, hard-reload spiralcoin.net.`);
