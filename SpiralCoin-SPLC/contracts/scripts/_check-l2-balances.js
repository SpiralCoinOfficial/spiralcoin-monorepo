const { ethers } = require("ethers");
const addr = "0x396157D2De70247dBc6895c5d835E46E6eB0BD22";
const ak = process.env.ALCHEMY_API_KEY || "";
const rpcs = {
  arbitrumSepolia: process.env.ARBITRUM_SEPOLIA_RPC_URL || (ak ? "https://arb-sepolia.g.alchemy.com/v2/" + ak : "https://sepolia-rollup.arbitrum.io/rpc"),
  baseSepolia:     process.env.BASE_SEPOLIA_RPC_URL     || (ak ? "https://base-sepolia.g.alchemy.com/v2/" + ak : "https://sepolia.base.org"),
  optimismSepolia: process.env.OPTIMISM_SEPOLIA_RPC_URL || (ak ? "https://opt-sepolia.g.alchemy.com/v2/" + ak : "https://sepolia.optimism.io"),
  polygonAmoy:     process.env.POLYGON_AMOY_RPC_URL     || (ak ? "https://polygon-amoy.g.alchemy.com/v2/" + ak : "https://rpc-amoy.polygon.technology"),
};
(async () => {
  for (const [n, url] of Object.entries(rpcs)) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      const b = await p.getBalance(addr);
      const eth = ethers.formatEther(b);
      const ok = b > 1000000000000000n ? "  FUNDED" : "";
      console.log(n.padEnd(18), eth.padEnd(22), ok);
    } catch (e) {
      console.log(n.padEnd(18), "ERR:", e.message.slice(0, 80));
    }
  }
})();
