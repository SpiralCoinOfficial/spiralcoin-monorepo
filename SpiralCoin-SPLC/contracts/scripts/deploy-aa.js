// SPDX-License-Identifier: MIT
//
// scripts/deploy-aa.js
// ─────────────────────
// Account-abstraction (ERC-4337) deploy pipeline using:
//   • viem                  — RPC client
//   • permissionless.js     — Safe smart-account + bundler/paymaster client
//   • Pimlico               — bundler + verifying paymaster
//
// What it does:
//   1. Loads PRIVATE_KEY → derives a Safe v1.4.1 smart-account address.
//   2. Sends a batch of deploy + config UserOperations sponsored by Pimlico.
//   3. Produces the same deployments/<network>.json that deploy-testnet.js
//      writes, so verify-testnet.js / wireOftPeers.js work unchanged.
//
// Why this exists:
//   hardhat-upgrades + ethers send raw EOA tx. They cannot use a paymaster.
//   This script replaces that transport for chains where you want gas
//   sponsored by Pimlico instead of funded by the deployer EOA.
//
// SAFETY:
//   • Owner of every deployed contract is the SAFE ADDRESS, not your EOA.
//     Your EOA is only the Safe's signer (1-of-1). You can add co-signers
//     to the Safe later via the Safe Wallet UI.
//   • Storage-layout safety checks from @openzeppelin/hardhat-upgrades are
//     NOT run on this path. Do not use for upgrades — only initial deploy.
//     For upgrades, deploy a new impl via hardhat-upgrades on a forked
//     network first to validate, then submit the upgradeTo() UserOp here.
//   • Pimlico paymaster MUST have a sponsorship policy whitelisting your
//     Safe address for the target chain before you run this.
//
// Usage:
//   npx hardhat compile
//   node scripts/deploy-aa.js baseSepolia
//   node scripts/deploy-aa.js arbitrumSepolia
//   node scripts/deploy-aa.js mainnet   # only after testnet smoke succeeds
//
// Required env (.env in contracts/):
//   PIMLICO_API_KEY            — from dashboard.pimlico.io
//   DEPLOYER_PRIVATE_KEY       — Safe signer (also pays nothing; just signs UserOps)
//   FOUNDER_PRIVATE_KEY        — (optional) preferred signer on testnets
//   TREASURY_WALLET            — 50% AMM tax sink + presale ETH receiver
//
// Optional env (same as deploy-testnet.js):
//   TESTNET_PREMINE_SPLC, PRESALE_*, STAKING_FUND_SPLC, AIRDROP_*, etc.
//
// Optional env (AA-specific):
//   SAFE_SALT                  — uint256 salt for deterministic Safe addr (default 0)
//   PIMLICO_BUNDLER_URL        — override bundler URL (default derived from chain)
//   PIMLICO_PAYMASTER_URL      — override paymaster URL (default derived from chain)
//   AA_DRY_RUN=1               — predict Safe addr + estimate, do not send
//

