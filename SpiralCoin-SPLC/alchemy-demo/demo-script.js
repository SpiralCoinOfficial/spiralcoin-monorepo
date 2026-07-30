/**
 * Alchemy SDK demo — four capabilities in one file.
 *
 * Usage:
 *   node demo-script.js read     # on-chain data (balance, block, tx history)
 *   node demo-script.js events   # subscribe to Transfer events for 30s
 *   node demo-script.js nfts     # NFTs + ERC-20 tokens for a wallet
 *   node demo-script.js send     # send a small testnet tx (requires SENDER_PRIVATE_KEY)
 *   node demo-script.js all      # run read + nfts back-to-back (skips events/send)
 */
"use strict";

require("dotenv").config();
const { Alchemy, Network, Utils } = require("alchemy-sdk");
const { Wallet, JsonRpcProvider, parseEther, formatEther } = require("ethers");

const {
  ALCHEMY_API_KEY,
  NETWORK = "ETH_SEPOLIA",
  TARGET_WALLET,
  TARGET_CONTRACT,
  SENDER_PRIVATE_KEY,
  TX_TO,
  TX_VALUE_ETH = "0.0001",
} = process.env;

if (!ALCHEMY_API_KEY) {
  console.error("Missing ALCHEMY_API_KEY in .env");
  process.exit(1);
}

const network = Network[NETWORK];
if (!network) {
  console.error(`Unknown NETWORK '${NETWORK}'. Use one of: ETH_MAINNET, ETH_SEPOLIA, MATIC_MAINNET, ARB_SEPOLIA, ...`);
  process.exit(1);
}

const alchemy = new Alchemy({ apiKey: ALCHEMY_API_KEY, network });

function banner(title) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + title);
  console.log("=".repeat(60));
}

// ---------------------------------------------------------------------------
// 1) READ on-chain data: balance, current block, recent tx history
// ---------------------------------------------------------------------------
async function demoRead() {
  banner(`READ — wallet ${TARGET_WALLET} on ${NETWORK}`);

  const [block, balanceWei] = await Promise.all([
    alchemy.core.getBlockNumber(),
    alchemy.core.getBalance(TARGET_WALLET, "latest"),
  ]);
  console.log("Current block :", block);
  console.log("ETH balance   :", Utils.formatEther(balanceWei), "ETH");

  const history = await alchemy.core.getAssetTransfers({
    fromAddress: TARGET_WALLET,
    category: ["external", "erc20", "erc721", "erc1155"],
    maxCount: 5,
    order: "desc",
  });
  console.log(`Last ${history.transfers.length} outgoing transfers:`);
  history.transfers.forEach((t, i) => {
    console.log(
      `  ${i + 1}. ${t.category.padEnd(8)} ${String(t.value ?? "").padStart(10)} ${t.asset ?? ""} → ${t.to}  (block ${parseInt(t.blockNum, 16)})`
    );
  });
}

// ---------------------------------------------------------------------------
// 2) EVENTS — subscribe to Transfer events for 30 seconds
// ---------------------------------------------------------------------------
async function demoEvents() {
  banner(`EVENTS — Transfer logs from ${TARGET_CONTRACT} (30s)`);

  // ERC-20/721 Transfer(address indexed from, address indexed to, uint256)
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

  // Standard ethers-style log filter (Alchemy WS accepts this directly)
  const filter = {
    address: TARGET_CONTRACT,
    topics: [TRANSFER_TOPIC],
  };

  let count = 0;
  alchemy.ws.on(filter, (log) => {
    count += 1;
    const from = "0x" + (log.topics[1] || "").slice(26);
    const to = "0x" + (log.topics[2] || "").slice(26);
    const raw = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
    const bn = typeof log.blockNumber === "string"
      ? (log.blockNumber.startsWith("0x") ? parseInt(log.blockNumber, 16) : Number(log.blockNumber))
      : log.blockNumber;
    console.log(`  [#${count}] block ${bn}  ${from} → ${to}  value=${raw.toString()}`);
  });

  console.log("Listening… (Ctrl+C to stop early)");
  await new Promise((r) => setTimeout(r, 30_000));
  await alchemy.ws.removeAllListeners();
  console.log(`Done. Captured ${count} Transfer event(s).`);
}

