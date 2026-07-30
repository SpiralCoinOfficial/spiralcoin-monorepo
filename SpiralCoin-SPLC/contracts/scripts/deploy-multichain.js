/**
 * Multichain L2 deployment script for the SpiralCoin protocol suite.
 *
 * Deploys, in order:
 *   1. SpiralCoin (SPLC)           — ERC20 + Permit + Votes + 3.14% AMM tax
 *   2. SpiralStakingVault          — receives 50% of fees, distributes to stakers
 *   3. TimelockController          — DAO execution delay (48h)
 *   4. SpiralDAO (Governor)        — on-chain governance over Timelock
 *
 * Wiring performed automatically:
 *   - Token.stakingVault → StakingVault address
 *   - Timelock proposer/executor → SpiralDAO + open executor (anyone can execute)
 *   - Timelock admin role revoked from deployer (renounce admin)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-multichain.js --network arbitrum
 *   npx hardhat run scripts/deploy-multichain.js --network base
 *   npx hardhat run scripts/deploy-multichain.js --network polygon
 *   npx hardhat run scripts/deploy-multichain.js --network optimism
 *   npx hardhat run scripts/deploy-multichain.js --network arbitrumSepolia
 *   npx hardhat run scripts/deploy-multichain.js --network baseSepolia
 *
 * Required .env:
 *   DEPLOYER_PRIVATE_KEY
 *   ALCHEMY_API_KEY                (multichain RPC)
 *   SUPPLY_VAULT_WALLET            (initial premine recipient)
 *   FOUNDER_WALLET                 (founder allocation)
 *   PREMINE_AMOUNT                 (in SPLC, human units, e.g. "900000000")
 *   FOUNDER_AMOUNT                 (in SPLC, human units, e.g. "100000000")
 *   TREASURY_WALLET                (50% fee receiver)
 *   TIMELOCK_MIN_DELAY             (optional, defaults to 172800 = 48h)
 */
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

