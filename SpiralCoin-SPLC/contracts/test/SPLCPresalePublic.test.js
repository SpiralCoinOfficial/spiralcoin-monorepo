// SPDX-License-Identifier: MIT
// Tests for SPLCPresalePublic. Uses 1-leaf Merkle tree for allowlist tests.
//
// Run: npx hardhat test test/SPLCPresalePublic.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

const E   = (n) => ethers.parseUnits(n.toString(), 18);
const ETH = (n) => ethers.parseEther(n.toString());

// 1-leaf allowlist: root = keccak(keccak(account))
function addressLeaf(account) {
  const inner = ethers.keccak256(ethers.solidityPacked(["address"], [account]));
  return ethers.keccak256(inner);
}

describe("SPLCPresalePublic", function () {
  let splc, sale, owner, treasury, alice, bob;
  let startTime, endTime, vestStart;

  const SPLC_PER_ETH = E(100_000);     // 100k SPLC per ETH
  const HARD_CAP     = ETH(50);
  const MIN_ETH      = ETH("0.1");
  const MAX_ETH      = ETH(5);
  const FUND         = E(10_000_000);  // way more than needed
  const VEST_DUR     = 60 * 24 * 3600; // 60 days

  async function deploySale({ vesting = 0, allow = ethers.ZeroHash } = {}) {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    startTime = now + 10;
    endTime   = now + 30 * 24 * 3600;
    vestStart = startTime;

    const Mock = await ethers.getContractFactory("ERC20Mock");
    splc = await Mock.deploy("SpiralCoin", "SPLC");
    await splc.waitForDeployment();

    const Sale = await ethers.getContractFactory("SPLCPresalePublic");
    sale = await Sale.deploy(
      await splc.getAddress(),
      owner.address,
      treasury.address,
      SPLC_PER_ETH,
      HARD_CAP,
      MIN_ETH,
      MAX_ETH,
      startTime,
      endTime,
      vesting,
      vestStart
    );
    await sale.waitForDeployment();
    await splc.mint(await sale.getAddress(), FUND);

    if (allow !== ethers.ZeroHash) {
      await sale.setAllowRoot(allow);
    }

    // advance to startTime
    await ethers.provider.send("evm_setNextBlockTimestamp", [startTime + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  beforeEach(async () => {
    [owner, treasury, alice, bob] = await ethers.getSigners();
  });

  describe("constructor", () => {
    it("rejects bad params", async () => {
      const Mock = await ethers.getContractFactory("ERC20Mock");
      const t = await Mock.deploy("S", "S");
      await t.waitForDeployment();
      const Sale = await ethers.getContractFactory("SPLCPresalePublic");
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      // bad window
      await expect(Sale.deploy(await t.getAddress(), owner.address, treasury.address,
        SPLC_PER_ETH, HARD_CAP, MIN_ETH, MAX_ETH, now + 100, now + 50, 0, 0))
        .to.be.revertedWith("window");
      // bad min/max
      await expect(Sale.deploy(await t.getAddress(), owner.address, treasury.address,
        SPLC_PER_ETH, HARD_CAP, MAX_ETH, MIN_ETH, now + 10, now + 200, 0, 0))
        .to.be.revertedWith("min/max");
      // zero price
      await expect(Sale.deploy(await t.getAddress(), owner.address, treasury.address,
        0, HARD_CAP, MIN_ETH, MAX_ETH, now + 10, now + 200, 0, 0))
        .to.be.revertedWith("price");
    });
  });

  describe("buy (open / instant)", () => {
    beforeEach(async () => { await deploySale({ vesting: 0 }); });

    it("instant mode delivers SPLC immediately", async () => {
      const buyEth = ETH(1);
      await expect(sale.connect(alice).buy([], { value: buyEth }))
        .to.emit(sale, "Bought");
      expect(await splc.balanceOf(alice.address)).to.equal(E(100_000));
    });

    it("rejects below min", async () => {
      await expect(sale.connect(alice).buy([], { value: ETH("0.05") }))
        .to.be.revertedWith("below min");
    });

    it("enforces per-wallet max across multiple buys", async () => {
      await sale.connect(alice).buy([], { value: ETH(3) });
      await expect(sale.connect(alice).buy([], { value: ETH(3) }))
        .to.be.revertedWith("wallet cap");
    });

    it("forwards ETH to treasury", async () => {
      const before = await ethers.provider.getBalance(treasury.address);
      await sale.connect(alice).buy([], { value: ETH(1) });
      const after = await ethers.provider.getBalance(treasury.address);
      expect(after - before).to.equal(ETH(1));
    });

    it("blocks before start", async () => {
      // fresh sale, do not advance time past start
      const Mock = await ethers.getContractFactory("ERC20Mock");
      const t = await Mock.deploy("S", "S");
      await t.waitForDeployment();
      const Sale = await ethers.getContractFactory("SPLCPresalePublic");
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const s = await Sale.deploy(await t.getAddress(), owner.address, treasury.address,
        SPLC_PER_ETH, HARD_CAP, MIN_ETH, MAX_ETH, now + 1_000_000, now + 2_000_000, 0, 0);
      await s.waitForDeployment();
      await t.mint(await s.getAddress(), FUND);
      await expect(s.connect(alice).buy([], { value: ETH(1) }))
        .to.be.revertedWith("not started");
    });

    it("blocks after end", async () => {
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await expect(sale.connect(alice).buy([], { value: ETH(1) }))
        .to.be.revertedWith("ended");
    });
  });

  describe("buy (allowlist)", () => {
    it("allowlisted address can buy with empty proof on 1-leaf tree", async () => {
      const root = addressLeaf(alice.address);
      await deploySale({ vesting: 0, allow: root });
      await sale.connect(alice).buy([], { value: ETH(1) });
      expect(await splc.balanceOf(alice.address)).to.equal(E(100_000));
    });

    it("non-allowlisted address rejected", async () => {
      const root = addressLeaf(alice.address);
      await deploySale({ vesting: 0, allow: root });
      await expect(sale.connect(bob).buy([], { value: ETH(1) }))
        .to.be.revertedWith("not allowlisted");
    });

    it("setAllowRoot locks after first verified buy", async () => {
      const root = addressLeaf(alice.address);
      await deploySale({ vesting: 0, allow: root });
      await sale.connect(alice).buy([], { value: ETH(1) });
      await expect(sale.setAllowRoot(ethers.ZeroHash))
        .to.be.revertedWith("locked after first verified buy");
    });
  });

  describe("buy (vested)", () => {
    beforeEach(async () => { await deploySale({ vesting: VEST_DUR }); });

    it("delivers nothing immediately", async () => {
      await sale.connect(alice).buy([], { value: ETH(1) });
      expect(await splc.balanceOf(alice.address)).to.equal(0);
      expect((await sale.positions(alice.address)).splcOwed).to.equal(E(100_000));
    });

    it("claim() releases linearly", async () => {
      await sale.connect(alice).buy([], { value: ETH(1) });
      // half-way through vesting
      await ethers.provider.send("evm_increaseTime", [VEST_DUR / 2]);
      await ethers.provider.send("evm_mine", []);
      const before = await splc.balanceOf(alice.address);
      await sale.connect(alice).claim();
      const got = (await splc.balanceOf(alice.address)) - before;
      // ~50k SPLC ± small block-time drift
      expect(got).to.be.gt(E(49_000));
      expect(got).to.be.lt(E(51_000));
    });

    it("fully vested at duration end", async () => {
      await sale.connect(alice).buy([], { value: ETH(1) });
      await ethers.provider.send("evm_increaseTime", [VEST_DUR + 10]);
      await ethers.provider.send("evm_mine", []);
      await sale.connect(alice).claim();
      expect(await splc.balanceOf(alice.address)).to.equal(E(100_000));
    });

    it("nothing reverts", async () => {
      await expect(sale.connect(alice).claim()).to.be.revertedWith("nothing");
    });
  });

  describe("hardCap", () => {
    it("blocks buy that crosses cap", async () => {
      // Custom small-cap sale
      const Mock = await ethers.getContractFactory("ERC20Mock");
      const t = await Mock.deploy("S", "S");
      await t.waitForDeployment();
      const Sale = await ethers.getContractFactory("SPLCPresalePublic");
      const now = (await ethers.provider.getBlock("latest")).timestamp;
      const s = await Sale.deploy(
        await t.getAddress(), owner.address, treasury.address,
        SPLC_PER_ETH, ETH(2), ETH("0.1"), ETH(1), now + 10, now + 1000, 0, 0
      );
      await s.waitForDeployment();
      await t.mint(await s.getAddress(), FUND);
      await ethers.provider.send("evm_setNextBlockTimestamp", [now + 11]);
      await ethers.provider.send("evm_mine", []);
      await s.connect(alice).buy([], { value: ETH(1) });
      await s.connect(bob).buy([], { value: ETH(1) });
      // cap of 2 ETH reached; any more should fail
      const carol = (await ethers.getSigners())[4];
      await expect(s.connect(carol).buy([], { value: ETH(1) }))
        .to.be.revertedWith("hard cap");
    });
  });

  describe("admin", () => {
    beforeEach(async () => { await deploySale({ vesting: 0 }); });

    it("setConfig reverts after totalRaisedEth > 0", async () => {
      await sale.connect(alice).buy([], { value: ETH(1) });
      await expect(
        sale.setConfig(SPLC_PER_ETH, HARD_CAP, MIN_ETH, MAX_ETH, startTime, endTime)
      ).to.be.revertedWith("sale started");
    });

    it("setTreasury only owner, blocks zero", async () => {
      await expect(sale.connect(alice).setTreasury(bob.address)).to.be.reverted;
      await expect(sale.setTreasury(ethers.ZeroAddress)).to.be.revertedWith("zero");
      await sale.setTreasury(bob.address);
      expect(await sale.treasury()).to.equal(bob.address);
    });

    it("pause blocks buys", async () => {
      await sale.pause();
      await expect(sale.connect(alice).buy([], { value: ETH(1) })).to.be.reverted;
    });
  });

  describe("sweepUnsoldSplc", () => {
    it("blocks before endTime", async () => {
      await deploySale({ vesting: 0 });
      await expect(sale.sweepUnsoldSplc(owner.address))
        .to.be.revertedWith("sale active");
    });

    it("after endTime, sweeps balance minus owed", async () => {
      await deploySale({ vesting: VEST_DUR });
      await sale.connect(alice).buy([], { value: ETH(1) });
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      const ownedBefore = await splc.balanceOf(owner.address);
      await sale.sweepUnsoldSplc(owner.address);
      const swept = (await splc.balanceOf(owner.address)) - ownedBefore;
      // Should have swept (FUND - 100_000), keeping owed amount available
      expect(swept).to.equal(FUND - E(100_000));
    });
  });
});
