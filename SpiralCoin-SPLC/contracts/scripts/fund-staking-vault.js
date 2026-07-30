// Fund the SpiralStakingVault with SPLC from the Treasury wallet.
//
// PREREQ: Treasury wallet's private key must be added to .env as TREASURY_PRIVATE_KEY
//         (currently your .env only has DEPLOYER_PRIVATE_KEY and FOUNDER_PRIVATE_KEY).
//
// Run:
//   FUND_AMOUNT=50000000 npx hardhat run scripts/fund-staking-vault.js --network sepolia
//   FUND_AMOUNT=50000000 npx hardhat run scripts/fund-staking-vault.js --network arbitrumSepolia
//
// FUND_AMOUNT is in whole SPLC tokens (default: 50,000,000 = 5% of supply).

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { Wallet, parseUnits, formatUnits, Contract } = require("ethers");

async function main() {
  const net = hre.network.name;
  const file = path.join(__dirname, "..", "deployments", `${net}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment file: ${file}`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));

  const splcAddr  = dep.contracts.SpiralCoin;
  const vaultAddr = dep.contracts.SpiralStakingVault;
  const treasuryAddr = dep.wallets.treasury;

  const treasuryKey = process.env.TREASURY_PRIVATE_KEY;
  if (!treasuryKey) {
    throw new Error("TREASURY_PRIVATE_KEY missing in .env. Add it before running this script.");
  }

  const provider = hre.ethers.provider;
  const treasury = new Wallet(treasuryKey.startsWith("0x") ? treasuryKey : "0x" + treasuryKey, provider);
  const treasuryAddrFromKey = await treasury.getAddress();
  if (treasuryAddrFromKey.toLowerCase() !== treasuryAddr.toLowerCase()) {
    throw new Error(`TREASURY_PRIVATE_KEY derives ${treasuryAddrFromKey}, but deployments file says treasury is ${treasuryAddr}`);
  }

  const splc = new Contract(splcAddr, [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address,uint256) returns (bool)",
  ], treasury);

  const [dec, sym, treasuryBal, vaultBal] = await Promise.all([
    splc.decimals(), splc.symbol(),
    splc.balanceOf(treasuryAddr), splc.balanceOf(vaultAddr),
  ]);

  const amount = parseUnits(process.env.FUND_AMOUNT || "50000000", dec);

  console.log(`Network          : ${net}`);
  console.log(`Treasury         : ${treasuryAddr}`);
  console.log(`Vault            : ${vaultAddr}`);
  console.log(`Treasury balance : ${Number(formatUnits(treasuryBal, dec)).toLocaleString()} ${sym}`);
  console.log(`Vault balance    : ${Number(formatUnits(vaultBal, dec)).toLocaleString()} ${sym}`);
  console.log(`Funding amount   : ${Number(formatUnits(amount, dec)).toLocaleString()} ${sym}`);

  if (treasuryBal < amount) throw new Error("Treasury has insufficient SPLC.");

  const tx = await splc.transfer(vaultAddr, amount);
  console.log(`Tx sent          : ${tx.hash}`);
  const r = await tx.wait();
  console.log(`Confirmed block  : ${r.blockNumber}  status=${r.status === 1 ? "OK" : "FAIL"}`);

  const newVaultBal = await splc.balanceOf(vaultAddr);
  console.log(`New vault balance: ${Number(formatUnits(newVaultBal, dec)).toLocaleString()} ${sym}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
