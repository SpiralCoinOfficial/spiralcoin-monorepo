const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

async function main() {
  const hre = require("hardhat");

  const supplyVaultWallet = (process.env.SUPPLY_VAULT_WALLET || process.env.PREMINE_WALLET || "").trim();
  const founderWallet = (process.env.FOUNDER_WALLET || "").trim();
  const premineAmount = (process.env.PREMINE_AMOUNT || process.env.CIRCULATING_SUPPLY || "").trim();
  const founderAmount = (process.env.FOUNDER_AMOUNT || process.env.FOUNDER_SUPPLY || "").trim();
  const declaredTotalSupply = (process.env.TOTAL_SUPPLY || "").trim();

  if (!supplyVaultWallet || !founderWallet) {
    throw new Error("Set SUPPLY_VAULT_WALLET (or PREMINE_WALLET) and FOUNDER_WALLET in .env");
  }
  if (!premineAmount && !founderAmount) {
    throw new Error("Set PREMINE_AMOUNT and/or FOUNDER_AMOUNT in .env");
  }

  const premineUnits = premineAmount ? hre.ethers.parseUnits(premineAmount, 18) : 0n;
  const founderUnits = founderAmount ? hre.ethers.parseUnits(founderAmount, 18) : 0n;
  const computedTotalUnits = premineUnits + founderUnits;

  if (declaredTotalSupply) {
    const declaredTotalUnits = hre.ethers.parseUnits(declaredTotalSupply, 18);
    if (declaredTotalUnits !== computedTotalUnits) {
      throw new Error(
        `TOTAL_SUPPLY (${declaredTotalSupply}) does not match PREMINE_AMOUNT + FOUNDER_AMOUNT (${hre.ethers.formatUnits(computedTotalUnits, 18)})`
      );
    }
  }

  const SpiralCoin = await hre.ethers.getContractFactory("SpiralCoin");
  const token = await SpiralCoin.deploy(supplyVaultWallet, premineUnits, founderWallet, founderUnits);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const net = await hre.ethers.provider.getNetwork();

  const deployment = {
    network: hre.network.name,
    chainId: Number(net.chainId),
    tokenAddress,
    constructorArgs: [
      supplyVaultWallet,
      premineUnits.toString(),
      founderWallet,
      founderUnits.toString(),
    ],
    totals: {
      premine: premineAmount || "0",
      founder: founderAmount || "0",
      supply: hre.ethers.formatUnits(computedTotalUnits, 18),
      decimals: 18,
    },
    wallets: {
      supplyVault: supplyVaultWallet,
      founder: founderWallet,
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${hre.network.name}.json`), JSON.stringify(deployment, null, 2));

  console.log(`Deployed SpiralCoin (SPLC) to ${tokenAddress} on ${hre.network.name} (chainId=${deployment.chainId})`);
  console.log(`Supply vault: ${deployment.totals.premine} SPLC -> ${supplyVaultWallet}`);
  console.log(`Founder: ${deployment.totals.founder} SPLC -> ${founderWallet}`);
  console.log(`Total supply: ${deployment.totals.supply} SPLC`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
