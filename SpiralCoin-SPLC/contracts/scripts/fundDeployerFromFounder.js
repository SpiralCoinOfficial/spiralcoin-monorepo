// One-shot helper: deployer funds founder w/ gas, then founder sends all SPLC to deployer.
// This unblocks distributeAll when the initial mint went to FOUNDER_WALLET instead of deployer.
//
// Usage: npx hardhat run scripts/fundDeployerFromFounder.js --network <net>

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

async function main() {
  const deploymentPath = path.join(
    __dirname, "..", "deployments", network.name, "SpiralCoinUpgradeable.json"
  );
  if (!fs.existsSync(deploymentPath)) throw new Error(`No deployment at ${deploymentPath}`);
  const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const PROXY = dep.proxy || dep.address;
  if (!PROXY) throw new Error("Deployment JSON missing 'proxy' field");
  console.log(`Network : ${network.name}`);
  console.log(`SPLC    : ${PROXY}`);

  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;

  const fKey = process.env.FOUNDER_PRIVATE_KEY;
  if (!fKey) throw new Error("FOUNDER_PRIVATE_KEY missing");
  const founder = new ethers.Wallet(fKey.startsWith("0x") ? fKey : "0x" + fKey, provider);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Founder : ${founder.address}`);

  const splc = new ethers.Contract(PROXY, ABI, provider);
  const fSPLC = await splc.balanceOf(founder.address);
  const dSPLC = await splc.balanceOf(deployer.address);
  console.log(`Founder SPLC : ${ethers.formatUnits(fSPLC, 18)}`);
  console.log(`Deployer SPLC: ${ethers.formatUnits(dSPLC, 18)}`);
  if (fSPLC === 0n) {
    console.log("Founder holds no SPLC — nothing to forward.");
    return;
  }

  // Estimate gas for the SPLC transfer (signed as founder)
  const splcAsFounder = splc.connect(founder);
  const transferGas = await splcAsFounder.transfer.estimateGas(deployer.address, fSPLC);
  const fee = await provider.getFeeData();
  const gasPrice = fee.gasPrice ?? fee.maxFeePerGas;
  const needed = (transferGas * gasPrice * 50n) / 10n; // 5x buffer for L2 gas-price spikes
  const have = await provider.getBalance(founder.address);
  console.log(`Founder ETH  : ${ethers.formatEther(have)}`);
  console.log(`Needed gas   : ${ethers.formatEther(needed)} (gas=${transferGas} price=${gasPrice})`);

  if (have < needed) {
    const topup = needed - have;
    console.log(`[1/2] Deployer → founder gas top-up: ${ethers.formatEther(topup)} ETH`);
    const tx0 = await deployer.sendTransaction({ to: founder.address, value: topup });
    console.log(`      tx: ${tx0.hash}`);
    await tx0.wait();
  } else {
    console.log(`[1/2] Founder already has enough gas; skip top-up.`);
  }

  console.log(`[2/2] Founder → deployer transfer of ${ethers.formatUnits(fSPLC, 18)} SPLC`);
  const tx1 = await splcAsFounder.transfer(deployer.address, fSPLC);
  console.log(`      tx: ${tx1.hash}`);
  await tx1.wait();

  const after = await splc.balanceOf(deployer.address);
  console.log(`Deployer SPLC after: ${ethers.formatUnits(after, 18)}`);
  console.log("Done. Now run: npx hardhat run scripts/distributeAll.js --network " + network.name);
}

main().catch((e) => { console.error(e); process.exit(1); });
