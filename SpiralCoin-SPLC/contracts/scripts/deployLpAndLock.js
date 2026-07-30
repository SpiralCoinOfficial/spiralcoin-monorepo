// SPDX-License-Identifier: MIT
// Create the SPLC/USDC Uniswap V3 pool, seed it with LP_SPLC_AMOUNT SPLC +
// LP_PAIRED_USDC USDC, then transfer the LP NFT into SPLCLPLock for a
// minimum 12-month lock.
//
// Sets the launch price implicitly via the pairing ratio:
//   price (USDC/SPLC) = LP_PAIRED_USDC / LP_SPLC_AMOUNT
//
// Examples (per spec):
//   150M SPLC paired with $150,000 USDC -> $0.001 / SPLC (typical bootstrap)
//   150M SPLC paired with $1.5M  USDC  -> $0.01  / SPLC
//   150M SPLC paired with $15M   USDC  -> $0.10  / SPLC
//
//   For the seed-round bootstrap target ($20k cover):
//     ~150,000 SPLC paired with ~$19,800 USDC -> ~$0.132 / SPLC initial price
//     (adjust LP_SPLC_AMOUNT to whatever launch price you want with $19.8k USDC)
//
// Pool fee tier: 1% (10000) — the correct V3 tier for a new, volatile token
// (0.05% is for stables, 0.30% for blue chips like ETH/USDC). Matches the
// public commitment in splc.html and the grant applications.
//
// You MUST set LP_PAIRED_USDC before running this script.
//
// Usage:
//   npx hardhat run scripts/deployLpAndLock.js --network arbitrum

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Uniswap V3 + native USDC addresses per chain.
// USDC addresses are the *native* (CCTP-bridged) USDC issued by Circle,
// NOT the legacy bridged "USDC.e" variants. Use native USDC for new pools.
const UNIV3 = {
  arbitrum: {
    factory:    "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    posManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    usdc:       "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // native USDC on Arbitrum One
  },
  base: {
    factory:    "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    posManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    usdc:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // native USDC on Base
  },
  polygon: {
    factory:    "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    posManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    usdc:       "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // native USDC on Polygon PoS
  },
  ethereum: {
    factory:    "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    posManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    usdc:       "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // native USDC on Ethereum L1
  },
};

const POOL_FEE = 10000;     // 1% — correct V3 tier for new/volatile tokens
const TICK_SPACING = 200;   // tick spacing for the 1% fee tier
const USDC_DECIMALS = 6;    // USDC is 6-decimal on every supported chain

// Minimal ABIs
const FACTORY_ABI = [
  "function getPool(address,address,uint24) view returns (address)",
  "function createPool(address,address,uint24) returns (address)",
];
const POOL_ABI = [
  "function initialize(uint160 sqrtPriceX96)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
  "function token0() view returns (address)",
];
const POS_ABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
];
const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// sqrtPriceX96 = sqrt(price) * 2^96 where price = token1/token0 reserves ratio
function computeSqrtPriceX96(amount0, amount1) {
  // ratio = amount1 * 2^192 / amount0
  // sqrtPriceX96 = sqrt(ratio)
  const Q96 = 2n ** 96n;
  const Q192 = 2n ** 192n;
  const ratioX192 = (amount1 * Q192) / amount0;
  // integer sqrt via Newton's method
  let z = ratioX192;
  let x = (z + 1n) / 2n;
  while (x < z) { z = x; x = (ratioX192 / x + x) / 2n; }
  return z; // already scaled by 2^96 because sqrt(ratio*2^192) = sqrt(ratio)*2^96
}

