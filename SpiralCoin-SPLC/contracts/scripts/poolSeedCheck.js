/**
 * Read-only check for the DEPLOYER wallet:
 * - Derives address from DEPLOYER_PRIVATE_KEY
 * - Checks native ETH balance on Arbitrum One
 * - Checks SPLC balance on Arbitrum One
 * - Checks USDC (native Circle, 0xaf88...5831) balance on Arbitrum One
 * - Checks USDC.e (bridged, 0xff97...8) balance on Arbitrum One
 *
 * Usage:
 *   cd contracts
 *   node scripts/poolSeedCheck.js
 *
 * Requires DEPLOYER_PRIVATE_KEY in contracts/.env
 */

const { ethers } = require("ethers");
require("dotenv").config();

const ARB_RPC = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

const SPLC   = "0x8e45cc9F480257a1477976848d41A6A9Fb2cf27C";
const USDC   = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // native Circle USDC on Arbitrum
const USDCE  = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"; // bridged USDC.e (older)

const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function tokBal(provider, token, addr) {
  try {
    const c = new ethers.Contract(token, ERC20, provider);
    const [bal, dec, sym] = await Promise.all([
      c.balanceOf(addr),
      c.decimals().catch(() => 18),
      c.symbol().catch(() => "?")
    ]);
    return { sym, dec: Number(dec), bal, human: ethers.formatUnits(bal, dec) };
  } catch (e) {
    return { sym: "?", dec: 0, bal: 0n, human: "error: " + e.message };
  }
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error("DEPLOYER_PRIVATE_KEY missing in .env"); process.exit(1); }
  const wallet = new ethers.Wallet(pk.startsWith("0x") ? pk : "0x" + pk);
  const addr = wallet.address;

  const provider = new ethers.JsonRpcProvider(ARB_RPC);

  const [eth, splc, usdc, usdce] = await Promise.all([
    provider.getBalance(addr),
    tokBal(provider, SPLC,  addr),
    tokBal(provider, USDC,  addr),
    tokBal(provider, USDCE, addr)
  ]);

  console.log("");
  console.log("=== DEPLOYER WALLET ON ARBITRUM ONE ===");
  console.log("Address       :", addr);
  console.log("View          : https://arbiscan.io/address/" + addr);
  console.log("");
  console.log("Native ETH    :", ethers.formatEther(eth), "ETH");
  console.log("SPLC          :", splc.human, splc.sym);
  console.log("USDC (native) :", usdc.human, usdc.sym);
  console.log("USDC.e (old)  :", usdce.human, usdce.sym);
  console.log("");

  // Sanity: minimum gas to do create-pool + approve x2 + mint = ~$0.50 on Arbitrum
  if (eth < ethers.parseEther("0.001")) {
    console.log("WARNING: ETH < 0.001 — may not cover gas for create-pool + 2 approvals + mint.");
  }
  if (splc.bal === 0n) {
    console.log("WARNING: 0 SPLC in deployer wallet. SPLC must be moved here from the holding wallet first.");
  }
  if (usdc.bal === 0n && usdce.bal === 0n) {
    console.log("WARNING: 0 USDC and 0 USDC.e — bridge or transfer USDC to this wallet before pool creation.");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
