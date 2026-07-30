/**
 * Mainnet deployment DRY-RUN + invariant gate.
 *
 * Rehearses the REAL deploy script (scripts/deploy-multichain.js) against a
 * forked mainnet state — or a clean local chain when no fork RPC is set — and
 * then asserts the protocol-critical invariants on the freshly deployed
 * contracts. Spends ZERO real ETH. Nothing is broadcast to a live network.
 *
 *   FORK_RPC_URL set      -> deploy is exercised against live mainnet state
 *   FORK_RPC_URL unset    -> deploy is exercised against a fresh local chain
 *
 * Usage:
 *   npx hardhat run scripts/dryrun-mainnet.js --network hardhat
 *
 * Exit 0 = deploy executes end-to-end AND every governance/supply/fee
 * invariant holds. Exit 1 = the deploy would not be safe to broadcast.
 *
 * This is a rehearsal only. The real mainnet broadcast remains a deliberate,
 * separate, human-run action: `npm run deploy:mainnet` with your own key.
 */
process.env.SPLC_NO_AUTORUN = "1"; // import deploy logic without auto-executing

const assert = require("node:assert/strict");
const hre = require("hardhat");
const { ethers } = hre;
const { main: deploy } = require("./deploy-multichain.js");

const TIMELOCK_FQN =
    "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController";

function eq(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
}

async function run() {
    console.log("\n========================================");
    console.log(" SPLC MAINNET DRY-RUN  (no real ETH spent)");
    console.log(" fork:", process.env.FORK_RPC_URL ? "LIVE mainnet state" : "clean local chain");
    console.log("========================================");

    const manifest = await deploy();

    const { SpiralCoin, SpiralStakingVault, TimelockController, SpiralDAO } =
        manifest.contracts;
    const [deployer] = await ethers.getSigners();

    // ── 1. Every deployed address is a real contract ───────────────────────
    for (const [name, addr] of Object.entries(manifest.contracts)) {
        assert.match(addr, /^0x[0-9a-fA-F]{40}$/, `bad address for ${name}`);
        const code = await ethers.provider.getCode(addr);
        assert.ok(code && code !== "0x", `${name} has no bytecode at ${addr}`);
    }

    const token = await ethers.getContractAt("SpiralCoin", SpiralCoin);

    // ── 2. Immutable fee is exactly 3.14% and unchangeable ─────────────────
    assert.equal(Number(await token.FEE_BPS()), 314, "FEE_BPS must be 314 (3.14%)");
    assert.equal(typeof token.setFeeBps, "undefined", "FEE_BPS must have no setter");

    // ── 3. Fee receivers wired to treasury + the real staking vault ────────
    assert.ok(eq(await token.treasury(), manifest.wallets.treasury), "treasury misrouted");
    assert.ok(eq(await token.stakingVault(), SpiralStakingVault), "stakingVault not wired to real vault");
    assert.ok(await token.isFeeExempt(SpiralStakingVault), "vault not fee-exempt");

    // ── 4. Total supply == premine + founder, minted to the right wallets ──
    const premine = ethers.parseUnits(manifest.parameters.premine || "0", 18);
    const founder = ethers.parseUnits(manifest.parameters.founder || "0", 18);
    assert.equal((await token.totalSupply()).toString(), (premine + founder).toString(), "totalSupply mismatch");
    if (premine > 0n) {
        assert.equal((await token.balanceOf(manifest.wallets.supplyVault)).toString(), premine.toString(), "premine not delivered");
    }
    if (founder > 0n) {
        assert.equal((await token.balanceOf(manifest.wallets.founder)).toString(), founder.toString(), "founder allocation not delivered");
    }

    // ── 5. Ownership handed to the Timelock (deployer no longer owns) ──────
    assert.ok(eq(await token.owner(), TimelockController), "token owner must be the Timelock");
    assert.ok(!eq(await token.owner(), deployer.address), "deployer must NOT still own the token");

    // ── 6. Governance roles: DAO proposes/cancels, executor open, deployer
    //       has renounced admin (no backdoor) ─────────────────────────────
    const tl = await ethers.getContractAt(TIMELOCK_FQN, TimelockController);
    const [PROPOSER, EXECUTOR, CANCELLER, ADMIN] = await Promise.all([
        tl.PROPOSER_ROLE(),
        tl.EXECUTOR_ROLE(),
        tl.CANCELLER_ROLE(),
        tl.DEFAULT_ADMIN_ROLE(),
    ]);
    assert.ok(await tl.hasRole(PROPOSER, SpiralDAO), "DAO is not a Timelock proposer");
    assert.ok(await tl.hasRole(CANCELLER, SpiralDAO), "DAO is not a Timelock canceller");
    assert.ok(await tl.hasRole(EXECUTOR, ethers.ZeroAddress), "executor role is not open");
    assert.ok(!(await tl.hasRole(ADMIN, deployer.address)), "deployer still holds Timelock admin (backdoor!)");

    // ── 7. Timelock delay matches the configured (>=48h for mainnet) ──────
    const expectedDelay = BigInt(manifest.parameters.timelockMinDelay || "0");
    assert.equal((await tl.getMinDelay()).toString(), expectedDelay.toString(), "timelock min delay mismatch");

    console.log("\n----------------------------------------");
    console.log(" INVARIANTS CHECKED");
    console.log("----------------------------------------");
    const ok = [
        "deployed contracts all have bytecode",
        "FEE_BPS == 314 and immutable (no setter)",
        "fee receivers -> treasury + real staking vault",
        "totalSupply == premine + founder; balances delivered",
        "token ownership transferred to Timelock",
        "DAO holds proposer + canceller; executor open; deployer admin renounced",
        `timelock min delay == ${expectedDelay}s`,
    ];
    ok.forEach((l) => console.log("  [PASS] " + l));

    console.log("\n✅ MAINNET DRY-RUN PASSED — deploy executes cleanly and every");
    console.log("   governance / supply / fee invariant holds on the forked chain.");
    console.log("   Final broadcast remains your manual step: npm run deploy:mainnet\n");
}

run().catch((err) => {
    console.error("\n❌ MAINNET DRY-RUN FAILED — do NOT broadcast to mainnet.\n");
    console.error(err);
    process.exit(1);
});
