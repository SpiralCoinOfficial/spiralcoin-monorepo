// SPDX-License-Identifier: MIT
// Deploys SPLCTwapOracle + SPLCPaymaster.
//
// What this gives you:
//   - End users can submit ERC-4337 UserOperations and PAY GAS IN SPLC
//     (not ETH). Bundler is paid in ETH by the paymaster's EntryPoint
//     deposit; user is debited an equivalent SPLC amount + 2% surcharge.
//   - Auto-LP: whenever the paymaster's accumulated SPLC balance crosses
//     10k SPLC, anyone can call processCollectedFees() which sells half
//     for ETH and pairs back into the Uni V3 pool — strengthening
//     liquidity automatically.
//
// Prerequisites:
//   1. deployUpgradeable.js ran            (SPLC proxy deployed)
//   2. deployLpAndLock.js ran              (Uniswap V3 pool exists)
//   3. EntryPoint v0.7 is deployed on the chain (canonical address below)
//   4. .env has TREASURY_WALLET set
//
// ⚠️  REVIEW BEFORE MAINNET DEPLOY:
//   deployLpAndLock.js was changed to create a SPLC/USDC pool (not SPLC/WETH).
//   The TWAP oracle below is currently constructed with chain.weth as the
//   quote token — that assumes the pool's other side is WETH. If the pool
//   is SPLC/USDC, the oracle's quote-token arg must be USDC (and downstream
//   paymaster math may need to convert USDC → ETH for gas pricing).
//   DO NOT deploy this script to mainnet until SPLCTwapOracle + SPLCPaymaster
//   are reviewed for SPLC/USDC pricing. See contracts/scripts/deployLpAndLock.js
//   for the new pool config.
//
// Usage:
//   $env:NODE_OPTIONS=""
//   $env:PAYMASTER_INITIAL_DEPOSIT_ETH="0.05"
//   npx hardhat run scripts/deployPaymaster.js --network arbitrumSepolia

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Per-chain WETH + Uniswap V3 SwapRouter addresses.
const CHAIN_ADDRS = {
  ethereum:        { weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
  arbitrum:        { weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
  base:            { weth: "0x4200000000000000000000000000000000000006", router: "0x2626664c2603336E57B271c5C0b26F421741e481" },
  optimism:        { weth: "0x4200000000000000000000000000000000000006", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
  polygon:         { weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" }, // WMATIC
  bsc:             { weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", router: "0x1b81D678ffb9C0263b24A97847620C99d213eB14" }, // PancakeSwap V3 router
  // Testnets
  arbitrumSepolia: { weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", router: "0x101F443B4d1b059569D643917553c771E1b9663E" },
  sepolia:         { weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" },
  baseSepolia:     { weth: "0x4200000000000000000000000000000000000006", router: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4" },
};

function loadDeployment(net, name) {
  const f = path.join(__dirname, "..", "deployments", net, `${name}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const net = network.name;
  const chain = CHAIN_ADDRS[net];
  if (!chain) throw new Error(`No WETH/router config for network ${net}. Add to CHAIN_ADDRS.`);

  const [deployer] = await ethers.getSigners();
  const depositEth = process.env.PAYMASTER_INITIAL_DEPOSIT_ETH || "0.05";

  console.log(`\n=== SPLCPaymaster deploy :: ${net} ===`);
  console.log("Deployer    :", deployer.address);
  console.log("EntryPoint  :", ENTRYPOINT_V07);
  console.log("WETH        :", chain.weth);
  console.log("SwapRouter  :", chain.router);
  console.log("Init deposit:", depositEth, "ETH");

  // Verify EntryPoint exists on this chain
  const epCode = await ethers.provider.getCode(ENTRYPOINT_V07);
  if (epCode === "0x") {
    throw new Error(`EntryPoint v0.7 not deployed at ${ENTRYPOINT_V07} on ${net}. Skip paymaster on this chain or deploy EntryPoint first.`);
  }

  // ── Load SPLC + LP pool ────────────────────────────────────────────────
  const splcDep = loadDeployment(net, "SpiralCoinUpgradeable");
  if (!splcDep) throw new Error(`Missing deployments/${net}/SpiralCoinUpgradeable.json`);
  const splcAddr = splcDep.proxy;

  const lpDep = loadDeployment(net, "LpAndLock");
  if (!lpDep) throw new Error(`Missing deployments/${net}/LpAndLock.json — run deployLpAndLock.js first (oracle needs a Uniswap V3 pool)`);
  const poolAddr = lpDep.pool;

  console.log("SPLC        :", splcAddr);
  console.log("V3 Pool     :", poolAddr);

  // ── 1. Deploy TWAP oracle ──────────────────────────────────────────────
  let oracleAddr;
  const oDep = loadDeployment(net, "SPLCTwapOracle");
  if (oDep?.address) {
    oracleAddr = oDep.address;
    console.log("\n[1/3] Reusing existing oracle:", oracleAddr);
  } else {
    console.log("\n[1/3] Deploying SPLCTwapOracle...");
    const OF = await ethers.getContractFactory("SPLCTwapOracle");
    const oracle = await OF.deploy(poolAddr, splcAddr, chain.weth, deployer.address);
    await oracle.waitForDeployment();
    oracleAddr = await oracle.getAddress();
    console.log("  oracle:", oracleAddr);
    fs.writeFileSync(
      path.join(__dirname, "..", "deployments", net, "SPLCTwapOracle.json"),
      JSON.stringify({ network: net, address: oracleAddr, pool: poolAddr, splc: splcAddr, weth: chain.weth, deployedAt: new Date().toISOString() }, null, 2)
    );
  }

  // ── 2. Deploy paymaster ────────────────────────────────────────────────
  console.log("\n[2/3] Deploying SPLCPaymaster...");
  const treasury = req("TREASURY_WALLET");
  const PF = await ethers.getContractFactory("SPLCPaymaster");
  const pm = await PF.deploy(
    ENTRYPOINT_V07,
    splcAddr,
    chain.weth,
    chain.router,
    oracleAddr,
    treasury,
    deployer.address
  );
  await pm.waitForDeployment();
  const pmAddr = await pm.getAddress();
  console.log("  paymaster:", pmAddr);

  // Mark paymaster fee-exempt on SPLC (so the 3.14% AMM tax doesn't hit
  // its swap-back-to-LP path via V3 — though V3 trade is via router and
  // not setAmmPair'd, this is defensive)
  console.log("  marking paymaster fee-exempt on SPLC...");
  try {
    const splc = await ethers.getContractAt("SpiralCoinUpgradeable", splcAddr);
    await (await splc.setFeeExempt(pmAddr, true)).wait();
  } catch (e) {
    console.warn("  could not setFeeExempt (owner mismatch?):", e.message);
  }

  // ── 3. Pre-fund EntryPoint deposit ─────────────────────────────────────
  console.log(`\n[3/3] Pre-funding EntryPoint with ${depositEth} ETH...`);
  await (await pm.deposit({ value: ethers.parseEther(depositEth) })).wait();
  console.log("  paymaster deposit on EntryPoint:", ethers.formatEther(await ethers.provider.getBalance(ENTRYPOINT_V07)), "ETH (entire contract bal)");

  // ── Persist ────────────────────────────────────────────────────────────
  const out = {
    network: net,
    paymaster: pmAddr,
    oracle: oracleAddr,
    entryPoint: ENTRYPOINT_V07,
    splc: splcAddr,
    weth: chain.weth,
    swapRouter: chain.router,
    treasury,
    owner: deployer.address,
    initialDepositEth: depositEth,
    deployedAt: new Date().toISOString(),
  };
  const outFile = path.join(__dirname, "..", "deployments", net, "SPLCPaymaster.json");
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outFile);

  console.log("\n✅ Paymaster live. Users construct UserOps with:");
  console.log(`   paymasterAndData = ${pmAddr} || abi.encode(uint256 maxSplcCharge)`);
  console.log("\nNote: TWAP oracle needs ≥30 minutes of trading history before reliable.");
  console.log("To top up paymaster ETH later: send ETH directly to", pmAddr);
}

main().catch(e => { console.error(e); process.exit(1); });
