// Usage:
//   1. Paste the Arbiscan challenge message into  scripts/msg.txt  (single line, no quotes)
//   2. Run:  node scripts/signMsg.js
//   3. Signature is printed AND copied to clipboard (Windows)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ethers } = require('ethers');

const msgPath = path.join(__dirname, 'msg.txt');
if (!fs.existsSync(msgPath)) {
  console.error('ERROR: create scripts/msg.txt with the challenge message on one line.');
  process.exit(1);
}
const msg = fs.readFileSync(msgPath, 'utf8').replace(/\r?\n$/, '');
const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk) { console.error('ERROR: DEPLOYER_PRIVATE_KEY missing from .env'); process.exit(1); }

(async () => {
  const w = new ethers.Wallet(pk);
  const sig = await w.signMessage(msg);
  console.log('\nSigner address : ' + w.address);
  console.log('Message length : ' + msg.length);
  console.log('Message        : ' + JSON.stringify(msg));
  console.log('\nSignature (' + sig.length + ' chars):');
  console.log(sig);
  try {
    execSync('clip', { input: sig });
    console.log('\n✓ Copied to clipboard. Paste into Arbiscan Signature Hash box.');
  } catch (e) { /* ignore */ }
})();