// ---------------------------------------------------------------------------
// 3) NFTs + ERC-20 token balances for a wallet
// ---------------------------------------------------------------------------
async function demoNfts() {
  banner(`NFTs + TOKENS — wallet ${TARGET_WALLET}`);

  const tokens = await alchemy.core.getTokenBalances(TARGET_WALLET);
  const nonZero = tokens.tokenBalances.filter(
    (t) => t.tokenBalance && t.tokenBalance !== "0x0" && t.tokenBalance !== "0x" + "0".repeat(64)
  );
  console.log(`ERC-20 tokens with non-zero balance: ${nonZero.length}`);
  for (const t of nonZero.slice(0, 10)) {
    try {
      const meta = await alchemy.core.getTokenMetadata(t.contractAddress);
      const raw = BigInt(t.tokenBalance);
      const decimals = meta.decimals ?? 18;
      const human = Number(raw) / 10 ** decimals;
      console.log(`  ${(meta.symbol || "???").padEnd(8)} ${human.toFixed(4).padStart(14)}  (${t.contractAddress})`);
    } catch {
      console.log(`  (unknown) ${t.contractAddress}  raw=${t.tokenBalance}`);
    }
  }

  const nfts = await alchemy.nft.getNftsForOwner(TARGET_WALLET, { pageSize: 10 });
  console.log(`NFTs owned: ${nfts.totalCount}`);
  nfts.ownedNfts.slice(0, 5).forEach((n, i) => {
    console.log(`  ${i + 1}. ${n.contract.name ?? n.contract.address}  #${n.tokenId}  (${n.tokenType})`);
  });
}

// ---------------------------------------------------------------------------
// 4) SEND a transaction via Alchemy RPC
//    Only runs when SENDER_PRIVATE_KEY is set. Uses a testnet by default.
// ---------------------------------------------------------------------------
async function demoSend() {
  banner(`SEND — ${TX_VALUE_ETH} ETH to ${TX_TO} on ${NETWORK}`);

  if (!SENDER_PRIVATE_KEY) {
    console.log("SENDER_PRIVATE_KEY is empty in .env — skipping send demo.");
    console.log("To enable: paste a TESTNET key (not mainnet!) into .env and rerun `node demo-script.js send`.");
    return;
  }

  if (!NETWORK.includes("SEPOLIA") && !NETWORK.includes("GOERLI") && !NETWORK.includes("AMOY")) {
    console.error(`Refusing to send on ${NETWORK}. Switch NETWORK to a testnet in .env first.`);
    process.exit(1);
  }

  const rpcUrl = `https://${networkSubdomain(NETWORK)}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(SENDER_PRIVATE_KEY.startsWith("0x") ? SENDER_PRIVATE_KEY : "0x" + SENDER_PRIVATE_KEY, provider);

  const from = await wallet.getAddress();
  const bal = await provider.getBalance(from);
  console.log("Sender   :", from);
  console.log("Balance  :", formatEther(bal), "ETH");

  if (bal === 0n) {
    console.error("Sender has 0 ETH — fund it from a testnet faucet first.");
    return;
  }

  const tx = await wallet.sendTransaction({
    to: TX_TO,
    value: parseEther(TX_VALUE_ETH),
  });
  console.log("Tx sent  :", tx.hash);
  console.log("Waiting for confirmation…");
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}  status=${receipt.status === 1 ? "OK" : "FAIL"}`);
}

function networkSubdomain(net) {
  // Map Alchemy SDK Network enum names → RPC subdomains
  const m = {
    ETH_MAINNET: "eth-mainnet",
    ETH_SEPOLIA: "eth-sepolia",
    MATIC_MAINNET: "polygon-mainnet",
    MATIC_AMOY: "polygon-amoy",
    ARB_MAINNET: "arb-mainnet",
    ARB_SEPOLIA: "arb-sepolia",
    BASE_MAINNET: "base-mainnet",
    BASE_SEPOLIA: "base-sepolia",
    OPT_MAINNET: "opt-mainnet",
    OPT_SEPOLIA: "opt-sepolia",
  };
  return m[net] || "eth-sepolia";
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------
async function main() {
  const cmd = (process.argv[2] || "read").toLowerCase();
  switch (cmd) {
    case "read":   return demoRead();
    case "events": return demoEvents();
    case "nfts":   return demoNfts();
    case "send":   return demoSend();
    case "all":    await demoRead(); await demoNfts(); return;
    default:
      console.error(`Unknown command '${cmd}'. Try: read | events | nfts | send | all`);
      process.exit(1);
  }
}

main()
  .catch((e) => { console.error("ERROR:", e.message || e); process.exit(1); })
  .finally(() => process.exit(0));
