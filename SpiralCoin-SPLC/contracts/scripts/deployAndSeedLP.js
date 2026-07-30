// Deploy SpiralCoin (SPLC) and seed a Uniswap V2 WETH/SPLC liquidity pool in one run.
//
// Two-stage safety:
//   Default                -> dry run. Validates env, balances, addresses. No tx broadcast.
//   EXECUTE_LP=1           -> actually deploys + addLiquidityETH.
//
// Required env (in contracts/.env):
//   DEPLOYER_PRIVATE_KEY   - signer; must hold ETH on the target network for gas + LP_ETH_AMOUNT
//   FOUNDER_WALLET         - receives FOUNDER_AMOUNT SPLC at construction (use 0 to skip)
//
// LP env:
//   LP_SPLC_AMOUNT         - human units of SPLC to put in the pool (e.g. "1000000000" = 1B SPLC)
//   LP_ETH_AMOUNT          - human units of ETH to put in the pool (e.g. "0.1")
//   LP_RECIPIENT           - (optional) where LP tokens go; defaults to deployer
//   LP_SLIPPAGE_BPS        - (optional) min-amount slippage in basis points, default 50 = 0.5%
//   LP_DEADLINE_MIN        - (optional) tx deadline in minutes, default 20
//
// Token supply env (drives constructor):
//   LP_PREMINE_AMOUNT      - SPLC minted to deployer at construction (must be >= LP_SPLC_AMOUNT)
//                            Defaults to CIRCULATING_SUPPLY from .env if not set.
//   FOUNDER_AMOUNT         - SPLC minted to FOUNDER_WALLET (defaults to FOUNDER_SUPPLY from .env)
//
// Network constants (Uniswap V2 fork addresses) are hard-coded per chainId below.

const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const ROUTERS = {
  // Uniswap V2 Router02 deployments
  1: {
    name: "ethereum",
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    explorer: "https://etherscan.io",
  },
  8453: {
    // Uniswap V2 on Base
    name: "base",
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    weth: "0x4200000000000000000000000000000000000006",
    explorer: "https://basescan.org",
  },
  84532: {
    // Base Sepolia — Uniswap V2 router is deployed here too
    name: "baseSepolia",
    router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    weth: "0x4200000000000000000000000000000000000006",
    explorer: "https://sepolia.basescan.org",
  },
};

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function factory() external view returns (address)",
  "function WETH() external view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

function req(name) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function opt(name, fallback) {
  const v = (process.env[name] || "").trim();
  return v || fallback;
}

