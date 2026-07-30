/**
 * deployer-info.js — single source of truth for derived deployer config.
 * Reads contracts/.env and exposes address + RPC endpoints to the helper scripts.
 */
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error('Missing env var: ' + name);
  return v;
}

const pk = req('DEPLOYER_PRIVATE_KEY').startsWith('0x')
  ? req('DEPLOYER_PRIVATE_KEY')
  : '0x' + req('DEPLOYER_PRIVATE_KEY');

const wallet = new ethers.Wallet(pk);
const ADDRESS = wallet.address;

// Derive HTTPS endpoints from WSS where needed.
function wssToHttps(u) {
  if (!u) return null;
  return u.replace(/^wss:\/\//, 'https://').replace('/ws/v3/', '/v3/');
}

const RPC = {
  sepolia: {
    https: process.env.SEPOLIA_RPC_URL
      || wssToHttps(process.env.ALCHEMY_SEPOLIA_WSS_URL)
      || process.env.SEPOLIA_INFURA_RPC_URL,
    explorer: 'https://sepolia.etherscan.io',
    chainId: 11155111,
    name: 'Sepolia',
  },
  arbSepolia: {
    https: process.env.ARB_SEPOLIA_RPC_URL
      || wssToHttps(process.env.ALCHEMY_ARB_SEPOLIA_WSS_URL)
      || wssToHttps(process.env.INFURA_ARB_SEPOLIA_WSS_URL),
    explorer: 'https://sepolia.arbiscan.io',
    chainId: 421614,
    name: 'Arbitrum Sepolia',
  },
};

module.exports = {
  ADDRESS,
  PRIVATE_KEY: pk,
  RPC,
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || null,
  ARBISCAN_API_KEY: process.env.ARBISCAN_API_KEY || null,
};

if (require.main === module) {
  console.log('Deployer address :', ADDRESS);
  console.log('Sepolia RPC      :', RPC.sepolia.https ? '[set]' : '[MISSING]');
  console.log('Arb Sepolia RPC  :', RPC.arbSepolia.https ? '[set]' : '[MISSING]');
}
