// SPDX-License-Identifier: MIT
// Hardhat tests for SPLCPresaleVesting.

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const ONE_DAY = 86400;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;

describe("SPLCPresaleVesting", function () {
  let token, vesting, owner, alice, bob, carol;

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    token = await ERC20Mock.deploy("MockSPLC", "mSPLC");
    await token.waitForDeployment();
    await token.mint(owner.address, ethers.parseUnits("1000000000", 18));

    const Vesting = await ethers.getContractFactory("SPLCPresaleVesting");
    vesting = await Vesting.deploy(await token.getAddress(), owner.address);
    await vesting.waitForDeployment();
  });

  async function fund(amount) {
    await token.transfer(await vesting.getAddress(), amount);
  }

  describe("createSchedule", () => {
    it("reverts if underfunded", async () => {
      const start = await time.latest();
      await expect(
        vesting.createSchedule(alice.address, ethers.parseUnits("100", 18), start, 0, ONE_YEAR)
      ).to.be.revertedWith("underfunded");
    });

    it("rejects zero beneficiary", async () => {
      await fund(ethers.parseUnits("100", 18));
      const start = await time.latest();
      await expect(
        vesting.createSchedule(ethers.ZeroAddress, ethers.parseUnits("100", 18), start, 0, ONE_YEAR)
      ).to.be.revertedWith("beneficiary");
    });

    it("rejects duration < cliff", async () => {
      await fund(ethers.parseUnits("100", 18));
      const start = await time.latest();
      await expect(
        vesting.createSchedule(alice.address, ethers.parseUnits("100", 18), start, ONE_YEAR, ONE_MONTH)
      ).to.be.revertedWith("duration<cliff");
    });

    it("rejects second schedule for same beneficiary", async () => {
      await fund(ethers.parseUnits("200", 18));
      const start = await time.latest();
      await vesting.createSchedule(alice.address, ethers.parseUnits("100", 18), start, 0, ONE_YEAR);
      await expect(
        vesting.createSchedule(alice.address, ethers.parseUnits("100", 18), start, 0, ONE_YEAR)
      ).to.be.revertedWith("exists");
    });

    it("only owner", async () => {
      await fund(ethers.parseUnits("100", 18));
      const start = await time.latest();
      await expect(
        vesting.connect(alice).createSchedule(alice.address, ethers.parseUnits("100", 18), start, 0, ONE_YEAR)
      ).to.be.reverted;
    });
  });

  describe("vesting math", () => {
    it("cliff blocks release", async () => {
      const total = ethers.parseUnits("12000", 18);
      await fund(total);
      const start = await time.latest();
      // 12 month cliff, 48 month total
      await vesting.createSchedule(alice.address, total, start, ONE_YEAR, 4 * ONE_YEAR);

      expect(await vesting.vestedAmount(alice.address)).to.equal(0);
      await time.increase(ONE_MONTH * 6);
      expect(await vesting.vestedAmount(alice.address)).to.equal(0);
      await expect(vesting.connect(alice).release()).to.be.revertedWith("nothing");
    });

    it("linear after cliff: 25% at month 12 of 48", async () => {
      const total = ethers.parseUnits("12000", 18);
      await fund(total);
      const start = await time.latest();
      await vesting.createSchedule(alice.address, total, start, ONE_YEAR, 4 * ONE_YEAR);

      await time.increase(ONE_YEAR + 60); // just past cliff
      const vested = await vesting.vestedAmount(alice.address);
      // 1 year of 4 years = 25% = 3000
      const expected = total / 4n;
      // Allow tiny dust from the +60s
      expect(vested).to.be.closeTo(expected, ethers.parseUnits("1", 18));
    });

    it("fully vested at duration end", async () => {
      const total = ethers.parseUnits("12000", 18);
      await fund(total);
      const start = await time.latest();
      await vesting.createSchedule(alice.address, total, start, ONE_YEAR, 4 * ONE_YEAR);
      await time.increase(4 * ONE_YEAR + 1);
      expect(await vesting.vestedAmount(alice.address)).to.equal(total);
    });

    it("release pulls correct amount and updates state", async () => {
      const total = ethers.parseUnits("12000", 18);
      await fund(total);
      const start = await time.latest();
      await vesting.createSchedule(alice.address, total, start, 0, ONE_YEAR);

      await time.increase(ONE_YEAR / 2);
      const before = await token.balanceOf(alice.address);
      await vesting.connect(alice).release();
      const after = await token.balanceOf(alice.address);
      expect(after - before).to.be.closeTo(total / 2n, ethers.parseUnits("1", 18));
    });

    it("non-beneficiary cannot release someone else's", async () => {
      const total = ethers.parseUnits("100", 18);
      await fund(total);
      const start = await time.latest();
      await vesting.createSchedule(alice.address, total, start, 0, ONE_YEAR);
      await time.increase(ONE_YEAR);
      await expect(vesting.connect(bob).release()).to.be.revertedWith("nothing");
    });
  });

  describe("no revoke (trust property)", () => {
    it("owner has no revoke function", async () => {
      expect(vesting.revoke).to.equal(undefined);
    });

    it("rescueOther cannot drain the vesting token", async () => {
      await fund(ethers.parseUnits("100", 18));
      await expect(
        vesting.rescueOther(await token.getAddress(), owner.address, 1)
      ).to.be.revertedWith("cannot drain vesting token");
    });

    it("rescueOther can drain unrelated tokens", async () => {
      const Other = await ethers.getContractFactory("ERC20Mock");
      const other = await Other.deploy("Other", "OTH");
      await other.mint(await vesting.getAddress(), 1000);
      await vesting.rescueOther(await other.getAddress(), owner.address, 1000);
      expect(await other.balanceOf(owner.address)).to.equal(1000);
    });
  });
});