"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// ── Chain registry ──────────────────────────────────────────────────────
// id      → viem chain id
// pimSlug → Pimlico's URL slug for this chain
// lzEid   → LayerZero V2 eid (informational)
// lzEp    → LZ V2 endpoint (testnet shared; mainnet differs)
const CHAINS = {
  // mainnets
  mainnet:         { id: 1,        pimSlug: "ethereum",         lzEid: 30101, lzEp: "0x1a44076050125825900e736c501f859c50fE728c" },
  arbitrum:        { id: 42161,    pimSlug: "arbitrum",         lzEid: 30110, lzEp: "0x1a44076050125825900e736c501f859c50fE728c" },
  base:            { id: 8453,     pimSlug: "base",             lzEid: 30184, lzEp: "0x1a44076050125825900e736c501f859c50fE728c" },
  optimism:        { id: 10,       pimSlug: "optimism",         lzEid: 30111, lzEp: "0x1a44076050125825900e736c501f859c50fE728c" },
  polygon:         { id: 137,      pimSlug: "polygon",          lzEid: 30109, lzEp: "0x1a44076050125825900e736c501f859c50fE728c" },
  bsc:             { id: 56,       pimSlug: "binance",          lzEid: 30102, lzEp: "0x1a44076050125825900e736c501f859c50fE728c" },
  // testnets
  sepolia:         { id: 11155111, pimSlug: "sepolia",          lzEid: 40161, lzEp: "0x6EDCE65403992e310A62460808c4b910D972f10f" },
  arbitrumSepolia: { id: 421614,   pimSlug: "arbitrum-sepolia", lzEid: 40231, lzEp: "0x6EDCE65403992e310A62460808c4b910D972f10f" },
  baseSepolia:     { id: 84532,    pimSlug: "base-sepolia",     lzEid: 40245, lzEp: "0x6EDCE65403992e310A62460808c4b910D972f10f" },
  optimismSepolia: { id: 11155420, pimSlug: "optimism-sepolia", lzEid: 40232, lzEp: "0x6EDCE65403992e310A62460808c4b910D972f10f" },
  polygonAmoy:     { id: 80002,    pimSlug: "polygon-amoy",     lzEid: 40267, lzEp: "0x6EDCE65403992e310A62460808c4b910D972f10f" },
  bscTestnet:      { id: 97,       pimSlug: "binance-testnet",  lzEid: 40102, lzEp: "0x6EDCE65403992e310A62460808c4b910D972f10f" },
};

// ── Helpers ─────────────────────────────────────────────────────────────
function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function opt(name, fb) {
  const v = process.env[name];
  return (v === undefined || v === "") ? fb : v;
}
function loadArtifact(qualifiedName) {
  // qualifiedName like "contracts/SpiralCoinUpgradeable.sol:SpiralCoinUpgradeable"
  // or just "SpiralCoinUpgradeable" — we'll look it up in artifacts/
  const root = path.join(__dirname, "..", "artifacts", "contracts");
  let found = null;
  function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (f === `${qualifiedName}.json`) { found = p; return; }
    }
  }
  walk(root);
  if (!found) throw new Error(`Artifact not found for ${qualifiedName} (run: npx hardhat compile)`);
  return JSON.parse(fs.readFileSync(found, "utf8"));
}

function normalizeKey(k) {
  if (!k) return null;
  const stripped = k.startsWith("0x") ? k.slice(2) : k;
  if (!/^[0-9a-fA-F]{64}$/.test(stripped)) throw new Error("Invalid private key format");
  return "0x" + stripped;
}

