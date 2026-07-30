// Read-only check: confirms the emergency-wallet restructure landed on-chain
// and the 4 wallets sum to total supply.
//
// Usage:  npx hardhat run scripts/verifyRestructure.js --network arbitrum

const { ethers } = require("hardhat");

const SPLC      = "0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C";
const FOUNDER   = "0xa1766d57a3102763ED89e9a543E960B5243ef2EE";
const TREASURY  = "0x3a1Dc8a78AE204C1EBAEe58699826f0b21c30D7F";
const DEPLOYER  = "0x396157D2De70247dBc6895c5d835E46E6eB0BD22";
const EMERGENCY = process.env.EMERGENCY_WALLET;  // set in contracts/.env
if (!EMERGENCY || !ethers.isAddress(EMERGENCY)) {
  console.error("✗ EMERGENCY_WALLET is missing or not a valid address.");
  console.error("  Open https://arbiscan.io/token/0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C#balances");
  console.error("  Copy the 0xbA13...731F address (the holder of 480M SPLC).");
  console.error("  Add to contracts/.env:  EMERGENCY_WALLET=0x...");
  process.exit(1);
}

// Target supply (post-restructure, before any LP):
//   founder   100M + 76.666...M = 176,666,666.666666666666666666
//   treasury  300M + 76.666...M = 376,666,666.666666666666666666
//   deployer  120M + 76.666...M = 196,666,666.666666666666666668
//   emergency                     250,000,000.000000000000000000
//   sum                          1,000,000,000.0 SPLC

const TARGET_EMERGENCY = ethers.parseUnits("250000000",  18);
const ABI = ["function balanceOf(address) view returns (uint256)",
             "function totalSupply() view returns (uint256)"];

function fmt(wei) { return ethers.formatUnits(wei, 18); }

async function main() {
  const splc = new ethers.Contract(SPLC, ABI, ethers.provider);
  const [bF, bT, bD, bE, supply] = await Promise.all([
    splc.balanceOf(FOUNDER),
    splc.balanceOf(TREASURY),
    splc.balanceOf(DEPLOYER),
    splc.balanceOf(EMERGENCY),
    splc.totalSupply(),
  ]);

  const sum = bF + bT + bD + bE;
  const unaccounted = supply - sum;

  console.log("=== POST-RESTRUCTURE SUPPLY AUDIT ===\n");
  console.log(`Founder    ${FOUNDER}  ${fmt(bF).padStart(35)} SPLC`);
  console.log(`Treasury   ${TREASURY}  ${fmt(bT).padStart(35)} SPLC`);
  console.log(`Deployer   ${DEPLOYER}  ${fmt(bD).padStart(35)} SPLC`);
  console.log(`Emergency  ${EMERGENCY}  ${fmt(bE).padStart(35)} SPLC`);
  console.log(`${"".padStart(11+42)}  ${"".padStart(35,'-')}`);
  console.log(`Sum of 4 wallets:    ${fmt(sum).padStart(35)} SPLC`);
  console.log(`Total supply:        ${fmt(supply).padStart(35)} SPLC`);
  console.log(`Unaccounted:         ${fmt(unaccounted).padStart(35)} SPLC\n`);

  let ok = true;
  if (bE !== TARGET_EMERGENCY) {
    console.log(`✗ Emergency wallet is ${fmt(bE)} SPLC, target is 250,000,000`);
    ok = false;
  } else {
    console.log("✓ Emergency wallet at target 250,000,000 SPLC");
  }
  if (unaccounted !== 0n) {
    console.log(`✗ ${fmt(unaccounted)} SPLC is in other addresses (LP, burns, transfers, etc.)`);
    ok = false;
  } else {
    console.log("✓ All supply accounted for in the 4 named wallets");
  }
  if (bD < ethers.parseUnits("150000", 18)) {
    console.log(`✗ Deployer has ${fmt(bD)} SPLC, LP needs 150,000`);
    ok = false;
  } else {
    console.log(`✓ Deployer has enough SPLC for the 150,000 LP seed`);
  }

  console.log(ok ? "\n=== RESTRUCTURE COMPLETE — safe to run preflight + LP deploy ==="
                 : "\n=== RESTRUCTURE INCOMPLETE — do not run LP deploy yet ===");
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
