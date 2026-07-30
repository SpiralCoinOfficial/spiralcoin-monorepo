// SPDX-License-Identifier: MIT
//
// scripts/deploy-testnet.js
// ─────────────────────────
// One-shot testnet deploy that wires the full SPLC stack:
//
//   1. SpiralCoinUpgradeable        (UUPS proxy, OFT V2)
//   2. SPLCPresaleVesting           (linear vesting w/ cliff)
//   3. SPLCStakingVault             (time-proportional rewards)
//   4. SPLCPresalePublic            (instant or vested presale)
//   5. SPLCAirdropMerkle            (proof-of-claim allowlist)
//
// Funds: seeds vault/presale/airdrop from premine balance.
// Output: writes deployments/<network>.json.
//
// SAFETY:
//   - Aborts on mainnet (use deployUpgradeable.js + audited multisig there).
//   - All ownerships stay with the deployer for testnet QA. Rotate to a
//     Timelock/multisig before any mainnet promotion.
//   - LZ peers NOT wired here. Run scripts/wireOftPeers.js after both
//     chains are deployed.
//
// Usage:
//   npx hardhat run scripts/deploy-testnet.js --network arbitrumSepolia
//   npx hardhat run scripts/deploy-testnet.js --network baseSepolia
//   npx hardhat run scripts/deploy-testnet.js --network sepolia
//
// Required env (testnet wallets only — never use mainnet keys):
//   DEPLOYER_PRIVATE_KEY        — funded testnet account (~0.05 ETH)
//   TREASURY_WALLET             — 50% AMM tax sink + presale ETH receiver
//   STAKING_VAULT_OWNER         — (optional) owner of staking vault, default deployer
//
// Optional env (defaults provided for QA):
//   PRESALE_START_DELAY_MIN     — minutes from now until sale opens (default 10)
//   PRESALE_DURATION_DAYS       — sale length in days (default 14)
//   AIRDROP_DURATION_DAYS       — claim window length (default 30)
//   PRESALE_SPLC_PER_ETH        — price (default 100_000 SPLC/ETH = $0.03 @ $3k ETH)
//   PRESALE_HARD_CAP_ETH        — hard cap in ETH (default 10)
//   PRESALE_MIN_ETH             — per-wallet min (default 0.05)
//   PRESALE_MAX_ETH             — per-wallet max (default 2)
//   PRESALE_VESTING_DAYS        — 0 = instant, >0 = linear over N days (default 0)
//   PRESALE_FUND_SPLC           — SPLC seeded to presale (default 1_000_000)
//   STAKING_FUND_SPLC           — SPLC seeded to staking reward pool (default 5_000_000)
//   AIRDROP_FUND_SPLC           — SPLC seeded to airdrop (default 500_000)
//   AIRDROP_MERKLE_ROOT         — optional; if unset, owner must set later
//

const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// LayerZero V2 endpoints — testnets only here (we abort on mainnet).
const LZ_TESTNET_ENDPOINTS = {
  sepolia:         "0x6EDCE65403992e310A62460808c4b910D972f10f",
  arbitrumSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  baseSepolia:     "0x6EDCE65403992e310A62460808c4b910D972f10f",
  optimismSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  polygonAmoy:     "0x6EDCE65403992e310A62460808c4b910D972f10f",
  bscTestnet:      "0x6EDCE65403992e310A62460808c4b910D972f10f",
};

const MAINNETS = new Set(["mainnet", "arbitrum", "base", "polygon", "optimism", "bsc"]);

const E = (n) => ethers.parseUnits(String(n), 18);
const ETH = (n) => ethers.parseEther(String(n));

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function opt(name, fallback) {
  const v = process.env[name];
  return (v === undefined || v === "") ? fallback : v;
}

