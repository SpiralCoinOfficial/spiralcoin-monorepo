// SPDX-License-Identifier: MIT
//
// scripts/verify-testnet.js
// ─────────────────────────
// Verify all contracts deployed by scripts/deploy-testnet.js on the configured
// Etherscan-family explorer. Reads contracts/deployments/<network>.json
// (the flat manifest schema written by deploy-testnet.js) and submits source
// for each address with the exact constructor args used on chain.
//
// Usage:
//   npx hardhat run scripts/verify-testnet.js --network arbitrumSepolia
//   npx hardhat run scripts/verify-testnet.js --network baseSepolia
//
// Requires:
//   ETHERSCAN_API_KEY  (Etherscan v2 unified key works across supported chains)

const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

async function verifyOne(hre, label, address, args) {
  console.log(`\n[verify] ${label} @ ${address}`);
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log("         OK");
  } catch (err) {
    const msg = (err && err.message) || String(err);
    if (/already verified/i.test(msg) || /Already Verified/i.test(msg)) {
      console.log("         already verified");
    } else {
      console.error(`         FAILED: ${msg}`);
    }
  }
}

async function main() {
  const hre = require("hardhat");
  const net = hre.network.name;
  const manifestPath = path.join(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing deployment manifest: ${manifestPath}. Run deploy-testnet.js first.`);
  }
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  console.log(`Network: ${net} (chainId=${m.chainId})`);
  console.log(`Etherscan key: ${process.env.ETHERSCAN_API_KEY ? "present" : "MISSING (set ETHERSCAN_API_KEY in .env)"}`);

  const c = m.contracts || {};
  const cfg = m.config || {};
  const deployer = m.deployer;
  const treasury = cfg.treasury;
  const lzEndpoint = m.lzEndpoint;

  // ── SpiralCoinUpgradeable (proxy + impl) ─────────────────────────────
  // hardhat-verify auto-detects the implementation behind the UUPS proxy and
  // verifies both. Constructor args are for the IMPL contract: (address _lzEndpoint).
  if (c.SpiralCoinUpgradeable) {
    await verifyOne(hre, "SpiralCoinUpgradeable (proxy+impl)", c.SpiralCoinUpgradeable, [lzEndpoint]);
  }

  // ── SPLCPresaleVesting(IERC20 token, address owner) ──────────────────
  if (c.SPLCPresaleVesting) {
    await verifyOne(hre, "SPLCPresaleVesting", c.SPLCPresaleVesting, [
      c.SpiralCoinUpgradeable,
      deployer,
    ]);
  }

  // ── SPLCStakingVault(IERC20 splc, address owner) ─────────────────────
  if (c.SPLCStakingVault) {
    await verifyOne(hre, "SPLCStakingVault", c.SPLCStakingVault, [
      c.SpiralCoinUpgradeable,
      deployer,
    ]);
  }

  // ── SPLCPresalePublic (11 args) ──────────────────────────────────────
  if (c.SPLCPresalePublic) {
    await verifyOne(hre, "SPLCPresalePublic", c.SPLCPresalePublic, [
      c.SpiralCoinUpgradeable,
      deployer,
      treasury,
      cfg.splcPerEth,
      cfg.hardCapEth,
      cfg.minEth,
      cfg.maxEth,
      cfg.presaleStart,
      cfg.presaleEnd,
      (cfg.vestingDays || 0) * 86400,
      (cfg.vestingDays || 0) > 0 ? cfg.presaleEnd : 0,
    ]);
  }

  // ── SPLCAirdropMerkle(IERC20 splc, address owner, uint64 deadline) ───
  if (c.SPLCAirdropMerkle) {
    await verifyOne(hre, "SPLCAirdropMerkle", c.SPLCAirdropMerkle, [
      c.SpiralCoinUpgradeable,
      deployer,
      cfg.airdropDeadline,
    ]);
  }

  // ── Explorer links ───────────────────────────────────────────────────
  const explorers = {
    1:        "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    42161:    "https://arbiscan.io",
    421614:   "https://sepolia.arbiscan.io",
    8453:     "https://basescan.org",
    84532:    "https://sepolia.basescan.org",
    137:      "https://polygonscan.com",
    80002:    "https://amoy.polygonscan.com",
    10:       "https://optimistic.etherscan.io",
    11155420: "https://sepolia-optimism.etherscan.io",
    56:       "https://bscscan.com",
    97:       "https://testnet.bscscan.com",
  };
  const base = explorers[Number(m.chainId)] || "(unknown explorer)";
  console.log("\nView on explorer:");
  for (const [name, addr] of Object.entries(c)) {
    if (addr) console.log(`  ${name.padEnd(28)} ${base}/address/${addr}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
