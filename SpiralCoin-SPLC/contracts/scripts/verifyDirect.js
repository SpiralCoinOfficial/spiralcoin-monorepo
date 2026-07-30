// Direct Etherscan v2 unified API verification.
// Bypasses hardhat-verify (broken on Node 24 due to BigInt-from-Uint8Array).
//
// Etherscan v2 lets a single API key + single endpoint verify on any
// supported chain by passing chainid as a query parameter.
// Docs: https://docs.etherscan.io/etherscan-v2
//
// Usage:
//   node scripts/verifyDirect.js <network>
// Examples:
//   node scripts/verifyDirect.js arbitrum
//   node scripts/verifyDirect.js base
//
// Reads the proxy + implementation address from
// deployments/<network>/SpiralCoinUpgradeable.json, finds the matching
// build-info, then submits both contracts (impl source + proxy auto-detection)
// to the Etherscan v2 endpoint.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { AbiCoder } = require('ethers');

const ENDPOINT = 'https://api.etherscan.io/v2/api';

const NETWORKS = {
  arbitrum:        { chainid: 42161, explorer: 'https://arbiscan.io' },
  base:            { chainid: 8453,  explorer: 'https://basescan.org' },
  mainnet:         { chainid: 1,     explorer: 'https://etherscan.io' },
  optimisticEthereum: { chainid: 10, explorer: 'https://optimistic.etherscan.io' },
  polygon:         { chainid: 137,   explorer: 'https://polygonscan.com' },
  bsc:             { chainid: 56,    explorer: 'https://bscscan.com' },
  arbitrumSepolia: { chainid: 421614, explorer: 'https://sepolia.arbiscan.io' },
  sepolia:         { chainid: 11155111, explorer: 'https://sepolia.etherscan.io' },
  baseSepolia:     { chainid: 84532,  explorer: 'https://sepolia.basescan.org' },
};

const SOLC_LONG = 'v0.8.24+commit.e11b9ed9';
const CONTRACT_PATH = 'contracts/SpiralCoinUpgradeable.sol:SpiralCoinUpgradeable';

const network = process.argv[2];
if (!network || !NETWORKS[network]) {
  console.error(`Usage: node scripts/verifyDirect.js <${Object.keys(NETWORKS).join('|')}>`);
  process.exit(1);
}
const { chainid, explorer } = NETWORKS[network];

const apiKey = process.env.ETHERSCAN_API_KEY;
if (!apiKey) { console.error('ETHERSCAN_API_KEY missing in .env'); process.exit(1); }

const deployFile = path.join(__dirname, '..', 'deployments', network, 'SpiralCoinUpgradeable.json');
if (!fs.existsSync(deployFile)) { console.error(`No deployment at ${deployFile}`); process.exit(1); }
const deployment = JSON.parse(fs.readFileSync(deployFile, 'utf8'));
const { proxy, implementation, lzEndpoint } = deployment;
console.log(`network        : ${network} (chainid ${chainid})`);
console.log(`proxy          : ${proxy}`);
console.log(`implementation : ${implementation}`);
console.log(`lzEndpoint     : ${lzEndpoint}`);

// Find the build-info that contains SpiralCoinUpgradeable
const buildInfoDir = path.join(__dirname, '..', 'artifacts', 'build-info');
const buildInfos = fs.readdirSync(buildInfoDir).filter(f => f.endsWith('.json'));
let buildInfo = null;
for (const f of buildInfos) {
  const bi = JSON.parse(fs.readFileSync(path.join(buildInfoDir, f), 'utf8'));
  if (bi.output && bi.output.contracts && bi.output.contracts['contracts/SpiralCoinUpgradeable.sol']) {
    buildInfo = bi;
    console.log(`build-info     : ${f}`);
    break;
  }
}
if (!buildInfo) { console.error('No build-info contains SpiralCoinUpgradeable.sol'); process.exit(1); }

// ABI-encode constructor args: address _lzEndpoint
const constructorArgs = new AbiCoder()
  .encode(['address'], [lzEndpoint])
  .slice(2); // strip 0x for Etherscan
