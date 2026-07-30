/**
 * bridge-to-arb-sepolia.js — auto-bridge Sepolia ETH to Arbitrum Sepolia.
 *
 * Calls depositEth() on the official Arbitrum Sepolia L1 Inbox contract,
 * which credits the same address on L2 within ~10 minutes.
 *
 * Inbox (Arb Sepolia rollup, deployed on L1 Sepolia):
 *   0xaAe29B0366299461418F5324a79Afc425BE5ae21
 * Reference: https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses
 *
 * Usage:
 *   node scripts/bridge-to-arb-sepolia.js 0.05     # bridge 0.05 Sepolia ETH
 *   node scripts/bridge-to-arb-sepolia.js          # defaults to 0.05
 *
 * Safety: leaves at least 0.005 ETH on Sepolia for L1 gas reserves so you
 * don't strand yourself unable to send another tx.
 */
const { ethers } = require('ethers');
const { ADDRESS, PRIVATE_KEY, RPC } = require('./deployer-info');

const ARB_SEPOLIA_INBOX_ON_L1 = '0xaAe29B0366299461418F5324a79Afc425BE5ae21';
const INBOX_ABI = ['function depositEth() payable returns (uint256)'];
const MIN_L1_RESERVE = ethers.parseEther('0.005');

async function main() {
  if (!RPC.sepolia.https) throw new Error('SEPOLIA_RPC_URL not configured in .env');

  const amountArg = process.argv[2] || '0.05';
  const amount = ethers.parseEther(amountArg);

  const provider = new ethers.JsonRpcProvider(RPC.sepolia.https);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('\n=== Bridge Sepolia ETH → Arbitrum Sepolia ===');
  console.log('Deployer       :', ADDRESS);
  console.log('Bridge amount  :', ethers.formatEther(amount), 'ETH');

  const bal = await provider.getBalance(ADDRESS);
  console.log('Sepolia balance:', ethers.formatEther(bal), 'ETH');

  if (bal < amount + MIN_L1_RESERVE) {
    console.error('\n✗ Insufficient Sepolia balance. Need at least ' +
      ethers.formatEther(amount + MIN_L1_RESERVE) +
      ' ETH (bridge + 0.005 L1 gas reserve).');
    console.error('  Run: node scripts/faucet-helper.js   to top up first.');
    process.exit(1);
  }

  const inbox = new ethers.Contract(ARB_SEPOLIA_INBOX_ON_L1, INBOX_ABI, wallet);

  console.log('\nSending depositEth() → ' + ARB_SEPOLIA_INBOX_ON_L1 + ' ...');
  const tx = await inbox.depositEth({ value: amount });
  console.log('L1 tx submitted :', tx.hash);
  console.log('  ' + RPC.sepolia.explorer + '/tx/' + tx.hash);

  console.log('\nWaiting for L1 confirmation ...');
  const rcpt = await tx.wait();
  console.log('L1 confirmed in block ' + rcpt.blockNumber + ' · gas used ' + rcpt.gasUsed.toString());

  console.log('\n✓ Bridge initiated.');
  console.log('  L2 credit arrives at ' + ADDRESS + ' on Arbitrum Sepolia in ~10 minutes.');
  console.log('  Track L2 with: node scripts/check-balance.js');
}

main().catch(e => { console.error('\n✗ Bridge failed:', e.shortMessage || e.message || e); process.exit(1); });
