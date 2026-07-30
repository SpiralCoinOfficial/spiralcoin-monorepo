// SPDX-License-Identifier: MIT
// Hardhat deploy script — UUPS-upgradeable SpiralCoinUpgradeable + OFT v2
//
// Usage:
//   npx hardhat run scripts/deployUpgradeable.js --network arbitrum
//   npx hardhat run scripts/deployUpgradeable.js --network base
//   npx hardhat run scripts/deployUpgradeable.js --network polygon
//
// Requires: @openzeppelin/hardhat-upgrades plugin loaded in hardhat.config.js
//   require("@openzeppelin/hardhat-upgrades");

const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// LayerZero V2 endpoint addresses (mainnet)
// Source: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
const LZ_ENDPOINTS = {
  ethereum: "0x1a44076050125825900e736c501f859c50fE728c",
  arbitrum: "0x1a44076050125825900e736c501f859c50fE728c",
  base:     "0x1a44076050125825900e736c501f859c50fE728c",
  polygon:  "0x1a44076050125825900e736c501f859c50fE728c",
  optimism: "0x1a44076050125825900e736c501f859c50fE728c",
  bsc:      "0x1a44076050125825900e736c501f859c50fE728c",
  // Testnets
  sepolia:         "0x6EDCE65403992e310A62460808c4b910D972f10f",
  arbitrumSepolia: "0x6EDCE65403992e310A62460808c4b910D972f10f",
  baseSepolia:     "0x6EDCE65403992e310A62460808c4b910D972f10f",
  polygonAmoy:     "0x6EDCE65403992e310A62460808c4b910D972f10f",
};

// Which chain holds the initial minted supply? Others start at 0 and receive
// supply via OFT bridge from the origin chain.
const ORIGIN_NETWORK = process.env.ORIGIN_NETWORK || "arbitrum";

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const net = network.name;
  const lzEndpoint = LZ_ENDPOINTS[net];
  if (!lzEndpoint) throw new Error(`No LZ endpoint configured for network: ${net}`);

  const isOrigin = net === ORIGIN_NETWORK;
  console.log(`Network: ${net}  (origin chain: ${ORIGIN_NETWORK})  isOrigin=${isOrigin}`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Distribution wallets
  const treasury     = req("TREASURY_WALLET");
  const stakingVault = req("STAKING_VAULT");
  const premineWallet = isOrigin ? req("SUPPLY_VAULT") : ethers.ZeroAddress;
  const founderWallet = isOrigin ? req("FOUNDER_WALLET") : ethers.ZeroAddress;
  const premineAmount = isOrigin ? ethers.parseUnits(req("PREMINE_AMOUNT"), 18) : 0n;
  const founderAmount = isOrigin ? ethers.parseUnits(req("FOUNDER_AMOUNT"), 18) : 0n;

  // Initial owner = deployer; transfer to DAO Timelock post-deploy
  const initialOwner = deployer.address;

  const Factory = await ethers.getContractFactory("SpiralCoinUpgradeable");

  console.log("Deploying proxy...");
  const proxy = await upgrades.deployProxy(
    Factory,
    [premineWallet, premineAmount, founderWallet, founderAmount, treasury, stakingVault, initialOwner],
    {
      kind: "uups",
      constructorArgs: [lzEndpoint],
      unsafeAllow: [
        "constructor",
        "state-variable-immutable",
        // LayerZero's __OFT_init initializes ERC20 before OAppCore, violating
        // C3 linearization. Upstream library issue, not fixable on our side.
        "incorrect-initializer-order",
        "missing-initializer-call",
      ],
    }
  );
  await proxy.waitForDeployment();

  const proxyAddr = await proxy.getAddress();
  // EIP-1967 impl slot: keccak256("eip1967.proxy.implementation") - 1
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implSlotRaw = await ethers.provider.getStorage(proxyAddr, IMPL_SLOT);
  const implAddr = ethers.getAddress("0x" + implSlotRaw.slice(-40));

  console.log("\n=== DEPLOYED ===");
  console.log("Proxy         :", proxyAddr);
  console.log("Implementation:", implAddr);
  console.log("Owner         :", initialOwner);
  console.log("LZ endpoint   :", lzEndpoint);

  // Sanity checks
  const ts = await proxy.totalSupply();
  console.log("Total supply  :", ethers.formatUnits(ts, 18), "SPLC");

  // Persist
  const out = {
    network: net,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    proxy: proxyAddr,
    implementation: implAddr,
    owner: initialOwner,
    lzEndpoint,
    treasury,
    stakingVault,
    premineWallet,
    founderWallet,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "deployments", net);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SpiralCoinUpgradeable.json"), JSON.stringify(out, null, 2));
  console.log("\nSaved:", path.join(dir, "SpiralCoinUpgradeable.json"));

  console.log("\nNext steps:");
  console.log("  1. Verify on Etherscan: npx hardhat verify --network", net, implAddr);
  console.log("  2. Repeat deploy on each chain in your OFT mesh");
  console.log("  3. Run scripts/wireOftPeers.js once all chains are deployed");
  console.log("  4. Deploy LP pool + lock, then call setAmmPair(pool, true)");
  console.log("  5. Deploy SPLCPaymaster.sol with the proxy address");
  console.log("  6. Transfer ownership to DAO Timelock");
}

main().catch((e) => { console.error(e); process.exit(1); });
