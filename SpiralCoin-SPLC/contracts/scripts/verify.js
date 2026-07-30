const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

async function main() {
  const hre = require("hardhat");
  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Missing deployment file: ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const [premineWallet, premineAmount, founderWallet, founderAmount] = deployment.constructorArgs;

  await hre.run("verify:verify", {
    address: deployment.tokenAddress,
    constructorArguments: [premineWallet, premineAmount, founderWallet, founderAmount],
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
