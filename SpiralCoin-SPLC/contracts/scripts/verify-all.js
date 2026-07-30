/**
 * Verify ALL SpiralCoin protocol contracts on the configured Etherscan-family
 * explorer (Etherscan v2 unified API — single ETHERSCAN_API_KEY works for
 * mainnet, Arbitrum, Base, Polygon, Optimism, BSC and their testnets).
 *
 * Reads the deployment manifest written by `deploy-multichain.js` at
 *   contracts/deployments/<network>.json
 * and verifies SpiralCoin, SpiralStakingVault, TimelockController, SpiralDAO.
 *
 * Usage:
 *   npx hardhat run scripts/verify-all.js --network arbitrum
 *   npx hardhat run scripts/verify-all.js --network sepolia
 *   npx hardhat run scripts/verify-all.js --network arbitrumSepolia
 *
 * Notes:
 *   - The token deployment uses the deployer address as the *temporary*
 *     stakingVault during construction (per deploy-multichain.js). The
 *     constructor args used for verification MUST match what was sent
 *     on-chain at deploy time, not the post-wiring state.
 *   - If a contract is already verified, hardhat-verify prints a notice
 *     and continues to the next one.
 */
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

async function verifyOne(hre, label, address, args) {
  console.log(`\n[verify] ${label} @ ${address}`);
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log(`         OK`);
  } catch (err) {
    const msg = (err && err.message) || String(err);
    if (/already verified/i.test(msg)) {
      console.log(`         already verified`);
    } else {
      console.error(`         FAILED: ${msg}`);
    }
  }
}

async function main() {
  const hre = require("hardhat");
  const manifestPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing deployment manifest: ${manifestPath}`);
  }
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  // Re-derive the constructor args that deploy-multichain.js sent on-chain.
  const supplyVault = m.wallets.supplyVault;
  const founder     = m.wallets.founder;
  const treasury    = m.wallets.treasury;
  const deployer    = m.deployer;
  const premineUnits = hre.ethers.parseUnits(m.parameters.premine || "0", 18).toString();
  const founderUnits = hre.ethers.parseUnits(m.parameters.founder || "0", 18).toString();
  const minDelay = m.parameters.timelockMinDelay;

  const token    = m.contracts.SpiralCoin;
  const vault    = m.contracts.SpiralStakingVault;
  const timelock = m.contracts.TimelockController;
  const dao      = m.contracts.SpiralDAO;

  console.log(`Network: ${hre.network.name} (chainId=${m.chainId})`);
  console.log(`Etherscan key: ${process.env.ETHERSCAN_API_KEY ? "present" : "MISSING (set ETHERSCAN_API_KEY in .env)"}`);

  // 1. SpiralCoin
  await verifyOne(hre, "SpiralCoin", token, [
    supplyVault,
    premineUnits,
    founder,
    founderUnits,
    treasury,
    deployer, // temp stakingVault used at construction
  ]);

  // 2. SpiralStakingVault
  await verifyOne(hre, "SpiralStakingVault", vault, [token]);

  // 3. TimelockController (OpenZeppelin) — proposers=[], executors=[], admin=deployer
  await verifyOne(hre, "TimelockController", timelock, [
    minDelay,
    [],
    [],
    deployer,
  ]);

  // 4. SpiralDAO
  await verifyOne(hre, "SpiralDAO", dao, [token, timelock]);

  console.log(`\nDone. View on explorer:`);
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
  const base = explorers[m.chainId] || "(unknown explorer)";
  console.log(`  ${base}/address/${token}`);
  console.log(`  ${base}/address/${vault}`);
  console.log(`  ${base}/address/${timelock}`);
  console.log(`  ${base}/address/${dao}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
