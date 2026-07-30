const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) view returns (uint256)",
];

const NATIVE_DECIMALS = 18;

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getNetworkList() {
  const raw = (process.env.SPLC_NETWORKS || "sepolia").trim();
  return raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function toEnvKey(networkName, suffix) {
  const key = networkName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `${key}_${suffix}`;
}

function getRpcUrl(networkName) {
  return (
    process.env[toEnvKey(networkName, "RPC_URL")] ||
    process.env[`${networkName.toUpperCase()}_RPC_URL`] ||
    process.env.SEPOLIA_RPC_URL ||
    ""
  ).trim();
}

function getTokenAddress(networkName, deployment) {
  const envSpecific = (process.env[toEnvKey(networkName, "SPLC_TOKEN_ADDRESS")] || "").trim();
  const envGeneric = (process.env.SPLC_TOKEN_ADDRESS || "").trim();
  const fromDeployment = (deployment?.tokenAddress || "").trim();
  return envSpecific || fromDeployment || envGeneric;
}

function getTrackedWallets(deployment) {
  const wallets = [];

  const envVault = (process.env.SUPPLY_VAULT_WALLET || process.env.PREMINE_WALLET || "").trim();
  const envFounder = (process.env.FOUNDER_WALLET || "").trim();
  if (envVault) wallets.push({ label: "supplyVault", address: envVault });
  if (envFounder) wallets.push({ label: "founder", address: envFounder });

  if (deployment?.wallets?.supplyVault) {
    wallets.push({ label: "deployedSupplyVault", address: deployment.wallets.supplyVault });
  }
  if (deployment?.wallets?.founder) {
    wallets.push({ label: "deployedFounder", address: deployment.wallets.founder });
  }

  const unique = new Map();
  for (const wallet of wallets) {
    if (wallet.address && !unique.has(wallet.address.toLowerCase())) {
      unique.set(wallet.address.toLowerCase(), wallet);
    }
  }

  return [...unique.values()];
}

function formatUnits(ethers, value, decimals = 18) {
  return ethers.formatUnits(value, decimals);
}

async function inspectNetwork(hre, networkName) {
  const ethers = hre.ethers;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  const deployment = safeReadJson(deploymentPath);

  const rpcUrl = getRpcUrl(networkName);
  if (!rpcUrl) {
    return {
      network: networkName,
      status: "skipped",
      reason: `Missing ${toEnvKey(networkName, "RPC_URL")} (or fallback RPC URL)`,
    };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const net = await provider.getNetwork();

  const tokenAddress = getTokenAddress(networkName, deployment);
  if (!tokenAddress) {
    return {
      network: networkName,
      chainId: Number(net.chainId),
      status: "skipped",
      reason: "No token address found in env or deployments file",
    };
  }

  const code = await provider.getCode(tokenAddress);
  if (!code || code === "0x") {
    return {
      network: networkName,
      chainId: Number(net.chainId),
      tokenAddress,
      status: "not-contract",
      reason: "No contract bytecode at token address",
    };
  }

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [symbol, decimals, totalSupply, nativeBalance] = await Promise.all([
    token.symbol().catch(() => "SPLC"),
    token.decimals().catch(() => 18),
    token.totalSupply(),
    provider.getBalance(tokenAddress),
  ]);

  const trackedWallets = getTrackedWallets(deployment);
  const walletBalances = [];

  for (const wallet of trackedWallets) {
    const [tokenBalance, walletNativeBalance] = await Promise.all([
      token.balanceOf(wallet.address),
      provider.getBalance(wallet.address),
    ]);

    walletBalances.push({
      label: wallet.label,
      address: wallet.address,
      tokenBalanceRaw: tokenBalance.toString(),
      tokenBalance: formatUnits(ethers, tokenBalance, Number(decimals)),
      nativeBalanceRaw: walletNativeBalance.toString(),
      nativeBalance: formatUnits(ethers, walletNativeBalance, NATIVE_DECIMALS),
    });
  }

  return {
    network: networkName,
    chainId: Number(net.chainId),
    status: "ok",
    tokenAddress,
    token: {
      symbol,
      decimals: Number(decimals),
      totalSupplyRaw: totalSupply.toString(),
      totalSupply: formatUnits(ethers, totalSupply, Number(decimals)),
    },
    contractFunding: {
      nativeBalanceRaw: nativeBalance.toString(),
      nativeBalance: formatUnits(ethers, nativeBalance, NATIVE_DECIMALS),
    },
    wallets: walletBalances,
  };
}

async function main() {
  const hre = require("hardhat");
  const networks = getNetworkList();

  if (!networks.length) {
    throw new Error("No networks configured. Set SPLC_NETWORKS in .env");
  }

  const results = [];
  for (const networkName of networks) {
    try {
      const result = await inspectNetwork(hre, networkName);
      results.push(result);
    } catch (error) {
      results.push({
        network: networkName,
        status: "error",
        reason: error?.message || String(error),
      });
    }
  }

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `funding-report-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  console.log(`Funding report written: ${outPath}`);
  for (const result of results) {
    if (result.status !== "ok") {
      console.log(`[${result.network}] ${result.status} - ${result.reason || "n/a"}`);
      continue;
    }

    console.log(`[${result.network}] ${result.token.symbol} @ ${result.tokenAddress}`);
    console.log(`  totalSupply: ${result.token.totalSupply}`);
    console.log(`  contract native balance: ${result.contractFunding.nativeBalance}`);
    for (const wallet of result.wallets) {
      console.log(`  ${wallet.label}: ${wallet.address}`);
      console.log(`    token: ${wallet.tokenBalance}`);
      console.log(`    native: ${wallet.nativeBalance}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
