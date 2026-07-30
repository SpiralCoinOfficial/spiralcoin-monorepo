// SPDX-License-Identifier: MIT
// consolidateSupply.js  —  one-shot fix when 1B SPLC was minted to a non-deployer
// wallet (e.g. SUPPLY_VAULT=founder). Funds founder with gas if needed, then
// uses founder signer to transfer the entire SPLC balance to the deployer.
// Idempotent: skips both steps if already done.
//
// Usage:
//   $env:NODE_OPTIONS=""
//   npx hardhat run scripts/consolidateSupply.js --network arbitrum
//
// Requires .env: DEPLOYER_PRIVATE_KEY, FOUNDER_PRIVATE_KEY

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const GAS_TOPUP_WEI = ethers.parseEther("0.0005"); // ~$1 on Arb/Base, enough for 10+ ERC20 txs
const FOUNDER_MIN_WEI = ethers.parseEther("0.0001"); // top up if below this

async function loadDeployment(net, name) {
  const f = path.join(__dirname, "..", "deployments", net, `${name}.json`);
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}`);
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

async function main() {
  const net = network.name;
  const dep = await loadDeployment(net, "SpiralCoinUpgradeable");

  const provider = ethers.provider;
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  const founderKey  = process.env.FOUNDER_PRIVATE_KEY;
  if (!deployerKey || !founderKey) throw new Error("Need DEPLOYER_PRIVATE_KEY and FOUNDER_PRIVATE_KEY in .env");

  const deployer = new ethers.Wallet(deployerKey, provider);
  const founder  = new ethers.Wallet(founderKey, provider);

  console.log(`\n=== consolidateSupply :: ${net} ===`);
  console.log("Deployer:", deployer.address);
  console.log("Founder :", founder.address);
  console.log("SPLC    :", dep.proxy);

  const splcAbi = [
    "function balanceOf(address) view returns(uint256)",
    "function transfer(address,uint256) returns(bool)",
    "function isFeeExempt(address) view returns(bool)",
    "function setFeeExempt(address,bool)",
    "function owner() view returns(address)",
  ];
  const splcFounder  = new ethers.Contract(dep.proxy, splcAbi, founder);
  const splcDeployer = new ethers.Contract(dep.proxy, splcAbi, deployer);

  // ── Step 0: ensure founder is fee-exempt so the 3.14% tax doesn't burn supply ──
  const isExempt = await splcDeployer.isFeeExempt(founder.address);
  if (!isExempt) {
    console.log("\n[1/3] Fee-exempting founder so transfer is loss-less...");
    const tx = await splcDeployer.setFeeExempt(founder.address, true);
    console.log("      tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("\n[1/3] Founder already fee-exempt — skip");
  }

  // ── Step 1: fund founder with gas if needed ──
  const founderGas = await provider.getBalance(founder.address);
  console.log(`\n[2/3] Founder gas: ${ethers.formatEther(founderGas)} ETH`);
  if (founderGas < FOUNDER_MIN_WEI) {
    console.log(`      Topping up with ${ethers.formatEther(GAS_TOPUP_WEI)} ETH from deployer...`);
    const fundTx = await deployer.sendTransaction({ to: founder.address, value: GAS_TOPUP_WEI });
    console.log("      tx:", fundTx.hash);
    await fundTx.wait();
  } else {
    console.log("      Sufficient — skip top-up");
  }

  // ── Step 2: transfer entire SPLC balance from founder → deployer ──
  const founderBal = await splcFounder.balanceOf(founder.address);
  console.log(`\n[3/3] Founder SPLC bal: ${ethers.formatUnits(founderBal, 18)}`);
  if (founderBal === 0n) {
    console.log("      Nothing to move — done");
  } else {
    console.log(`      Transferring all to deployer ${deployer.address}...`);
    const moveTx = await splcFounder.transfer(deployer.address, founderBal);
    console.log("      tx:", moveTx.hash);
    await moveTx.wait();
  }

  const deployerBal = await splcDeployer.balanceOf(deployer.address);
  console.log(`\n✓ Deployer now holds: ${ethers.formatUnits(deployerBal, 18)} SPLC`);
  console.log("✓ Ready to run distributeAll");
}

main().catch((e) => { console.error(e); process.exit(1); });