console.log(`ctor args (hex): ${constructorArgs}`);

// Build a pruned standard-json-input containing ONLY the sources actually
// reachable from SpiralCoinUpgradeable (per the compiler-emitted metadata).
// Etherscan rejects payloads >~500KB; the full build-info is ~740KB.
const metaJson = JSON.parse(
  buildInfo.output.contracts['contracts/SpiralCoinUpgradeable.sol'].SpiralCoinUpgradeable.metadata
);
const neededSourceKeys = Object.keys(metaJson.sources);
const prunedSources = {};
for (const key of neededSourceKeys) {
  if (buildInfo.input.sources[key]) {
    prunedSources[key] = buildInfo.input.sources[key];
  }
}
const prunedInput = {
  language: buildInfo.input.language,
  sources: prunedSources,
  settings: buildInfo.input.settings,
};
const sourceCode = JSON.stringify(prunedInput);
console.log(`payload bytes  : ${sourceCode.length} (${neededSourceKeys.length} source files)`);

async function postForm(url, fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function verify(address, label, hasCtor) {
  console.log(`\n── Submitting ${label} ${address} ──`);

  // Check if already verified
  const check = await getJson(
    `${ENDPOINT}?chainid=${chainid}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`
  );
  if (check.status === '1' && check.result?.[0]?.SourceCode && check.result[0].SourceCode.length > 0) {
    console.log(`  ✓ Already verified.  ${explorer}/address/${address}#code`);
    return true;
  }

  const fields = {
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: address,
    sourceCode,
    codeformat: 'solidity-standard-json-input',
    contractname: CONTRACT_PATH,
    compilerversion: SOLC_LONG,
    constructorArguements: hasCtor ? constructorArgs : '',
  };

  // chainid goes ONLY in the URL for Etherscan v2 (not in body).
  const submit = await postForm(`${ENDPOINT}?chainid=${chainid}`, fields);
  console.log('  submit response:', JSON.stringify(submit));
  if (submit.status !== '1') {
    if (String(submit.result).toLowerCase().includes('already verified')) {
      console.log(`  ✓ Already verified.`);
      return true;
    }
    console.error(`  ✗ Submission failed: ${submit.result}`);
    return false;
  }
  const guid = submit.result;
  console.log(`  GUID: ${guid} — polling status`);

  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const status = await getJson(
      `${ENDPOINT}?chainid=${chainid}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`
    );
    process.stdout.write(`  [${i+1}/30] ${status.result}\n`);
    if (status.status === '1') {
      console.log(`  ✓ Verified.  ${explorer}/address/${address}#code`);
      return true;
    }
    if (/fail|invalid|unable/i.test(status.result)) {
      console.error(`  ✗ Verification failed: ${status.result}`);
      return false;
    }
  }
  console.error('  ✗ Timed out waiting for verification.');
  return false;
}

(async () => {
  // Verify implementation (has constructor with lzEndpoint)
  const okImpl = await verify(implementation, 'implementation', true);

  // Etherscan auto-detects EIP-1967 proxies when the proxy address is queried
  // after the impl is verified. Trigger the proxy detection.
  if (okImpl) {
    console.log(`\n── Triggering proxy linkage for ${proxy} ──`);
    const link = await postForm(`${ENDPOINT}?chainid=${chainid}`, {
      chainid: String(chainid),
      apikey: apiKey,
      module: 'contract',
      action: 'verifyproxycontract',
      address: proxy,
      expectedimplementation: implementation,
    });
    console.log('  proxy link response:', JSON.stringify(link));
    if (link.status === '1') {
      console.log(`  ✓ Proxy linked.  ${explorer}/address/${proxy}#readProxyContract`);
    } else {
      console.log(`  (proxy linkage is non-critical — explorer often auto-detects)`);
    }
  }

  console.log('\nNext: open the token page and click "Update Token Info" to upload the logo.');
  console.log(`  ${explorer}/token/${proxy}`);
})().catch((e) => { console.error(e); process.exit(1); });
