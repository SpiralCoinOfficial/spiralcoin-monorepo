// SPDX-License-Identifier: MIT
// Post-deploy distribution + vesting setup for SpiralCoinUpgradeable.
//
// Order of operations:
//   1. deployUpgradeable.js          (mints 500M to deployer, 500M to FOUNDER_WALLET)
//   2. distributeAndVest.js  <-- THIS
//        - Deploys SPLCPresaleVesting contract
//        - Transfers 500M from FOUNDER_WALLET into the vesting contract
//          (FOUNDER_WALLET must sign — use FOUNDER_PRIVATE_KEY signer)
//        - Creates 3 vesting schedules:
//            * Founder/Team       150M  12mo cliff + 36mo linear (48mo total)
//            * Project Treasury   200M   6mo cliff + 24mo linear (30mo total)
//            * Staking/Rewards    150M   no cliff + 48mo linear (usage-gated off-chain)
//        - Transfers the 500M deployer balance to the four circulating buckets:
//            * 250M -> PUBLIC_SALE_WALLET    (later seeded into IDO/presale)
//            * 150M -> LIQUIDITY_WALLET      (later paired with ETH for LP)
//            *  50M -> MARKETING_WALLET
//            *  50M -> COMMUNITY_WALLET
//        - Marks all distribution wallets fee-exempt (no 3.14% tax on bootstrap moves)
//
// Usage:
//   npx hardhat run scripts/distributeAndVest.js --network arbitrum

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
function reqUnits(name) { return ethers.parseUnits(req(name), 18); }

async function main() {
  const net = network.name;
  const [deployer] = await ethers.getSigners();

  const depFile = path.join(__dirname, "..", "deployments", net, "SpiralCoinUpgradeable.json");
  if (!fs.existsSync(depFile)) throw new Error(`Run deployUpgradeable first: missing ${depFile}`);
  const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));

  const splc = await ethers.getContractAt("SpiralCoinUpgradeable", dep.proxy);
  console.log("SPLC:", dep.proxy);

  // ── 1. Deploy vesting ─────────────────────────────────────────────────
  console.log("\n[1/4] Deploying SPLCPresaleVesting...");
  const VestingF = await ethers.getContractFactory("SPLCPresaleVesting");
  const vesting = await VestingF.deploy(dep.proxy, deployer.address);
  await vesting.waitForDeployment();
  const vestingAddr = await vesting.getAddress();
  console.log("  vesting:", vestingAddr);

  // Mark vesting + all bucket wallets fee-exempt
  console.log("\n[2/4] Marking distribution wallets fee-exempt...");
  const buckets = [
    vestingAddr,
    req("PUBLIC_SALE_WALLET"),
    req("LIQUIDITY_WALLET"),
    req("MARKETING_WALLET"),
    req("COMMUNITY_WALLET"),
    req("STAKING_VAULT"),
  ];
  for (const b of buckets) {
    const tx = await splc.setFeeExempt(b, true);
    await tx.wait();
    console.log("  fee-exempt:", b);
  }

  // ── 3. Fund vesting contract from FOUNDER_WALLET ──────────────────────
  // Needs the founder signer. Hardhat must have FOUNDER_PRIVATE_KEY in accounts[].
  // Reload signers — assumes founder is accounts[1] when both keys are present.
  console.log("\n[3/4] Funding vesting + creating schedules...");
  const founderKey = process.env.FOUNDER_PRIVATE_KEY;
  if (!founderKey) throw new Error("FOUNDER_PRIVATE_KEY required to move locked supply");
  const founderSigner = new ethers.Wallet(
    founderKey.startsWith("0x") ? founderKey : "0x" + founderKey,
    ethers.provider
  );
  const splcAsFounder = splc.connect(founderSigner);

  const lockedTotal = reqUnits("LOCKED_SUPPLY");
  const founderBal = await splc.balanceOf(founderSigner.address);
  if (founderBal < lockedTotal) {
    throw new Error(`Founder balance ${founderBal} < lockedTotal ${lockedTotal}`);
  }

  const txFund = await splcAsFounder.transfer(vestingAddr, lockedTotal);
  await txFund.wait();
  console.log("  funded vesting with", ethers.formatUnits(lockedTotal, 18), "SPLC");

  // Create the 3 schedules
  const start = Math.floor(Date.now() / 1000);
  const schedules = [
    {
      label: "Founder/Team",
      beneficiary: req("FOUNDER_BENEFICIARY"),
      amount: reqUnits("ALLOC_FOUNDER_TEAM"),
      cliff: parseInt(req("FOUNDER_CLIFF_SEC"), 10),
      duration: parseInt(req("FOUNDER_DURATION_SEC"), 10),
    },
    {
      label: "Project Treasury",
      beneficiary: req("TREASURY_WALLET"),
      amount: reqUnits("ALLOC_TREASURY_LOCKED"),
      cliff: parseInt(req("TREASURY_CLIFF_SEC"), 10),
      duration: parseInt(req("TREASURY_DURATION_SEC"), 10),
    },
    {
      label: "Staking/Rewards",
      beneficiary: req("STAKING_VAULT"),
      amount: reqUnits("ALLOC_STAKING"),
      cliff: parseInt(req("STAKING_CLIFF_SEC"), 10),
      duration: parseInt(req("STAKING_DURATION_SEC"), 10),
    },
  ];
  for (const s of schedules) {
    const tx = await vesting.createSchedule(s.beneficiary, s.amount, start, s.cliff, s.duration);
    await tx.wait();
    console.log(`  schedule: ${s.label}  ${ethers.formatUnits(s.amount, 18)} SPLC -> ${s.beneficiary}`);
  }

  // ── 4. Move 500M circulating from deployer to the 4 buckets ───────────
  console.log("\n[4/4] Distributing 500M circulating supply...");
  const moves = [
    ["PUBLIC_SALE_WALLET", "ALLOC_PUBLIC_SALE"],
    ["LIQUIDITY_WALLET",   "ALLOC_LIQUIDITY"],
    ["MARKETING_WALLET",   "ALLOC_MARKETING_CEX"],
    ["COMMUNITY_WALLET",   "ALLOC_COMMUNITY"],
  ];
  for (const [walletEnv, amountEnv] of moves) {
    const to = req(walletEnv);
    const amt = reqUnits(amountEnv);
    const tx = await splc.transfer(to, amt);
    await tx.wait();
    console.log(`  ${walletEnv}: ${ethers.formatUnits(amt, 18)} SPLC -> ${to}`);
  }

  // Persist
  const out = {
    network: net,
    splc: dep.proxy,
    vesting: vestingAddr,
    buckets: {
      publicSale:    req("PUBLIC_SALE_WALLET"),
      liquidity:     req("LIQUIDITY_WALLET"),
      marketing:     req("MARKETING_WALLET"),
      community:     req("COMMUNITY_WALLET"),
      stakingVault:  req("STAKING_VAULT"),
    },
    schedules: schedules.map(s => ({
      label: s.label,
      beneficiary: s.beneficiary,
      amount: ethers.formatUnits(s.amount, 18),
      cliffSec: s.cliff,
      durationSec: s.duration,
      startTs: start,
    })),
    distributedAt: new Date().toISOString(),
  };
  const outFile = path.join(__dirname, "..", "deployments", net, "Distribution.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outFile);

  console.log("\nNext: deployLpAndLock.js (pairs LP_SPLC_AMOUNT SPLC with LP_PAIRED_USDC USDC at 1% fee, locks LP NFT 12 months)");
}

main().catch((e) => { console.error(e); process.exit(1); });
