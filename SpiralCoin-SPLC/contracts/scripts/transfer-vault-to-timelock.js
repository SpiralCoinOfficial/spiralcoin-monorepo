// Transfer SpiralStakingVault ownership from the current EOA owner
// to the TimelockController so the DAO controls the vault.
//
// Run:
//   npx hardhat run scripts/transfer-vault-to-timelock.js --network sepolia
//   npx hardhat run scripts/transfer-vault-to-timelock.js --network arbitrumSepolia
//
// NOTE: signer 0 must currently be the vault owner.
//   - sepolia        → Deployer (uses DEPLOYER_PRIVATE_KEY)
//   - arbitrumSepolia → Founder  (uses FOUNDER_PRIVATE_KEY, per hardhat.config.js)

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const net = hre.network.name;
  const file = path.join(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment file: ${file}`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));

  const vaultAddr = dep.contracts.SpiralStakingVault;
  const timelockAddr = dep.contracts.TimelockController;
  if (!vaultAddr || !timelockAddr) throw new Error("Missing vault or timelock in deployments file");

  const [signer] = await hre.ethers.getSigners();
  console.log(`Network        : ${net}`);
  console.log(`Signer         : ${await signer.getAddress()}`);
  console.log(`Vault          : ${vaultAddr}`);
  console.log(`New owner (TL) : ${timelockAddr}`);

  const vault = await hre.ethers.getContractAt(
    ["function owner() view returns (address)", "function transferOwnership(address) external"],
    vaultAddr,
    signer
  );

  const currentOwner = await vault.owner();
  console.log(`Current owner  : ${currentOwner}`);
  if (currentOwner.toLowerCase() === timelockAddr.toLowerCase()) {
    console.log("Vault is already owned by the Timelock. Nothing to do.");
    return;
  }
  if (currentOwner.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
    throw new Error(`Signer is not the current owner. Cannot transfer.`);
  }

  const tx = await vault.transferOwnership(timelockAddr);
  console.log(`Tx sent        : ${tx.hash}`);
  const r = await tx.wait();
  console.log(`Confirmed block: ${r.blockNumber}  status=${r.status === 1 ? "OK" : "FAIL"}`);

  const newOwner = await vault.owner();
  console.log(`New owner      : ${newOwner}  ${newOwner.toLowerCase() === timelockAddr.toLowerCase() ? "✅" : "❌"}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