async function main() {
  // ── viem + permissionless are ESM-only on recent versions; require dynamic import.
  const { createPublicClient, http, parseEther, parseUnits, encodeFunctionData,
          encodeAbiParameters, formatEther, getContractAddress, zeroAddress,
          encodeDeployData, isAddress } = await import("viem");
  const viemChains = await import("viem/chains");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { createSmartAccountClient } = await import("permissionless");
  const { toSafeSmartAccount } = await import("permissionless/accounts");
  const { createPimlicoClient } = await import("permissionless/clients/pimlico");
  const { entryPoint07Address } = await import("viem/account-abstraction");

  // ── Parse args ────────────────────────────────────────────────────────
  const netName = process.argv[2];
  if (!netName) {
    console.error("Usage: node scripts/deploy-aa.js <networkName>");
    console.error("Available:", Object.keys(CHAINS).join(", "));
    process.exit(1);
  }
  const chainCfg = CHAINS[netName];
  if (!chainCfg) throw new Error(`Unknown network: ${netName}`);

  // Map our network name to viem's chain object.
  const viemChainKey = {
    mainnet: "mainnet", arbitrum: "arbitrum", base: "base", optimism: "optimism",
    polygon: "polygon", bsc: "bsc", sepolia: "sepolia",
    arbitrumSepolia: "arbitrumSepolia", baseSepolia: "baseSepolia",
    optimismSepolia: "optimismSepolia", polygonAmoy: "polygonAmoy",
    bscTestnet: "bscTestnet",
  }[netName];
  const viemChain = viemChains[viemChainKey];
  if (!viemChain) throw new Error(`viem chain not exported: ${viemChainKey}`);

  // ── Build clients ─────────────────────────────────────────────────────
  const PIMLICO_KEY = req("PIMLICO_API_KEY");
  const bundlerUrl =
    process.env.PIMLICO_BUNDLER_URL ||
    `https://api.pimlico.io/v2/${chainCfg.pimSlug}/rpc?apikey=${PIMLICO_KEY}`;
  const paymasterUrl =
    process.env.PIMLICO_PAYMASTER_URL || bundlerUrl; // same endpoint, paymaster method

  const rpcUrl =
    process.env[`${netName.toUpperCase()}_RPC_URL`] ||
    (viemChain.rpcUrls?.default?.http?.[0]) ||
    null;
  if (!rpcUrl) throw new Error(`No RPC URL for ${netName} — set ${netName.toUpperCase()}_RPC_URL`);

  const publicClient = createPublicClient({ chain: viemChain, transport: http(rpcUrl) });

  const pimlicoClient = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  // ── Signer (Safe owner) ───────────────────────────────────────────────
  const TESTNETS = new Set([
    "sepolia", "arbitrumSepolia", "baseSepolia",
    "optimismSepolia", "polygonAmoy", "bscTestnet",
  ]);
  const signerKey = TESTNETS.has(netName)
    ? (normalizeKey(process.env.FOUNDER_PRIVATE_KEY) || normalizeKey(process.env.DEPLOYER_PRIVATE_KEY))
    : normalizeKey(process.env.DEPLOYER_PRIVATE_KEY);
  if (!signerKey) throw new Error("No signing key in env (FOUNDER_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY)");
  const signer = privateKeyToAccount(signerKey);

  // ── Safe smart-account ────────────────────────────────────────────────
  const saltNonce = BigInt(opt("SAFE_SALT", "0"));
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [signer],
    version: "1.4.1",
    saltNonce,
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: viemChain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  console.log("──────────────────────────────────────────────────────────────");
  console.log(`Network:        ${netName} (chainId=${chainCfg.id})`);
  console.log(`Bundler:        ${bundlerUrl.replace(PIMLICO_KEY, "***")}`);
  console.log(`RPC:            ${rpcUrl}`);
  console.log(`Signer (EOA):   ${signer.address}`);
  console.log(`Safe (owner):   ${safeAccount.address}`);
  console.log(`LZ Endpoint:    ${chainCfg.lzEp}`);
  console.log("──────────────────────────────────────────────────────────────");

  if (process.env.AA_DRY_RUN === "1") {
    console.log("AA_DRY_RUN=1 set → exiting without sending any UserOps.");
    console.log("Safe address (deterministic):", safeAccount.address);
    console.log("Fund Pimlico sponsorship policy for this Safe before re-running.");
    return;
  }

  const treasury = req("TREASURY_WALLET");
  if (!isAddress(treasury)) throw new Error("TREASURY_WALLET invalid");

  // ── Load artifacts ────────────────────────────────────────────────────
  const splcArt    = loadArtifact("SpiralCoinUpgradeable");
  const proxyArt   = loadArtifact("SPLCProxy");
  const vestingArt = loadArtifact("SPLCPresaleVesting");
  const vaultArt   = loadArtifact("SPLCStakingVault");
  const presaleArt = loadArtifact("SPLCPresalePublic");
  const airdropArt = loadArtifact("SPLCAirdropMerkle");

  // ── Pre-deploy parameters ─────────────────────────────────────────────
  const PREMINE = parseUnits(opt("TESTNET_PREMINE_SPLC", "100000000"), 18);
  const FOUNDER = parseUnits(opt("TESTNET_FOUNDER_SPLC", "0"), 18);

  const now = Math.floor(Date.now() / 1000);
  const startDelayMin = parseInt(opt("PRESALE_START_DELAY_MIN", "10"), 10);
  const durationDays  = parseInt(opt("PRESALE_DURATION_DAYS", "14"), 10);
  const vestingDays   = parseInt(opt("PRESALE_VESTING_DAYS", "0"), 10);
  const startTime  = now + startDelayMin * 60;
  const endTime    = startTime + durationDays * 86400;
  const vestingDur = vestingDays * 86400;
  const vestingStart = vestingDur > 0 ? endTime : 0;

  const splcPerEth = parseUnits(opt("PRESALE_SPLC_PER_ETH", "100000"), 18);
  const hardCapEth = parseEther(opt("PRESALE_HARD_CAP_ETH", "10"));
  const minEth     = parseEther(opt("PRESALE_MIN_ETH", "0.05"));
  const maxEth     = parseEther(opt("PRESALE_MAX_ETH", "2"));

  const airdropDays = parseInt(opt("AIRDROP_DURATION_DAYS", "30"), 10);
  const airdropDeadline = now + airdropDays * 86400;

  // ── Helper: send a single deploy UserOp via CREATE (account = msg.sender) ──
  // The Safe's executor will CREATE this contract — meaning the deployer recorded
  // on-chain is the Safe address, and the resulting contract address is derived
  // from (Safe addr, Safe nonce). Capture address from the receipt's logs[0] OR
  // by reading the deployed code from publicClient at the predicted addr.
  async function deployViaSafe(name, art, constructorArgs) {
    const initCode = encodeDeployData({
      abi: art.abi,
      bytecode: art.bytecode,
      args: constructorArgs,
    });

    console.log(`\n[deploy] ${name} … sending UserOp`);
    const txHash = await smartAccountClient.sendTransaction({
      to: zeroAddress,            // CREATE: viem treats to=0x0 + data as deploy
      data: initCode,
      value: 0n,
    });
    console.log(`           userOp tx: ${txHash}`);

    const rcpt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    // The contractAddress field on receipt may be null for CREATE done by a Safe
    // via executeUserOp — instead inspect logs or trace. Fallback: scan logs[0].address
    // when the first event is emitted from the new contract's constructor.
    let deployed = rcpt.contractAddress || null;
    if (!deployed) {
      // Predict via getContractAddress({ from: safe, nonce })
      // Safe's executor uses CREATE under the hood; for v1.4.1 the executor
      // contract is the Safe itself, so nonce = Safe's CREATE nonce.
      // Easier: scan logs for any address newly emitting bytecode.
      for (const log of rcpt.logs) {
        const code = await publicClient.getBytecode({ address: log.address });
        if (code && code.length > 2) { deployed = log.address; break; }
      }
    }
    if (!deployed) throw new Error(`Could not determine deployed address for ${name}`);
    console.log(`           ${name} @ ${deployed}`);
    return deployed;
  }

  async function callViaSafe(label, to, abi, fn, args, value = 0n) {
    console.log(`[call]   ${label} → ${fn}(${args.length})`);
    const data = encodeFunctionData({ abi, functionName: fn, args });
    const txHash = await smartAccountClient.sendTransaction({ to, data, value });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`           ok (tx ${txHash})`);
    return txHash;
  }

  // ── [1] SPLC implementation ───────────────────────────────────────────
  const splcImpl = await deployViaSafe(
    "SpiralCoinUpgradeable (impl)",
    splcArt,
    [chainCfg.lzEp]   // constructor(address lzEndpoint)
  );

  // ── [2] SPLC proxy (ERC1967Proxy) with initialize() init data ─────────
  const initData = encodeFunctionData({
    abi: splcArt.abi,
    functionName: "initialize",
    args: [
      safeAccount.address,  // premineWallet — Safe holds initial supply
      PREMINE,
      zeroAddress,          // founderWallet
      FOUNDER,
      treasury,
      safeAccount.address,  // staking vault placeholder (rewired below)
      safeAccount.address,  // initialOwner = Safe
    ],
  });
  const splcAddr = await deployViaSafe(
    "SpiralCoinUpgradeable (proxy)",
    proxyArt,
    [splcImpl, initData]
  );

  // ── [3] Vesting ───────────────────────────────────────────────────────
  const vestingAddr = await deployViaSafe(
    "SPLCPresaleVesting", vestingArt, [splcAddr, safeAccount.address]
  );

  // ── [4] Staking vault ─────────────────────────────────────────────────
  const vaultAddr = await deployViaSafe(
    "SPLCStakingVault", vaultArt, [splcAddr, safeAccount.address]
  );

  // ── [5] Presale ───────────────────────────────────────────────────────
  const presaleAddr = await deployViaSafe(
    "SPLCPresalePublic", presaleArt,
    [
      splcAddr, safeAccount.address, treasury,
      splcPerEth, hardCapEth, minEth, maxEth,
      BigInt(startTime), BigInt(endTime),
      BigInt(vestingDur), BigInt(vestingStart),
    ]
  );

  // ── [6] Airdrop ───────────────────────────────────────────────────────
  const airdropAddr = await deployViaSafe(
    "SPLCAirdropMerkle", airdropArt,
    [splcAddr, safeAccount.address, BigInt(airdropDeadline)]
  );

  // ── [7..N] Wire fee receivers + seed funding ──────────────────────────
  await callViaSafe(
    "splc.setFeeReceivers", splcAddr, splcArt.abi,
    "setFeeReceivers", [treasury, vaultAddr]
  );

  const fundPresale = parseUnits(opt("PRESALE_FUND_SPLC", "1000000"), 18);
  const fundStaking = parseUnits(opt("STAKING_FUND_SPLC", "5000000"), 18);
  const fundAirdrop = parseUnits(opt("AIRDROP_FUND_SPLC", "500000"), 18);

  await callViaSafe("splc.transfer→presale", splcAddr, splcArt.abi, "transfer", [presaleAddr, fundPresale]);
  await callViaSafe("splc.transfer→staking", splcAddr, splcArt.abi, "transfer", [vaultAddr,   fundStaking]);
  await callViaSafe("splc.transfer→airdrop", splcAddr, splcArt.abi, "transfer", [airdropAddr, fundAirdrop]);

  for (const [n, addr] of [["presale", presaleAddr], ["airdrop", airdropAddr], ["vesting", vestingAddr]]) {
    await callViaSafe(`splc.setFeeExempt(${n})`, splcAddr, splcArt.abi, "setFeeExempt", [addr, true]);
  }

  const merkleRoot = process.env.AIRDROP_MERKLE_ROOT;
  if (merkleRoot && /^0x[0-9a-fA-F]{64}$/.test(merkleRoot)) {
    await callViaSafe(
      "airdrop.setMerkleRoot", airdropAddr, airdropArt.abi,
      "setMerkleRoot", [merkleRoot, BigInt(airdropDeadline)]
    );
  }

  // ── Persist deployment record ─────────────────────────────────────────
  const out = {
    network: netName,
    chainId: String(chainCfg.id),
    timestamp: new Date().toISOString(),
    deployer: safeAccount.address,           // Safe is the owner / deployer of record
    deployerEOA: signer.address,             // EOA signer of the Safe
    deployMode: "aa-pimlico-safe",
    lzEndpoint: chainCfg.lzEp,
    contracts: {
      SpiralCoinUpgradeable: splcAddr,
      SpiralCoinUpgradeableImpl: splcImpl,
      SPLCPresaleVesting:    vestingAddr,
      SPLCStakingVault:      vaultAddr,
      SPLCPresalePublic:     presaleAddr,
      SPLCAirdropMerkle:     airdropAddr,
    },
    config: {
      treasury,
      premineSplc: PREMINE.toString(),
      presaleStart: startTime,
      presaleEnd: endTime,
      vestingDays,
      splcPerEth: splcPerEth.toString(),
      hardCapEth: hardCapEth.toString(),
      minEth: minEth.toString(),
      maxEth: maxEth.toString(),
      airdropDeadline,
      fundPresale: fundPresale.toString(),
      fundStaking: fundStaking.toString(),
      fundAirdrop: fundAirdrop.toString(),
      merkleRootSet: !!merkleRoot,
    },
  };
  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${netName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✓ Wrote ${path.relative(process.cwd(), outPath)}`);

  console.log("\nNext steps:");
  console.log(`  • Verify:   npx hardhat run scripts/verify-testnet.js --network ${netName}`);
  console.log(`  • LZ peers: npx hardhat run scripts/wireOftPeers.js --network ${netName}`);
  console.log(`  • Safe UI:  https://app.safe.global/home?safe=${safeAccount.address}`);
}

main().catch((err) => {
  console.error("\n✗ deploy-aa failed:");
  console.error(err);
  process.exit(1);
});
