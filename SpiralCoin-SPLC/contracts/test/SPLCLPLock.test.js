// SPDX-License-Identifier: MIT
// Hardhat tests for SPLCLPLock — uses a mock ERC721 + mock position manager
// (collect() returns a fixed amount). No real Uniswap involved.

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const ONE_YEAR = 365 * 86400;

describe("SPLCLPLock", function () {
  let pm, lock, owner, depositor, fees, alice;
  const TOKEN_ID = 42;

  beforeEach(async () => {
    [owner, depositor, fees, alice] = await ethers.getSigners();

    const PMMock = await ethers.getContractFactory("MockUniV3PositionManager");
    pm = await PMMock.deploy();
    await pm.waitForDeployment();
    await pm.mint(depositor.address, TOKEN_ID);

    const Lock = await ethers.getContractFactory("SPLCLPLock");
    lock = await Lock.deploy(await pm.getAddress(), owner.address);
    await lock.waitForDeployment();

    await pm.connect(depositor).approve(await lock.getAddress(), TOKEN_ID);
  });

  describe("lock", () => {
    it("rejects duration < 12 months", async () => {
      await expect(
        lock.connect(depositor).lock(TOKEN_ID, fees.address, ONE_YEAR - 1)
      ).to.be.revertedWith("min 12 months");
    });

    it("rejects zero fee recipient", async () => {
      await expect(
        lock.connect(depositor).lock(TOKEN_ID, ethers.ZeroAddress, ONE_YEAR)
      ).to.be.revertedWith("fee recipient");
    });

    it("locks NFT, records state", async () => {
      const dur = ONE_YEAR;
      await lock.connect(depositor).lock(TOKEN_ID, fees.address, dur);

      expect(await pm.ownerOf(TOKEN_ID)).to.equal(await lock.getAddress());
      const l = await lock.locks(TOKEN_ID);
      expect(l.depositor).to.equal(depositor.address);
      expect(l.feeRecipient).to.equal(fees.address);
      expect(l.withdrawn).to.equal(false);
    });

    it("cannot lock the same tokenId twice", async () => {
      await lock.connect(depositor).lock(TOKEN_ID, fees.address, ONE_YEAR);
      await expect(
        lock.connect(depositor).lock(TOKEN_ID, fees.address, ONE_YEAR)
      ).to.be.revertedWith("already locked");
    });
  });

  describe("extend (forward-only, permissionless)", () => {
    beforeEach(async () => {
      await lock.connect(depositor).lock(TOKEN_ID, fees.address, ONE_YEAR);
    });

    it("extending backward reverts", async () => {
      const l = await lock.locks(TOKEN_ID);
      await expect(lock.connect(alice).extend(TOKEN_ID, l.unlockTime - 1n)).to.be.revertedWith("must extend");
    });

    it("anyone can extend forward", async () => {
      const l = await lock.locks(TOKEN_ID);
      const newTime = l.unlockTime + BigInt(ONE_YEAR);
      await lock.connect(alice).extend(TOKEN_ID, newTime);
      const l2 = await lock.locks(TOKEN_ID);
      expect(l2.unlockTime).to.equal(newTime);
    });
  });

  describe("collectFees (permissionless)", () => {
    beforeEach(async () => {
      await lock.connect(depositor).lock(TOKEN_ID, fees.address, ONE_YEAR);
      // Mock collects 100 wei each leg
      await pm.setCollectAmounts(TOKEN_ID, 100, 200);
    });

    it("anyone can trigger, fees flow to feeRecipient on the mock", async () => {
      // Mock just emits / records; assert no revert
      await expect(lock.connect(alice).collectFees(TOKEN_ID))
        .to.emit(lock, "FeesCollected")
        .withArgs(TOKEN_ID, 100, 200);
    });

    it("reverts on unknown tokenId", async () => {
      await expect(lock.connect(alice).collectFees(999)).to.be.revertedWith("no lock");
    });
  });

  describe("withdraw", () => {
    beforeEach(async () => {
      await lock.connect(depositor).lock(TOKEN_ID, fees.address, ONE_YEAR);
    });

    it("cannot withdraw before unlock", async () => {
      await expect(lock.connect(depositor).withdraw(TOKEN_ID)).to.be.revertedWith("still locked");
    });

    it("non-depositor cannot withdraw", async () => {
      await time.increase(ONE_YEAR + 1);
      await expect(lock.connect(alice).withdraw(TOKEN_ID)).to.be.revertedWith("not depositor");
    });

    it("depositor withdraws after unlock", async () => {
      await time.increase(ONE_YEAR + 1);
      await lock.connect(depositor).withdraw(TOKEN_ID);
      expect(await pm.ownerOf(TOKEN_ID)).to.equal(depositor.address);
    });

    it("cannot double-withdraw", async () => {
      await time.increase(ONE_YEAR + 1);
      await lock.connect(depositor).withdraw(TOKEN_ID);
      await expect(lock.connect(depositor).withdraw(TOKEN_ID)).to.be.revertedWith("withdrawn");
    });
  });
});