async function main() {
  const net = network.name;

  if (MAINNETS.has(net)) {
    throw new Error(
      `deploy-testnet.js refuses to run on mainnet "${net}". ` +
      `Use scripts/deployUpgradeable.js with an audited multisig instead.`
    );
  }

  const lzEndpoint = LZ_TESTNET_ENDPOINTS[net];
  if (!lzEndpoint) {
    throw new Error(`No LayerZero testnet endpoint configured for network: ${net}`);
  }

  const [deployer] = await ethers.getSigners();
  const deployerBal = await ethers.provider.getBalance(deployer.address);

  console.log("──────────────────────────────────────────────────────────────");
  console.log(`Network:     ${net}`);
  console.log(`LZ Endpoint: ${lzEndpoint}`);
  console.log(`Deployer:    ${deployer.address}`);
  console.log(`Balance:     ${ethers.formatEther(deployerBal)} ETH`);
  console.log("──────────────────────────────────────────────────────────────");

  if (deployerBal < ETH("0.02")) {
    throw new Error("Deployer balance < 0.02 ETH — top up from faucet first.");
  }

  const treasury = req("TREASURY_WALLET");
  if (!ethers.isAddress(treasury)) throw new Error("TREASURY_WALLET is not a valid address");

  // ── Step 1: SpiralCoinUpgradeable (UUPS) ─────────────────────────────
  console.log("\n[1/5] Deploying SpiralCoinUpgradeable (UUPS proxy)…");

  // Use a TEMPORARY staking vault address (deployer) so init succeeds,
  // we'll point it at the real vault via setFeeReceivers in step 6.
  const PREMINE = E(opt("TESTNET_PREMINE_SPLC", "100000000")); // 100M
  const FOUNDER = E(opt("TESTNET_FOUNDER_SPLC", "0"));

  const Splc = await ethers.getContractFactory("SpiralCoinUpgradeable");
  const splc = await upgrades.deployProxy(
    Splc,
    [
      deployer.address,    // premineWallet (deployer holds initial supply for testnet wiring)
      PREMINE,
      ethers.ZeroAddress,  // founderWallet (skip on testnet)
      FOUNDER,
      treasury,
      deployer.address,    // staking vault — TEMP; rewired in step 6
      deployer.address,    // initialOwner (testnet only)
    ],
    {
      kind: "uups",
      constructorArgs: [lzEndpoint],
      unsafeAllow: [
        "constructor",
        "state-variable-immutable",
        "missing-initializer-call",
        "missing-public-upgradeable",
        // LayerZero's @layerzerolabs/oft-evm-upgradeable __OFT_init initializes
        // ERC20Upgradeable before OAppCoreUpgradeable, which violates C3
        // linearization order. The library is upstream; we cannot fix it here.
        "incorrect-initializer-order",
      ],
    }
  );
  await splc.waitForDeployment();
  const splcAddr = await splc.getAddress();
  console.log(`     SPLC proxy:           ${splcAddr}`);

  // ── Step 2: SPLCPresaleVesting ───────────────────────────────────────
  console.log("\n[2/5] Deploying SPLCPresaleVesting…");
  const Vesting = await ethers.getContractFactory("SPLCPresaleVesting");
  const vesting = await Vesting.deploy(splcAddr, deployer.address);
  await vesting.waitForDeployment();
  const vestingAddr = await vesting.getAddress();
  console.log(`     SPLCPresaleVesting:   ${vestingAddr}`);

  // ── Step 3: SPLCStakingVault ─────────────────────────────────────────
  console.log("\n[3/5] Deploying SPLCStakingVault…");
  const Vault = await ethers.getContractFactory("SPLCStakingVault");
  const vault = await Vault.deploy(splcAddr, deployer.address);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`     SPLCStakingVault:     ${vaultAddr}`);

  // ── Step 4: SPLCPresalePublic ────────────────────────────────────────
  console.log("\n[4/5] Deploying SPLCPresalePublic…");
  const startDelayMin = parseInt(opt("PRESALE_START_DELAY_MIN", "10"), 10);
  const durationDays  = parseInt(opt("PRESALE_DURATION_DAYS", "14"), 10);
  const vestingDays   = parseInt(opt("PRESALE_VESTING_DAYS", "0"), 10);

  const now        = Math.floor(Date.now() / 1000);
  const startTime  = now + startDelayMin * 60;
  const endTime    = startTime + durationDays * 86400;
  const vestingDur = vestingDays * 86400;
  const vestingStart = vestingDur > 0 ? endTime : 0;

  const splcPerEth = E(opt("PRESALE_SPLC_PER_ETH", "100000")); // 100k SPLC / ETH
  const hardCapEth = ETH(opt("PRESALE_HARD_CAP_ETH", "10"));
  const minEth     = ETH(opt("PRESALE_MIN_ETH", "0.05"));
  const maxEth     = ETH(opt("PRESALE_MAX_ETH", "2"));

  const Presale = await ethers.getContractFactory("SPLCPresalePublic");
  const presale = await Presale.deploy(
    splcAddr,
    deployer.address,
    treasury,
    splcPerEth,
    hardCapEth,
    minEth,
    maxEth,
    startTime,
    endTime,
    vestingDur,
    vestingStart
  );
  await presale.waitForDeployment();
  const presaleAddr = await presale.getAddress();
  console.log(`     SPLCPresalePublic:    ${presaleAddr}`);
  console.log(`     Sale window:          ${new Date(startTime * 1000).toISOString()}`);
  console.log(`                        →  ${new Date(endTime * 1000).toISOString()}`);
  console.log(`     Vesting:              ${vestingDays} days (0 = instant)`);

  // ── Step 5: SPLCAirdropMerkle ────────────────────────────────────────
  console.log("\n[5/5] Deploying SPLCAirdropMerkle…");
  const airdropDays = parseInt(opt("AIRDROP_DURATION_DAYS", "30"), 10);
  const airdropDeadline = now + airdropDays * 86400;
  const Airdrop = await ethers.getContractFactory("SPLCAirdropMerkle");
  const airdrop = await Airdrop.deploy(splcAddr, deployer.address, airdropDeadline);
  await airdrop.waitForDeployment();
  const airdropAddr = await airdrop.getAddress();
  console.log(`     SPLCAirdropMerkle:    ${airdropAddr}`);
  console.log(`     Deadline:             ${new Date(airdropDeadline * 1000).toISOString()}`);

  // ── Step 6: Wire fee receivers + seed funding ────────────────────────
  console.log("\n[wire] Pointing SPLC.setFeeReceivers(treasury, stakingVault) → real vault…");
  let tx = await splc.setFeeReceivers(treasury, vaultAddr);
  await tx.wait();

  const fundPresale = E(opt("PRESALE_FUND_SPLC", "1000000"));
  const fundStaking = E(opt("STAKING_FUND_SPLC", "5000000"));
  const fundAirdrop = E(opt("AIRDROP_FUND_SPLC", "500000"));
  const totalFund = fundPresale + fundStaking + fundAirdrop;

  const deployerSplc = await splc.balanceOf(deployer.address);
  if (deployerSplc < totalFund) {
    throw new Error(
      `Deployer SPLC balance ${ethers.formatUnits(deployerSplc, 18)} < required ` +
      `${ethers.formatUnits(totalFund, 18)} for seeding. Increase TESTNET_PREMINE_SPLC.`
    );
  }

  console.log(`[wire] Seeding presale  with ${ethers.formatUnits(fundPresale, 18)} SPLC…`);
  tx = await splc.transfer(presaleAddr, fundPresale); await tx.wait();

  console.log(`[wire] Seeding staking  with ${ethers.formatUnits(fundStaking, 18)} SPLC…`);
  tx = await splc.transfer(vaultAddr, fundStaking); await tx.wait();

  console.log(`[wire] Seeding airdrop  with ${ethers.formatUnits(fundAirdrop, 18)} SPLC…`);
  tx = await splc.transfer(airdropAddr, fundAirdrop); await tx.wait();

  const merkleRoot = process.env.AIRDROP_MERKLE_ROOT;
  if (merkleRoot && /^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) {
    console.log(`[wire] Setting airdrop merkle root: ${merkleRoot}`);
    tx = await airdrop.setMerkleRoot(merkleRoot, airdropDeadline);
    await tx.wait();
  } else {
    console.log("[wire] No AIRDROP_MERKLE_ROOT set — owner must call setMerkleRoot() later.");
  }

  // Exempt the helper contracts from the AMM tax (they are not AMM pairs but
  // pre-emptively flagging them is harmless and prevents accidental fees if
  // someone marks one as an AMM pair by mistake).
  for (const [name, addr] of [["presale", presaleAddr], ["airdrop", airdropAddr], ["vesting", vestingAddr]]) {
    if (!(await splc.isFeeExempt(addr))) {
      console.log(`[wire] Marking ${name} fee-exempt…`);
      tx = await splc.setFeeExempt(addr, true); await tx.wait();
    }
  }

  // ── Persist deployment record ────────────────────────────────────────
  const out = {
    network: net,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    lzEndpoint,
    contracts: {
      SpiralCoinUpgradeable: splcAddr,
      SPLCPresaleVesting:    vestingAddr,
      SPLCStakingVault:      vaultAddr,
      SPLCPresalePublic:     presaleAddr,
      SPLCAirdropMerkle:     airdropAddr,
    },
    config: {
      treasury,
      premineSplc:    PREMINE.toString(),
      presaleStart:   startTime,
      presaleEnd:     endTime,
      vestingDays,
      splcPerEth:     splcPerEth.toString(),
      hardCapEth:     hardCapEth.toString(),
      minEth:         minEth.toString(),
      maxEth:         maxEth.toString(),
      airdropDeadline,
      fundPresale:    fundPresale.toString(),
      fundStaking:    fundStaking.toString(),
      fundAirdrop:    fundAirdrop.toString(),
      merkleRootSet:  Boolean(merkleRoot),
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${net}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));

  console.log("\n──────────────────────────────────────────────────────────────");
  console.log("Deployment complete. Saved record:");
  console.log(`  ${outFile}`);
  console.log("──────────────────────────────────────────────────────────────");
  console.log("\nNext steps:");
  console.log("  • Verify contracts:    npx hardhat run scripts/verify-testnet.js --network", net);
  console.log("  • Wire LZ peers:       npx hardhat run scripts/wireOftPeers.js --network", net);
  console.log("  • Transfer ownership:  rotate SPLC + helpers to a Gnosis Safe / Timelock.");
  console.log("  • For mainnet:         use deployUpgradeable.js + audited multisig only.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
