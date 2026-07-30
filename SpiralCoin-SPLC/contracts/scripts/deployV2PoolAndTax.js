// SPDX-License-Identifier: MIT
// Deploy a tax-ACTIVE V2-style AMM pool (PancakeSwap V2, SushiSwap V2,
// QuickSwap, Velodrome, Aerodrome) and register it as an AMM pair so the
// 3.14% transfer tax fires on swaps.
//
// V2 pools tolerate fee-on-transfer tokens via the
// `swapExactTokensForTokensSupportingFeeOnTransferTokens` router method.
// V3 pools do NOT — use scripts/deployLpAndLock.js for V3 (which skips
// setAmmPair to keep the pool tax-inactive).
//
// Per-chain factory/router addresses come from contracts/config/launch.json
// (you provide them or let the script default to known mainnet addresses).
//
// Usage:
//   $env:NODE_OPTIONS=""
//   $env:LP_SPLC_AMOUNT="50000"          # SPLC to seed
//   $env:LP_PAIRED_AMOUNT="3.25"          # WETH/WBNB/WMATIC amount
//   $env:LP_LOCK_DURATION_SEC="31536000"  # 1 year
//   npx hardhat run scripts/deployV2PoolAndTax.js --network bsc

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Known V2 router/factory addresses per chain. Override via env if needed.
const V2 = {
  ethereum:  { router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac", weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", dex: "SushiSwapV2" },
  arbitrum:  { router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4", weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", dex: "SushiSwapV2" },
  bsc:       { router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", dex: "PancakeSwapV2" },
  polygon:   { router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", factory: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32", weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", dex: "QuickSwapV2" },
  optimism:  { router: "0x9c12939390052919aF7155f3E06882c298221200", factory: "0xFCDc8a956fAe9D3Eed8c4f3F8b8E69d6c1Cf6c8d", weth: "0x4200000000000000000000000000000000000006", dex: "VelodromeV2 (placeholder)" },
  base:      { router: "0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891", factory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da", weth: "0x4200000000000000000000000000000000000006", dex: "AerodromeV1 (placeholder)" },
  // Testnets — for dress rehearsal only. Replace with real testnet V2 deployments.
  bscTestnet:        { router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1", factory: "0x6725F303b657a9451d8BA641348b6761A6CC7a17", weth: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", dex: "PancakeSwapV2 testnet" },
  arbitrumSepolia:   null,
  sepolia:           null,
  baseSepolia:       null,
  polygonAmoy:       null,
};

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address)",
  "function createPair(address tokenA, address tokenB) returns (address)",
  "function feeTo() view returns (address)"
];
const ROUTER_ABI = [
  "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)",
  "function factory() view returns (address)"
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

async function main() {
  const net = network.name;
  const v2 = V2[net];
  if (!v2) throw new Error(`No V2 config for network ${net}. Add to V2 map.`);
  const [deployer] = await ethers.getSigners();

  const depFile = path.join(__dirname, "..", "deployments", net, "SpiralCoinUpgradeable.json");
  if (!fs.existsSync(depFile)) throw new Error(`Run deployUpgradeable first: missing ${depFile}`);
  const splcAddr = JSON.parse(fs.readFileSync(depFile, "utf8")).proxy;

  console.log(`\n=== ${net} :: ${v2.dex} V2 pool deploy ===`);
  console.log("  SPLC:    ", splcAddr);
  console.log("  Router:  ", v2.router);
  console.log("  Factory: ", v2.factory);
  console.log("  Paired:  ", v2.weth);

  const factory = await ethers.getContractAt(FACTORY_ABI, v2.factory);
  const router  = await ethers.getContractAt(ROUTER_ABI, v2.router);
  const splc    = await ethers.getContractAt("SpiralCoinUpgradeable", splcAddr);
  const weth    = await ethers.getContractAt(ERC20_ABI, v2.weth);

  // ── 1. Create pair if needed ──────────────────────────────────────────
  console.log("\n[1/4] Checking pair...");
  let pairAddr = await factory.getPair(splcAddr, v2.weth);
  if (pairAddr === ethers.ZeroAddress) {
    console.log("  creating pair...");
    const txC = await factory.createPair(splcAddr, v2.weth);
    await txC.wait();
    pairAddr = await factory.getPair(splcAddr, v2.weth);
  }
  console.log("  pair:", pairAddr);

  // ── 2. CRITICAL: exempt the router so add-liquidity doesn't lose tokens to tax ─
  // (router pulls SPLC from us with transferFrom. If tax applies, the router
  // receives less than expected and the addLiquidity quote will be off.)
  console.log("\n[2/4] Fee-exempting router (so addLiquidity arithmetic is clean)...");
  try {
    await (await splc.setFeeExempt(v2.router, true)).wait();
    console.log("  exempted router");
  } catch (e) {
    console.warn("  could not exempt router (owner mismatch?):", e.message);
  }

  // ── 3. Add liquidity ──────────────────────────────────────────────────
  console.log("\n[3/4] Adding liquidity...");
  const splcDec  = await splc.decimals();
  const pairDec  = await weth.decimals();
  const splcAmt  = ethers.parseUnits(req("LP_SPLC_AMOUNT"),    splcDec);
  const pairAmt  = ethers.parseUnits(req("LP_PAIRED_AMOUNT"),  pairDec);

  await (await splc.approve(v2.router, splcAmt)).wait();
  await (await weth.approve(v2.router, pairAmt)).wait();

  const deadline = Math.floor(Date.now()/1000) + 1800;
  const tx = await router.addLiquidity(
    splcAddr, v2.weth, splcAmt, pairAmt,
    (splcAmt * 99n) / 100n, (pairAmt * 99n) / 100n,
    deployer.address, deadline
  );
  await tx.wait();
  console.log("  liquidity added");

  // ── 4. Register pair as AMM (tax-active) ──────────────────────────────
  console.log("\n[4/4] Registering V2 pair as AMM (3.14% tax engages on swaps)...");
  await (await splc.setAmmPair(pairAddr, true)).wait();
  console.log("  setAmmPair(true)");

  // Persist
  const out = {
    network: net,
    dex: v2.dex,
    splc: splcAddr,
    paired: v2.weth,
    pair: pairAddr,
    router: v2.router,
    factory: v2.factory,
    splcSeeded: req("LP_SPLC_AMOUNT"),
    pairedSeeded: req("LP_PAIRED_AMOUNT"),
    ammTaxActive: true,
    seededAt: new Date().toISOString()
  };
  const outFile = path.join(__dirname, "..", "deployments", net, "V2Pool.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("Saved:", outFile);

  console.log(`\nDone. Tax-active V2 pool live at ${pairAddr}`);
  console.log("WARNING: Users must call swapExactTokensForTokensSupportingFeeOnTransferTokens, not the standard swap method.");
}

main().catch(e => { console.error(e); process.exit(1); });
