// SPDX-License-Identifier: MIT
// Wire LayerZero V2 OFT peers across all deployed chains.
//
// Reads deployments/<network>/SpiralCoinUpgradeable.json from every chain
// and calls setPeer(eid, peerAddress) on each so they trust each other.
//
// Usage (run once per chain after all chains are deployed):
//   npx hardhat run scripts/wireOftPeers.js --network arbitrum
//   npx hardhat run scripts/wireOftPeers.js --network base
//   npx hardhat run scripts/wireOftPeers.js --network polygon

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// LayerZero V2 endpoint IDs
// Source: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
const LZ_EIDS = {
  ethereum: 30101,
  bsc:      30102,
  polygon:  30109,
  arbitrum: 30110,
  optimism: 30111,
  base:     30184,
  sepolia:          40161,
  bscTestnet:       40102,
  arbitrumSepolia:  40231,
  baseSepolia:      40245,
  polygonAmoy:      40267,
};

/**
 * Resolve the SpiralCoinUpgradeable proxy address for a given network by
 * trying both deployment layouts:
 *   1. deployments/<network>/SpiralCoinUpgradeable.json  → { proxy: "0x…" }    (deployUpgradeable.js)
 *   2. deployments/<network>.json                        → { contracts: { SpiralCoinUpgradeable: "0x…" } } (deploy-testnet.js)
 */
function resolveProxy(deploymentsRoot, net) {
  const perContract = path.join(deploymentsRoot, net, "SpiralCoinUpgradeable.json");
  if (fs.existsSync(perContract)) {
    const d = JSON.parse(fs.readFileSync(perContract, "utf8"));
    if (d.proxy) return d.proxy;
  }
  const flat = path.join(deploymentsRoot, `${net}.json`);
  if (fs.existsSync(flat)) {
    const d = JSON.parse(fs.readFileSync(flat, "utf8"));
    const addr = d.contracts && d.contracts.SpiralCoinUpgradeable;
    if (addr) return addr;
  }
  return null;
}

function listKnownNetworks(deploymentsRoot) {
  const out = new Set();
  if (!fs.existsSync(deploymentsRoot)) return [];
  for (const entry of fs.readdirSync(deploymentsRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (fs.existsSync(path.join(deploymentsRoot, entry.name, "SpiralCoinUpgradeable.json"))) {
        out.add(entry.name);
      }
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      out.add(entry.name.replace(/\.json$/, ""));
    }
  }
  return [...out];
}

async function main() {
  const here = network.name;
  console.log("Wiring peers on network:", here);

  const deploymentsRoot = path.join(__dirname, "..", "deployments");
  const myProxy = resolveProxy(deploymentsRoot, here);
  if (!myProxy) {
    throw new Error(
      `No deployment record found for ${here}. Expected either ` +
      `deployments/${here}/SpiralCoinUpgradeable.json or deployments/${here}.json`
    );
  }

  const [signer] = await ethers.getSigners();
  console.log(`  Local OFT: ${myProxy}`);
  console.log(`  Signer:    ${signer.address}`);

  const splc = await ethers.getContractAt("SpiralCoinUpgradeable", myProxy, signer);

  // LZ_PEERS (optional) lets you restrict which counterparts to wire; defaults
  // to every network with a deployment record on disk.
  const explicit = (process.env.LZ_PEERS || "").trim();
  const candidates = explicit
    ? explicit.split(",").map((s) => s.trim()).filter(Boolean)
    : listKnownNetworks(deploymentsRoot);

  const force = process.env.FORCE_REWIRE === "1";
  let wired = 0, skipped = 0;

  for (const otherNet of candidates) {
    if (otherNet === here) continue;
    const eid = LZ_EIDS[otherNet];
    if (!eid) { console.warn(`  ! Skipping ${otherNet}: no EID known`); continue; }

    const otherProxy = resolveProxy(deploymentsRoot, otherNet);
    if (!otherProxy) { console.warn(`  ! Skipping ${otherNet}: no deployment record`); continue; }

    const desired = ethers.zeroPadValue(ethers.getAddress(otherProxy), 32);
    let current = "0x";
    try { current = await splc.peers(eid); } catch (_) { /* unset */ }

    if (!force && current && current.toLowerCase() === desired.toLowerCase()) {
      console.log(`  = ${otherNet} (eid ${eid}) already wired → ${otherProxy}`);
      skipped++;
      continue;
    }

    console.log(`  + setPeer(${otherNet} eid=${eid}) -> ${otherProxy}`);
    const tx = await splc.setPeer(eid, desired);
    const rcpt = await tx.wait();
    console.log(`    tx: ${rcpt.hash}`);
    wired++;
  }

  console.log(`Done. Wired: ${wired}   Skipped (already set): ${skipped}`);
  console.log("Run this script on each peer network too so both sides trust each other.");
}

main().catch((e) => { console.error(e); process.exit(1); });