async function main() {
  const net = network.name;
  const u = UNIV3[net];
  if (!u) throw new Error(`No UniV3 config for network ${net}`);

  const [deployer] = await ethers.getSigners();
  const depFile = path.join(__dirname, "..", "deployments", net, "SpiralCoinUpgradeable.json");
  const dep = JSON.parse(fs.readFileSync(depFile, "utf8"));
  const splcAddr = dep.proxy;

  const splcAmount = ethers.parseUnits(req("LP_SPLC_AMOUNT"), 18);
  const usdcAmountStr = process.env.LP_PAIRED_USDC;
  if (!usdcAmountStr || usdcAmountStr.trim() === "") {
    throw new Error("LP_PAIRED_USDC not set in .env. Set it to the USDC amount you'll pair (e.g. 19800 for $19,800 USDC).");
  }
  const usdcAmount = ethers.parseUnits(usdcAmountStr, USDC_DECIMALS);

  console.log("Network    :", net);
  console.log("SPLC       :", splcAddr);
  console.log("USDC       :", u.usdc);
  console.log("LP SPLC    :", req("LP_SPLC_AMOUNT"));
  console.log("LP USDC    :", usdcAmountStr);
  // implied price scaled by 1e18 for display
  const impliedUsdcPerSplc = (usdcAmount * 10n ** 30n) / splcAmount; // 6 dec USDC * 1e30 / 18 dec SPLC = 1e18 scaled
  console.log("Implied 1 SPLC =", ethers.formatUnits(impliedUsdcPerSplc, 18), "USDC");

  // ── Verify USDC balance ──────────────────────────────────────────────
  console.log("\n[1/5] Verifying USDC + SPLC balances...");
  const usdc = new ethers.Contract(u.usdc, USDC_ABI, deployer);
  const ubal = await usdc.balanceOf(deployer.address);
  if (ubal < usdcAmount) {
    throw new Error(`Insufficient USDC: have ${ethers.formatUnits(ubal, USDC_DECIMALS)}, need ${usdcAmountStr}. Bridge USDC to ${net} (Coinbase, Circle CCTP, or Stargate) before running.`);
  }
  console.log("  USDC balance OK:", ethers.formatUnits(ubal, USDC_DECIMALS), "USDC");

  // Verify SPLC balance too (catches mistakes BEFORE we spend gas on approvals/mint).
  const splcEarly = await ethers.getContractAt("SpiralCoinUpgradeable", splcAddr);
  const sbal = await splcEarly.balanceOf(deployer.address);
  if (sbal < splcAmount) {
    throw new Error(`Insufficient SPLC: have ${ethers.formatUnits(sbal, 18)}, need ${req("LP_SPLC_AMOUNT")}. Transfer SPLC to the deployer wallet before running.`);
  }
  console.log("  SPLC balance OK:", ethers.formatUnits(sbal, 18), "SPLC");

  // ── Determine token0/token1 ordering ─────────────────────────────────
  const splcLower = splcAddr.toLowerCase();
  const usdcLower = u.usdc.toLowerCase();
  const splcIsToken0 = splcLower < usdcLower;
  const token0 = splcIsToken0 ? splcAddr : u.usdc;
  const token1 = splcIsToken0 ? u.usdc : splcAddr;
  const amount0 = splcIsToken0 ? splcAmount : usdcAmount;
  const amount1 = splcIsToken0 ? usdcAmount : splcAmount;

  // ── Create + initialize pool ─────────────────────────────────────────
  console.log("\n[2/5] Creating + initializing pool...");
  const factory = new ethers.Contract(u.factory, FACTORY_ABI, deployer);
  let poolAddr = await factory.getPool(token0, token1, POOL_FEE);
  if (poolAddr === ethers.ZeroAddress) {
    const tx = await factory.createPool(token0, token1, POOL_FEE);
    await tx.wait();
    poolAddr = await factory.getPool(token0, token1, POOL_FEE);
  }
  console.log("  pool:", poolAddr);

  const pool = new ethers.Contract(poolAddr, POOL_ABI, deployer);
  const slot0 = await pool.slot0();
  if (slot0.sqrtPriceX96 === 0n) {
    const sqrtPrice = computeSqrtPriceX96(amount0, amount1);
    const tx = await pool.initialize(sqrtPrice);
    await tx.wait();
    console.log("  initialized sqrtPriceX96:", sqrtPrice.toString());
  } else {
    console.log("  already initialized");
  }

  // ── Approve + mint full-range position ───────────────────────────────
  console.log("\n[3/5] Approving + minting LP position...");
  const splc = splcEarly;
  await (await splc.approve(u.posManager, splcAmount)).wait();
  await (await usdc.approve(u.posManager, usdcAmount)).wait();

  // IMPORTANT: do NOT call splc.setAmmPair(v3pool, true).
  // Uniswap V3 pools revert when transfer amount != swap-expected amount
  // (K-invariant check). The 3.14% AMM tax skim breaks V3 swaps.
  //
  // V3 pools must remain tax-INACTIVE (LP fees only).
  // Tax revenue comes from V2-style pools (PancakeSwap V2, SushiSwap V2)
  // deployed via scripts/deployV2PoolAndTax.js, where setAmmPair IS safe.
  console.log("  (skipping setAmmPair on V3 pool — would break swaps)");

  // Full-range ticks for the 1% fee tier (tick spacing 200)
  const MIN_TICK = -887272;
  const MAX_TICK =  887272;
  const tickLower = Math.ceil(MIN_TICK / TICK_SPACING) * TICK_SPACING;
  const tickUpper = Math.floor(MAX_TICK / TICK_SPACING) * TICK_SPACING;

  const posManager = new ethers.Contract(u.posManager, POS_ABI, deployer);

  // Slippage protection: require at least 99% of desired amounts to be deposited.
  // Protects against the pool being re-initialized by an attacker between createPool and mint,
  // which would otherwise let them steal value via a wrong starting price.
  const SLIPPAGE_BPS = 100n; // 1% tolerance
  const amount0Min = amount0 - (amount0 * SLIPPAGE_BPS) / 10000n;
  const amount1Min = amount1 - (amount1 * SLIPPAGE_BPS) / 10000n;

  const mintTx = await posManager.mint({
    token0, token1, fee: POOL_FEE,
    tickLower, tickUpper,
    amount0Desired: amount0, amount1Desired: amount1,
    amount0Min, amount1Min,
    recipient: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 1800,
  });
  const mintRcpt = await mintTx.wait();

  // Extract tokenId from ERC-721 Transfer(from=0x0, to=deployer, tokenId) on the position manager.
  // Filtering by from=ZeroAddress avoids matching unrelated Transfer events.
  const ZERO_TOPIC = "0x" + "00".repeat(32);
  const deployerTopic = ethers.zeroPadValue(deployer.address.toLowerCase(), 32);
  let tokenId = 0n;
  for (const log of mintRcpt.logs) {
    if (
      log.address.toLowerCase() === u.posManager.toLowerCase() &&
      log.topics.length === 4 &&
      log.topics[1].toLowerCase() === ZERO_TOPIC &&
      log.topics[2].toLowerCase() === deployerTopic.toLowerCase()
    ) {
      tokenId = BigInt(log.topics[3]);
      break;
    }
  }
  if (tokenId === 0n) {
    throw new Error("Could not locate LP NFT tokenId in mint receipt — aborting before lock step.");
  }
  console.log("  LP NFT tokenId:", tokenId.toString());

  // ── Deploy lock + transfer NFT in ─────────────────────────────────────
  console.log("\n[4/5] Deploying SPLCLPLock and locking NFT...");
  const LockF = await ethers.getContractFactory("SPLCLPLock");
  const lock = await LockF.deploy(u.posManager, deployer.address);
  await lock.waitForDeployment();
  const lockAddr = await lock.getAddress();

  // Approve and call lock.lock()
  const erc721Iface = new ethers.Interface([
    "function approve(address,uint256)",
  ]);
  const approveTx = await deployer.sendTransaction({
    to: u.posManager,
    data: erc721Iface.encodeFunctionData("approve", [lockAddr, tokenId]),
  });
  await approveTx.wait();

  const lockDuration = parseInt(req("LP_LOCK_DURATION_SEC"), 10);
  const feeRecipient = req("TREASURY_WALLET");
  const lockTx = await lock.lock(tokenId, feeRecipient, lockDuration);
  await lockTx.wait();
  console.log("  locked", lockDuration, "sec, fees -> ", feeRecipient);

  // Persist
  console.log("\n[5/5] Saving...");
  const out = {
    network: net,
    splc: splcAddr,
    usdc: u.usdc,
    pool: poolAddr,
    feeTier: POOL_FEE,
    lpNftTokenId: tokenId.toString(),
    lock: lockAddr,
    lockDurationSec: lockDuration,
    feeRecipient,
    splcSeeded: req("LP_SPLC_AMOUNT"),
    usdcSeeded: usdcAmountStr,
    seededAt: new Date().toISOString(),
  };
  const outFile = path.join(__dirname, "..", "deployments", net, "LpAndLock.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("Saved:", outFile);

  console.log("\nLaunch complete. Verify on Uniswap:");
  console.log(`  https://app.uniswap.org/explore/pools/${net}/${poolAddr.toLowerCase()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
