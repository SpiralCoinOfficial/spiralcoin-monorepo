/* SpiralCoin · live-config.example.js
 *
 * Copy this file to assets/live-config.js and fill in your provider URLs.
 * assets/live-config.js is gitignored. NEVER commit real keys.
 *
 * Because this is a static site (no server runtime to read .env), the
 * Alchemy/Infura WebSocket URLs MUST live in a client-readable file.
 * To prevent key abuse:
 *   1. Restrict the Alchemy/Infura app to https://www.spiralcoin.net
 *      (Origin allowlist in the provider dashboard).
 *   2. Use the free-tier "browser-safe" key, not your server-side key.
 *   3. Rotate immediately if you see unexpected request volume.
 */
window.SPIRAL_LIVE_CONFIG = {
  alchemy: {
    sepolia:    'wss://eth-sepolia.g.alchemy.com/v2/REPLACE_ME',
    arbSepolia: 'wss://arb-sepolia.g.alchemy.com/v2/REPLACE_ME'
  },
  infura: {
    sepolia:    'wss://sepolia.infura.io/ws/v3/REPLACE_ME',
    arbSepolia: 'wss://arbitrum-sepolia.infura.io/ws/v3/REPLACE_ME'
  },
  // SPLC contract addresses (from contracts/deployments/*.json).
  splc: {
    sepolia: {
      chainId: 11155111,
      token:   '0x0000000000000000000000000000000000000000',
      staking: '0x0000000000000000000000000000000000000000',
      dao:     '0x0000000000000000000000000000000000000000'
    },
    arbSepolia: {
      chainId: 421614,
      token:   '0x0000000000000000000000000000000000000000',
      staking: '0x0000000000000000000000000000000000000000',
      dao:     '0x0000000000000000000000000000000000000000'
    }
  }
};
