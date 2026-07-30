// Run with: node scripts/validate-env.js
//   strict mainnet gate: node scripts/validate-env.js --mainnet   (or MAINNET_STRICT=1)
// Verifies your .env is fully populated and well-formed BEFORE you deploy.
// In --mainnet mode the soft warnings below become hard failures.
require("dotenv").config();

const STRICT = process.argv.includes("--mainnet") || process.env.MAINNET_STRICT === "1";

// Well-known publicly-exposed test keys that must NEVER deploy real value.
const BANNED_KEYS = new Set([
  // hardhat / anvil account #0
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  // ganache deterministic #0
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
].map((k) => k.toLowerCase()));

const REQUIRED = {
  ALCHEMY_API_KEY: { re: /^[A-Za-z0-9_-]{20,}$/, hint: "Get at dashboard.alchemy.com" },
  DEPLOYER_PRIVATE_KEY: { re: /^(0x)?[0-9a-fA-F]{64}$/, hint: "64 hex chars, with or without 0x" },
  TREASURY_WALLET: { re: /^0x[0-9a-fA-F]{40}$/, hint: "Gnosis Safe address" },
  SUPPLY_VAULT_WALLET: { re: /^0x[0-9a-fA-F]{40}$/, hint: "Gnosis Safe address" },
  FOUNDER_WALLET: { re: /^0x[0-9a-fA-F]{40}$/, hint: "Gnosis Safe address" },
  PREMINE_AMOUNT: { re: /^[0-9]+$/, hint: "integer (no decimals)" },
  FOUNDER_AMOUNT: { re: /^[0-9]+$/, hint: "integer (no decimals)" },
  TIMELOCK_MIN_DELAY: { re: /^[0-9]+$/, hint: "seconds; >=172800 recommended for mainnet" },
};

const OPTIONAL = ["ARBISCAN_API_KEY", "BASESCAN_API_KEY", "POLYGONSCAN_API_KEY", "ETHERSCAN_API_KEY", "OPTIMISTIC_ETHERSCAN_API_KEY"];

let fail = 0;
console.log("\n=== SPLC .env validation ===");
console.log(STRICT ? "    mode: MAINNET STRICT (warnings are fatal)\n" : "    mode: standard\n");

for (const [key, { re, hint }] of Object.entries(REQUIRED)) {
  const v = process.env[key];
  if (!v) { console.log(`  [MISSING] ${key}   (${hint})`); fail++; continue; }
  if (!re.test(v)) { console.log(`  [INVALID] ${key}   (${hint})`); fail++; continue; }
  const shown = key.includes("KEY") || key.includes("PRIVATE")
    ? v.slice(0, 6) + "..." + v.slice(-4)
    : v;
  console.log(`  [OK]      ${key} = ${shown}`);
}

console.log("");
for (const key of OPTIONAL) {
  const v = process.env[key];
  console.log(v ? `  [OK]      ${key} (set)` : `  [warn]    ${key} not set (verify step will be skipped on that chain)`);
}

// Cross-checks
const tre = (process.env.TREASURY_WALLET || "").toLowerCase();
const sup = (process.env.SUPPLY_VAULT_WALLET || "").toLowerCase();
const fnd = (process.env.FOUNDER_WALLET || "").toLowerCase();

// In strict mode, escalate the soft warnings to hard failures.
const flag = (cond, msg) => {
  if (!cond) return;
  if (STRICT) { console.log(`  [FAIL] ${msg}`); fail++; }
  else { console.log(`  [WARN] ${msg}`); }
};

if (tre && sup && tre === sup) flag(true, "TREASURY_WALLET == SUPPLY_VAULT_WALLET (use different multisigs)");
if (tre && fnd && tre === fnd) flag(true, "TREASURY_WALLET == FOUNDER_WALLET (use different multisigs)");
if (sup && fnd && sup === fnd) flag(true, "SUPPLY_VAULT_WALLET == FOUNDER_WALLET (use different multisigs)");

const tlock = parseInt(process.env.TIMELOCK_MIN_DELAY || "0", 10);
flag(tlock > 0 && tlock < 172800, `TIMELOCK_MIN_DELAY = ${tlock}s (< 48h). OK for testnet, NOT for mainnet.`);

// A publicly-known test key must never sign a mainnet deploy.
const dk = (process.env.DEPLOYER_PRIVATE_KEY || "").toLowerCase();
const dkNorm = dk.startsWith("0x") ? dk : (dk ? `0x${dk}` : "");
if (dkNorm && BANNED_KEYS.has(dkNorm)) { console.log("  [FAIL] DEPLOYER_PRIVATE_KEY is a well-known public TEST key — refuse to deploy real value."); fail++; }

console.log("");
if (fail > 0) { console.error(`FAILED: ${fail} required variable(s) missing or invalid. See contracts/.env.example for instructions.`); process.exit(1); }
console.log(STRICT
  ? "All mainnet preflight checks passed. The deploy is cleared for a human-run broadcast."
  : "All required variables present. You can now run:");
if (!STRICT) {
  console.log("  npm run deploy:arbitrum-sepolia    # testnet first!");
}
console.log("");

