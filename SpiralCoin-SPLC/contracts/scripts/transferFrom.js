/**
 * SPLC transferFrom helper.
 *
 * Stage 1 (default, read-only):
 *   - Derives the spender address from DEPLOYER_PRIVATE_KEY.
 *   - Reads allowance(owner, spender) and balanceOf(owner) on TOKEN_ADDRESS.
 *   - Prints everything. Sends NOTHING.
 *
 * Stage 2 (only when EXECUTE=1):
 *   - Sends transferFrom(owner, recipient, amount) from the spender.
 *
 * Env required:
 *   SEPOLIA_RPC_URL              (or appropriate network RPC)
 *   DEPLOYER_PRIVATE_KEY         (the spender's key — must equal the approved address)
 *   TF_TOKEN_ADDRESS             (defaults to deployments/<network>.json tokenAddress)
 *   TF_OWNER                     (address that granted the approval)
 *   TF_RECIPIENT                 (where tokens should land)
 *   TF_AMOUNT                    (human units, e.g. "50")
 *   EXECUTE=1                    (only set this when you actually want to broadcast)
 */

const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];

async function main() {
  const hre = require("hardhat");
  const { ethers } = hre;

  const networkName = hre.network.name;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  const deployment = fs.existsSync(deploymentPath)
    ? JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
    : null;

  const tokenAddress = (process.env.TF_TOKEN_ADDRESS || deployment?.tokenAddress || "").trim();
  const owner = (process.env.TF_OWNER || "").trim();
  const recipient = (process.env.TF_RECIPIENT || "").trim();
  const amountHuman = (process.env.TF_AMOUNT || "").trim();

  if (!tokenAddress) throw new Error("Missing TF_TOKEN_ADDRESS (or deployments file)");
  if (!owner) throw new Error("Missing TF_OWNER");

  const [signer] = await ethers.getSigners();
  const spender = await signer.getAddress();

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const [symbol, decimals, ownerBal, allowance] = await Promise.all([
    token.symbol().catch(() => "?"),
    token.decimals().catch(() => 18),
    token.balanceOf(owner),
    token.allowance(owner, spender),
  ]);

  console.log("Network:        ", networkName);
  console.log("Token:          ", `${tokenAddress} (${symbol}, ${decimals} decimals)`);
  console.log("Spender (you):  ", spender);
  console.log("Owner:          ", owner);
  console.log("Owner balance:  ", ethers.formatUnits(ownerBal, decimals), symbol);
  console.log("Allowance:      ", ethers.formatUnits(allowance, decimals), symbol);

  if (!process.env.EXECUTE || process.env.EXECUTE !== "1") {
    console.log("\nDry run only. Re-run with EXECUTE=1 (and TF_RECIPIENT, TF_AMOUNT set) to broadcast.");
    return;
  }

  if (!recipient) throw new Error("Missing TF_RECIPIENT");
  if (!amountHuman) throw new Error("Missing TF_AMOUNT");

  const amountUnits = ethers.parseUnits(amountHuman, decimals);
  if (amountUnits > ownerBal) throw new Error(`Owner balance < requested amount`);
  if (amountUnits > allowance) throw new Error(`Allowance < requested amount`);

  console.log(`\nBroadcasting transferFrom(${owner}, ${recipient}, ${amountHuman} ${symbol})...`);
  const tx = await token.transferFrom(owner, recipient, amountUnits);
  console.log("Tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Mined in block:", receipt.blockNumber, "status:", receipt.status);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