async function main() {
  const hre = require("hardhat");
  const { ethers } = hre;

  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);
  const cfg = ROUTERS[chainId];
  if (!cfg) {
    throw new Error(`No Uniswap V2 router configured for chainId=${chainId}. Edit ROUTERS map in this script.`);
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer; check DEPLOYER_PRIVATE_KEY in contracts/.env");

  const founderWallet = req("FOUNDER_WALLET");
  const premineHuman = opt("LP_PREMINE_AMOUNT", opt("CIRCULATING_SUPPLY", "0"));
  const founderHuman = opt("FOUNDER_AMOUNT", opt("FOUNDER_SUPPLY", "0"));
  const lpSplcHuman = req("LP_SPLC_AMOUNT");
  const lpEthHuman = req("LP_ETH_AMOUNT");
  const lpRecipient = opt("LP_RECIPIENT", deployer.address);
  const slippageBps = BigInt(opt("LP_SLIPPAGE_BPS", "50"));
  const deadlineMin = Number(opt("LP_DEADLINE_MIN", "20"));

  const premineUnits = ethers.parseUnits(premineHuman, 18);
  const founderUnits = ethers.parseUnits(founderHuman, 18);
  const lpSplcUnits = ethers.parseUnits(lpSplcHuman, 18);
  const lpEthUnits = ethers.parseEther(lpEthHuman);

  if (premineUnits < lpSplcUnits) {
    throw new Error(
      `LP_PREMINE_AMOUNT (${premineHuman}) must be >= LP_SPLC_AMOUNT (${lpSplcHuman}). ` +
      `The deployer needs to hold enough SPLC to seed the pool.`
    );
  }

  const ethBalance = await ethers.provider.getBalance(deployer.address);
  const gasBuffer = ethers.parseEther("0.005"); // rough cushion for deploy + approve + addLiquidity on Base
  const ethNeeded = lpEthUnits + gasBuffer;

  const minSplc = (lpSplcUnits * (10_000n - slippageBps)) / 10_000n;
  const minEth = (lpEthUnits * (10_000n - slippageBps)) / 10_000n;
  const deadline = Math.floor(Date.now() / 1000) + deadlineMin * 60;

  console.log("=== SpiralCoin deploy + Uniswap V2 LP seed ===");
  console.log(`Network:         ${cfg.name} (chainId=${chainId})`);
  console.log(`Deployer:        ${deployer.address}`);
  console.log(`ETH balance:     ${ethers.formatEther(ethBalance)} ETH`);
  console.log(`ETH required:    ${ethers.formatEther(ethNeeded)} ETH  (LP ${lpEthHuman} + ~0.005 gas buffer)`);
  console.log(`Founder wallet:  ${founderWallet}`);
  console.log(`Premine -> deployer:  ${premineHuman} SPLC`);
  console.log(`Founder mint:         ${founderHuman} SPLC`);
  console.log(`LP SPLC side:         ${lpSplcHuman} SPLC  (min ${ethers.formatUnits(minSplc, 18)})`);
  console.log(`LP ETH side:          ${lpEthHuman} ETH    (min ${ethers.formatEther(minEth)})`);
  console.log(`LP recipient:         ${lpRecipient}`);
  console.log(`Router:               ${cfg.router}`);
  console.log(`WETH:                 ${cfg.weth}`);
  const impliedPrice = Number(lpEthHuman) / Number(lpSplcHuman);
  console.log(`Implied initial price: 1 SPLC = ${impliedPrice} ETH`);

  if (ethBalance < ethNeeded) {
    console.log("");
    console.log(`! Deployer ETH balance is below required. Fund ${deployer.address} on ${cfg.name} with at least ${ethers.formatEther(ethNeeded)} ETH and re-run.`);
  }

  if (process.env.EXECUTE_LP !== "1") {
    console.log("");
    console.log("Dry run only. Re-run with EXECUTE_LP=1 to broadcast (and ensure deployer is funded).");
    return;
  }

  if (ethBalance < ethNeeded) {
    throw new Error("Refusing to broadcast: insufficient ETH balance.");
  }

  // 1) Deploy SpiralCoin with deployer as premine wallet
  console.log("\n[1/3] Deploying SpiralCoin...");
  const SpiralCoin = await ethers.getContractFactory("SpiralCoin");
  const token = await SpiralCoin.deploy(deployer.address, premineUnits, founderWallet, founderUnits);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`   SpiralCoin deployed at ${tokenAddress}`);
  console.log(`   ${cfg.explorer}/address/${tokenAddress}`);

  // 2) Approve router
  console.log("\n[2/3] Approving router to spend SPLC...");
  const tokenIface = new ethers.Contract(tokenAddress, ERC20_ABI, deployer);
  const approveTx = await tokenIface.approve(cfg.router, lpSplcUnits);
  console.log(`   approve tx: ${approveTx.hash}`);
  await approveTx.wait();

  // 3) addLiquidityETH
  console.log("\n[3/3] addLiquidityETH...");
  const router = new ethers.Contract(cfg.router, ROUTER_ABI, deployer);
  const addTx = await router.addLiquidityETH(
    tokenAddress,
    lpSplcUnits,
    minSplc,
    minEth,
    lpRecipient,
    deadline,
    { value: lpEthUnits }
  );
  console.log(`   addLiquidityETH tx: ${addTx.hash}`);
  const rcpt = await addTx.wait();
  console.log(`   mined in block ${rcpt.blockNumber}`);

  // Look up pair
  const factoryAddr = await router.factory();
  const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, ethers.provider);
  const pair = await factory.getPair(tokenAddress, cfg.weth);

  const deployment = {
    network: cfg.name,
    chainId,
    tokenAddress,
    pairAddress: pair,
    router: cfg.router,
    weth: cfg.weth,
    deployer: deployer.address,
    founder: founderWallet,
    lp: {
      splcAmount: lpSplcHuman,
      ethAmount: lpEthHuman,
      recipient: lpRecipient,
      impliedInitialPriceEthPerSplc: impliedPrice,
    },
    txs: {
      approve: approveTx.hash,
      addLiquidity: addTx.hash,
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${cfg.name}.json`), JSON.stringify(deployment, null, 2));

  console.log("\nDone.");
  console.log(`Token: ${cfg.explorer}/address/${tokenAddress}`);
  console.log(`Pair:  ${cfg.explorer}/address/${pair}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
