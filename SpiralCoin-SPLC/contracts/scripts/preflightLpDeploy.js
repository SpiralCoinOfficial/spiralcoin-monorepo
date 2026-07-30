// SPDX-License-Identifier: MIT
// Preflight checks for deployLpAndLock.js — runs all the verifications that
// would otherwise blow up partway through the real deploy. SAFE: does no writes,
// no approvals, no transactions. Only reads.
//
// Usage:
//   npx hardhat run scripts/preflightLpDeploy.js --network arbitrum
//   npx hardhat run scripts/preflightLpDeploy.js --network arbitrumSepolia
//
// Exit code 0 = all checks pass, safe to run deployLpAndLock.js next.
// Exit code 1 = at least one check failed; deploy would crash or lose money.

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const UNIV3 = {
  arbitrum:        { usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984", posManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" },
  arbitrumSepolia: { usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", factory: "0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e", posManager: "0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65" },
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const fail = [];
const warn = [];
const ok = [];

function check(cond, okMsg, failMsg) { (cond ? ok : fail).push(cond ? okMsg : failMsg); }
function warnIf(cond, msg) { if (cond) warn.push(msg); }

async function main() {
  const net = network.name;
  const u = UNIV3[net];
  console.log(`\n=== LP DEPLOY PREFLIGHT — network: ${net} ===\n`);

  // 1. Network config
  if (!u) { fail.push(`No Uniswap V3 config for network "${net}". Supported: ${Object.keys(UNIV3).join(", ")}.`); return finish(); }
  ok.push(`Uniswap V3 config found for ${net}`);

  // 2. Signer
  let deployer;
  try {
    [deployer] = await ethers.getSigners();
    if (!deployer) throw new Error("no signer");
    ok.push(`Signer loaded: ${deployer.address}`);
  } catch (e) {
    fail.push(`No signer available. Did you set DEPLOYER_PRIVATE_KEY (or FOUNDER_PRIVATE_KEY for testnet) in contracts/.env? Error: ${e.message}`);
    return finish();
  }

  // 3. SPLC deployment record
  const depFile = path.join(__dirname, "..", "deployments", net, "SpiralCoinUpgradeable.json");
  let splcAddr;
  if (!fs.existsSync(depFile)) {
    fail.push(`Missing deployment file: ${depFile}. The deploy script reads this to find the SPLC proxy. Create it with {"proxy":"0x..."}.`);
  } else {
    try {
      const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));
      if (!dep.proxy || !/^0x[0-9a-fA-F]{40}$/.test(dep.proxy)) throw new Error("invalid or missing .proxy field");
      splcAddr = dep.proxy;
      ok.push(`SPLC proxy address: ${splcAddr}`);
    } catch (e) {
      fail.push(`Bad deployment file ${depFile}: ${e.message}`);
    }
  }

  // 4. Env vars
  const requiredEnv = ["LP_SPLC_AMOUNT", "LP_PAIRED_USDC", "LP_LOCK_DURATION_SEC", "TREASURY_WALLET"];
  for (const v of requiredEnv) {
    if (!process.env[v] || process.env[v].trim() === "") fail.push(`Env var ${v} is not set. See contracts/.env.example for the template.`);
    else ok.push(`Env var ${v} = ${process.env[v]}`);
  }
  if (process.env.TREASURY_WALLET && !/^0x[0-9a-fA-F]{40}$/.test(process.env.TREASURY_WALLET)) {
    fail.push(`TREASURY_WALLET is not a valid address: ${process.env.TREASURY_WALLET}`);
  }
  const lockSec = parseInt(process.env.LP_LOCK_DURATION_SEC || "0", 10);
  if (lockSec && lockSec < 31536000) warn.push(`LP_LOCK_DURATION_SEC = ${lockSec} (< 12 months). Public commitment is 12-month minimum.`);

  // 5. RPC reachability
  let blockNum;
  try {
    blockNum = await ethers.provider.getBlockNumber();
    ok.push(`RPC reachable. Current block: ${blockNum}`);
  } catch (e) {
    fail.push(`RPC unreachable for network ${net}. Check ARBITRUM_RPC_URL or ALCHEMY_API_KEY. Error: ${e.message}`);
    return finish();
  }

  // 6. Balances (only if we got this far)
  if (!splcAddr) return finish();

  const ethBal = await ethers.provider.getBalance(deployer.address);
  const ethHuman = ethers.formatEther(ethBal);
  if (ethBal < ethers.parseEther("0.005")) fail.push(`ETH for gas too low: ${ethHuman} ETH. Need ≥ 0.005 ETH on ${net}.`);
  else ok.push(`ETH for gas: ${ethHuman}`);

  let splcBal, splcDecimals = 18, splcSymbol = "?";
  try {
    const splc = new ethers.Contract(splcAddr, ERC20_ABI, deployer);
    splcBal = await splc.balanceOf(deployer.address);
    splcSymbol = await splc.symbol();
    splcDecimals = await splc.decimals();
    const needSplc = ethers.parseUnits(process.env.LP_SPLC_AMOUNT || "0", splcDecimals);
    if (splcBal < needSplc) fail.push(`${splcSymbol} balance too low: have ${ethers.formatUnits(splcBal, splcDecimals)}, need ${process.env.LP_SPLC_AMOUNT}.`);
    else ok.push(`${splcSymbol} balance: ${ethers.formatUnits(splcBal, splcDecimals)} (need ${process.env.LP_SPLC_AMOUNT})`);
  } catch (e) {
    fail.push(`Could not read SPLC balance at ${splcAddr}: ${e.message}`);
  }

  try {
    const usdc = new ethers.Contract(u.usdc, ERC20_ABI, deployer);
    const usdcBal = await usdc.balanceOf(deployer.address);
    const usdcDecimals = await usdc.decimals();
    const usdcSymbol = await usdc.symbol();
    const needUsdc = ethers.parseUnits(process.env.LP_PAIRED_USDC || "0", usdcDecimals);
    if (usdcBal < needUsdc) fail.push(`${usdcSymbol} balance too low: have ${ethers.formatUnits(usdcBal, usdcDecimals)}, need ${process.env.LP_PAIRED_USDC}.`);
    else ok.push(`${usdcSymbol} balance: ${ethers.formatUnits(usdcBal, usdcDecimals)} (need ${process.env.LP_PAIRED_USDC})`);
  } catch (e) {
    fail.push(`Could not read USDC balance at ${u.usdc}: ${e.message}`);
  }

  // 7. SPLCLPLock contract is compilable / present
  try {
    await ethers.getContractFactory("SPLCLPLock");
    ok.push(`SPLCLPLock contract is compilable.`);
  } catch (e) {
    fail.push(`Cannot load SPLCLPLock contract factory. Did contracts compile? Error: ${e.message}`);
  }

  return finish();
}

function finish() {
  console.log("PASS:");
  for (const m of ok) console.log("  ✓ " + m);
  if (warn.length) {
    console.log("\nWARN:");
    for (const m of warn) console.log("  ! " + m);
  }
  if (fail.length) {
    console.log("\nFAIL:");
    for (const m of fail) console.log("  ✗ " + m);
    console.log(`\n=== ${fail.length} BLOCKER(S). DO NOT RUN deployLpAndLock.js. ===\n`);
    process.exit(1);
  }
  console.log("\n=== ALL CHECKS PASS. Safe to run deployLpAndLock.js next. ===\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
