// SPDX-License-Identifier: MIT
// One-shot distribution: reads contracts/config/launch.json and disperses the
// 1B SPLC supply to all 9 buckets. Idempotent — safe to re-run; only fires the
// transfers that haven't happened yet.
//
// Prerequisites:
//   1. deployUpgradeable.js already ran (proxy minted entire 1B to deployer or split deployer+founder)
//   2. .env contains all wallet addresses:
//        FOUNDER_WALLET, TREASURY_WALLET (Safe multisig),
//        STAKING_VAULT (already deployed by deployUpgradeable),
//        PUBLIC_PRESALE, ACCREDITED_VESTING, AIRDROP_MERKLE,
//        LP_LOCK_HOLDER (treasury until LP deploy), CEX_COLD_STORAGE,
//        DAO_TIMELOCK
//   3. SPLCPresaleVesting deployed (or deployer is allowed to deploy it here)
//
// Usage:
//   $env:NODE_OPTIONS=""
//   npx hardhat run scripts/distributeAll.js --network arbitrumSepolia

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function loadDeployment(net, name) {
  const f = path.join(__dirname, "..", "deployments", net, `${name}.json`);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

function pUnits(n) { return ethers.parseUnits(String(n), 18); }

async function transferIfBelow(splc, target, requiredAmount, label) {
  const bal = await splc.balanceOf(target);
  if (bal >= requiredAmount) {
    console.log(`  [skip] ${label} already has ${ethers.formatUnits(bal, 18)} SPLC`);
    return;
  }
  const need = requiredAmount - bal;
  console.log(`  -> ${label}: sending ${ethers.formatUnits(need, 18)} SPLC to ${target}`);
  const tx = await splc.transfer(target, need);
  await tx.wait();
}

async function setExemptIfNeeded(splc, addr, label) {
  if (addr === ethers.ZeroAddress) return;
  const already = await splc.isFeeExempt(addr);
  if (already) {
    console.log(`  [skip] ${label} already fee-exempt`);
    return;
  }
  console.log(`  -> exempt ${label} ${addr}`);
  const tx = await splc.setFeeExempt(addr, true);
  await tx.wait();
}

async function main() {
  const net = network.name;
  const [deployer] = await ethers.getSigners();

  // ── Load config + deployment ──────────────────────────────────────────
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "launch.json"), "utf8"));
  const dep = await loadDeployment(net, "SpiralCoinUpgradeable");
  if (!dep) throw new Error(`Missing deployments/${net}/SpiralCoinUpgradeable.json — run deployUpgradeable first`);

  const splc = await ethers.getContractAt("SpiralCoinUpgradeable", dep.proxy);
  console.log(`\n=== distributeAll  ::  ${net}  ::  SPLC ${dep.proxy} ===`);
  console.log("Deployer:", deployer.address);
  console.log("Bal     :", ethers.formatUnits(await splc.balanceOf(deployer.address), 18), "SPLC");

  // ── Resolve all destination addresses ─────────────────────────────────
  const wallets = {
    founder:         req("FOUNDER_WALLET"),
    treasury:        req("TREASURY_WALLET"),
    stakingVault:    req("STAKING_VAULT"),
    publicPresale:   process.env.PUBLIC_PRESALE      || ethers.ZeroAddress,
    accreditedVest:  process.env.ACCREDITED_VESTING  || ethers.ZeroAddress,
    airdrop:         process.env.AIRDROP_MERKLE      || ethers.ZeroAddress,
    lpLockHolder:    process.env.LP_LOCK_HOLDER      || req("TREASURY_WALLET"),
    cexColdStorage:  process.env.CEX_COLD_STORAGE    || ethers.ZeroAddress,
    daoTimelock:     process.env.DAO_TIMELOCK        || ethers.ZeroAddress,
  };

  console.log("\n[1/4] Wallet routing:");
  for (const [k, v] of Object.entries(wallets)) console.log(`  ${k.padEnd(16)} ${v}`);

  // ── Step 2: fee-exempt EVERY system address ───────────────────────────
  console.log("\n[2/4] Setting fee-exempt for all system addresses (no 3.14% tax on internal moves)...");
  for (const [label, addr] of Object.entries(wallets)) {
    await setExemptIfNeeded(splc, addr, label);
  }

  // ── Step 3: Deploy/find vesting contract for founder + treasury + ecosystem + accredited ─
  console.log("\n[3/4] Vesting contract...");
  let vesting;
  const vDep = await loadDeployment(net, "SPLCPresaleVesting");
  if (vDep && vDep.address) {
    vesting = await ethers.getContractAt("SPLCPresaleVesting", vDep.address);
    console.log("  reusing existing vesting:", vDep.address);
  } else {
    console.log("  deploying SPLCPresaleVesting...");
    const VF = await ethers.getContractFactory("SPLCPresaleVesting");
    vesting = await VF.deploy(dep.proxy, deployer.address);
    await vesting.waitForDeployment();
    const vAddr = await vesting.getAddress();
    console.log("  vesting:", vAddr);
    fs.writeFileSync(
      path.join(__dirname, "..", "deployments", net, "SPLCPresaleVesting.json"),
      JSON.stringify({ network: net, address: vAddr, deployedAt: new Date().toISOString() }, null, 2)
    );
    await setExemptIfNeeded(splc, vAddr, "vestingContract");
  }
  const vestingAddr = await vesting.getAddress();

  // ── Step 4: Transfer SPLC to each bucket (idempotent) ─────────────────
  console.log("\n[4/4] Dispersing 1B SPLC...");
  const t = cfg.tokenomics;
  const v = cfg.vesting;
  const startTs = Math.floor(Date.now() / 1000);

  // Direct-transfer buckets (no vesting):
  const directBuckets = [
    { label: "stakingRewards",    target: wallets.stakingVault,   amount: pUnits(t.stakingRewards.splc)    },
    { label: "publicPresale",     target: wallets.publicPresale,  amount: pUnits(t.publicPresale.splc)     },
    { label: "airdropMerkle",     target: wallets.airdrop,        amount: pUnits(t.airdropMerkle.splc)     },
    { label: "lpSeed",            target: wallets.lpLockHolder,   amount: pUnits(t.lpSeed.splc)            },
    { label: "cexListingReserve", target: wallets.cexColdStorage, amount: pUnits(t.cexListingReserve.splc) },
  ];
  for (const b of directBuckets) {
    if (b.target === ethers.ZeroAddress) {
      console.log(`  [warn] ${b.label} target is zero address — skipping (set ${b.label.toUpperCase()} env)`);
      continue;
    }
    await transferIfBelow(splc, b.target, b.amount, b.label);
  }

  // Vested buckets: fund vesting contract once with their total, then createSchedule
  const vestedTotal =
    pUnits(t.founderTeam.splc) +
    pUnits(t.treasuryOps.splc) +
    pUnits(t.accreditedRegD.splc) +
    pUnits(t.ecosystemGrants.splc);

  await transferIfBelow(splc, vestingAddr, vestedTotal, "vestingContract(total)");

  const schedules = [
    { label: "founderTeam",     beneficiary: wallets.founder,      amount: pUnits(t.founderTeam.splc),     cliff: v.founderCliffSeconds,   duration: v.founderDurationSeconds   },
    { label: "treasuryOps",     beneficiary: wallets.treasury,     amount: pUnits(t.treasuryOps.splc),     cliff: v.treasuryCliffSeconds,  duration: v.treasuryDurationSeconds  },
    { label: "accreditedRegD",  beneficiary: wallets.accreditedVest, amount: pUnits(t.accreditedRegD.splc), cliff: v.regDCliffSeconds,     duration: v.regDDurationSeconds      },
    { label: "ecosystemGrants", beneficiary: wallets.daoTimelock,  amount: pUnits(t.ecosystemGrants.splc), cliff: v.ecosystemCliffSeconds, duration: v.ecosystemDurationSeconds },
  ];
  for (const s of schedules) {
    if (s.beneficiary === ethers.ZeroAddress) {
      console.log(`  [warn] ${s.label} beneficiary is zero address — skipping`);
      continue;
    }
    const existing = await vesting.schedules(s.beneficiary);
    if (existing.exists) {
      console.log(`  [skip] ${s.label} schedule already created for ${s.beneficiary}`);
      continue;
    }
    console.log(`  -> ${s.label}: ${ethers.formatUnits(s.amount, 18)} SPLC, cliff ${s.cliff/86400}d / dur ${s.duration/86400}d → ${s.beneficiary}`);
    const tx = await vesting.createSchedule(s.beneficiary, s.amount, startTs, s.cliff, s.duration);
    await tx.wait();
  }

  // ── Persist summary ───────────────────────────────────────────────────
  const out = {
    network: net,
    splc: dep.proxy,
    vesting: vestingAddr,
    wallets,
    distributedAt: new Date().toISOString(),
    tokenomics: t,
    notes: "Run is idempotent. Re-run after wallet/env changes to top up any new buckets."
  };
  const outFile = path.join(__dirname, "..", "deployments", net, "DistributionAll.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outFile);

  console.log("\nNext: deployPaymaster.js to sponsor end-user gas across the whole system.");
}

main().catch(e => { console.error(e); process.exit(1); });