async function main() {
  const hre = require("hardhat");
  const { ethers } = hre;

  // ── Env validation ─────────────────────────────────────────────────────
  const supplyVaultWallet = (process.env.SUPPLY_VAULT_WALLET || process.env.PREMINE_WALLET || "").trim();
  const founderWallet = (process.env.FOUNDER_WALLET || "").trim();
  const treasuryWallet = (process.env.TREASURY_WALLET || "").trim();
  const premineAmount = (process.env.PREMINE_AMOUNT || process.env.CIRCULATING_SUPPLY || "").trim();
  const founderAmount = (process.env.FOUNDER_AMOUNT || process.env.FOUNDER_SUPPLY || "").trim();
  const minDelay = BigInt(process.env.TIMELOCK_MIN_DELAY || "172800"); // 48h

  if (!supplyVaultWallet || !founderWallet || !treasuryWallet) {
    throw new Error("Set SUPPLY_VAULT_WALLET, FOUNDER_WALLET, TREASURY_WALLET in .env");
  }
  if (!premineAmount && !founderAmount) {
    throw new Error("Set PREMINE_AMOUNT and/or FOUNDER_AMOUNT in .env");
  }

  // Validate wallet addresses are well-formed BEFORE spending any gas
  // (catches a fat-fingered .env that would otherwise burn a real deploy).
  for (const [label, addr] of [
    ["SUPPLY_VAULT_WALLET", supplyVaultWallet],
    ["FOUNDER_WALLET", founderWallet],
    ["TREASURY_WALLET", treasuryWallet],
  ]) {
    if (!ethers.isAddress(addr)) {
      throw new Error(`${label} is not a valid address: ${addr}`);
    }
  }

  const [deployer] = await ethers.getSigners();
  const premineUnits = premineAmount ? ethers.parseUnits(premineAmount, 18) : 0n;
  const founderUnits = founderAmount ? ethers.parseUnits(founderAmount, 18) : 0n;

  const net = await ethers.provider.getNetwork();
  console.log(`\n=== SpiralCoin Multichain Deploy ===`);
  console.log(`Network:  ${hre.network.name} (chainId=${net.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native\n`);

  // ── Pre-deploy balance preflight (skipped on the in-process fork) ──────
  //     Refuse to start a real deploy from an under-funded deployer.
  if (hre.network.name !== "hardhat") {
    const bal = await ethers.provider.getBalance(deployer.address);
    const minBal = ethers.parseEther(process.env.MIN_DEPLOYER_BALANCE || "0.05");
    if (bal < minBal) {
      throw new Error(
        `Deployer balance ${ethers.formatEther(bal)} < required ${ethers.formatEther(minBal)} native. ` +
        `Fund ${deployer.address} or set MIN_DEPLOYER_BALANCE.`
      );
    }
  }

  // ── 1. Deploy SpiralStakingVault placeholder (needs token address) ─────
  //      We deploy the token first with `deployer` as a temp stakingVault,
  //      then redirect once the real vault is up. This avoids circular deps.
  console.log("[1/4] Deploying SpiralCoin (SPLC)...");
  const SpiralCoin = await ethers.getContractFactory("SpiralCoin");
  const token = await SpiralCoin.deploy(
    supplyVaultWallet,
    premineUnits,
    founderWallet,
    founderUnits,
    treasuryWallet,
    deployer.address      // temp; replaced below
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`      SPLC → ${tokenAddress}`);

  // ── 2. Deploy SpiralStakingVault ───────────────────────────────────────
  console.log("[2/4] Deploying SpiralStakingVault...");
  const Vault = await ethers.getContractFactory("SpiralStakingVault");
  const vault = await Vault.deploy(tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`      Vault → ${vaultAddress}`);

  // Redirect fee receiver to real vault + mark vault fee-exempt
  console.log("      Wiring vault as fee receiver...");
  await (await token.setFeeReceivers(treasuryWallet, vaultAddress)).wait();
  await (await token.setFeeExempt(vaultAddress, true)).wait();

  // ── 3. Deploy TimelockController ───────────────────────────────────────
  console.log(`[3/4] Deploying TimelockController (min delay ${minDelay}s)...`);
  const Timelock = await ethers.getContractFactory("@openzeppelin/contracts/governance/TimelockController.sol:TimelockController");
  // proposers/executors set below — start with deployer as temp admin
  const timelock = await Timelock.deploy(minDelay, [], [], deployer.address);
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log(`      Timelock → ${timelockAddress}`);

  // ── 4. Deploy SpiralDAO Governor ───────────────────────────────────────
  console.log("[4/4] Deploying SpiralDAO Governor...");
  const DAO = await ethers.getContractFactory("SpiralDAO");
  const dao = await DAO.deploy(tokenAddress, timelockAddress);
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log(`      SpiralDAO → ${daoAddress}`);

  // ── Wire governance roles ──────────────────────────────────────────────
  console.log("Wiring Timelock roles → DAO...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  await (await timelock.grantRole(PROPOSER_ROLE, daoAddress)).wait();
  await (await timelock.grantRole(CANCELLER_ROLE, daoAddress)).wait();
  await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait(); // open executor
  console.log("Renouncing Timelock admin role from deployer...");
  await (await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)).wait();

  // Transfer token ownership to Timelock (DAO controls AMM pair list, etc.)
  console.log("Transferring SPLC ownership to Timelock...");
  await (await token.transferOwnership(timelockAddress)).wait();

  // ── Persist deployment manifest ────────────────────────────────────────
  const manifest = {
    network: hre.network.name,
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      SpiralCoin: tokenAddress,
      SpiralStakingVault: vaultAddress,
      TimelockController: timelockAddress,
      SpiralDAO: daoAddress,
    },
    wallets: {
      supplyVault: supplyVaultWallet,
      founder: founderWallet,
      treasury: treasuryWallet,
    },
    parameters: {
      feeBps: 314,
      feePct: "3.14%",
      feeSplit: "50% treasury / 50% stakingVault",
      timelockMinDelay: minDelay.toString(),
      premine: premineAmount || "0",
      founder: founderAmount || "0",
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${hre.network.name}.json`),
    JSON.stringify(manifest, null, 2)
  );

  console.log("\n=== Deployment complete ===");
  console.log(JSON.stringify(manifest, null, 2));
  console.log("\nNext steps:");
  console.log(`  1. Create AMM pair (e.g. on Camelot/Aerodrome/QuickSwap)`);
  console.log(`  2. Owner (Timelock via DAO proposal) calls token.setAmmPair(pairAddress, true)`);
  console.log(`  3. Verify contracts:`);
  console.log(`       npx hardhat verify --network ${hre.network.name} ${tokenAddress} ${supplyVaultWallet} ${premineUnits} ${founderWallet} ${founderUnits} ${treasuryWallet} ${deployer.address}`);
  console.log(`       npx hardhat verify --network ${hre.network.name} ${vaultAddress} ${tokenAddress}`);
  console.log(`       npx hardhat verify --network ${hre.network.name} ${daoAddress} ${tokenAddress} ${timelockAddress}`);

  // ── Post-deploy self-verification — fail loudly on a botched deploy ────
  console.log("\nVerifying on-chain invariants...");
  const verifyChecks = [
    [Number(await token.FEE_BPS()) === 314, "FEE_BPS == 314"],
    [(await token.owner()).toLowerCase() === timelockAddress.toLowerCase(), "token owner == Timelock"],
    [(await token.stakingVault()).toLowerCase() === vaultAddress.toLowerCase(), "stakingVault wired"],
    [(await token.totalSupply()) === premineUnits + founderUnits, "totalSupply == premine + founder"],
    [await timelock.hasRole(PROPOSER_ROLE, daoAddress), "DAO is Timelock proposer"],
    [!(await timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)), "deployer admin renounced"],
  ];
  const verifyFailed = verifyChecks.filter(([ok]) => !ok).map(([, m]) => m);
  if (verifyFailed.length) {
    throw new Error("Post-deploy verification FAILED: " + verifyFailed.join("; "));
  }
  console.log("      all invariants OK");

  return manifest;
}

module.exports = { main };

// Auto-run when invoked directly via `hardhat run scripts/deploy-multichain.js`.
// The mainnet dry-run imports main() instead, setting SPLC_NO_AUTORUN=1, so it
// can assert on-chain invariants in the same process (the real deploy command
// is unaffected — no flag is set there).
if (!process.env.SPLC_NO_AUTORUN) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
