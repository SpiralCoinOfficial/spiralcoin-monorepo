// SPDX-License-Identifier: MIT
// Tests for SPLCAirdropMerkle. Uses a 1-leaf Merkle tree (root = double-hashed leaf, proof = []).
//
// Run: npx hardhat test test/SPLCAirdropMerkle.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

const E = (n) => ethers.parseUnits(n.toString(), 18);

// Build OZ-compatible double-hashed leaf for (account, amount).
function leafOf(account, amount) {
  const inner = ethers.keccak256(
    ethers.solidityPacked(["address", "uint256"], [account, amount])
  );
  return ethers.keccak256(inner); // bytes.concat(leaf) for a 32-byte input == leaf
}

describe("SPLCAirdropMerkle", function () {
  let splc, drop, owner, alice, bob;
  let deadline;

  const FUND = E(1000);
  const ALICE_AMT = E(100);

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("ERC20Mock");
    splc = await Mock.deploy("SpiralCoin", "SPLC");
    await splc.waitForDeployment();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    deadline = now + 30 * 24 * 3600; // 30 days

    const Drop = await ethers.getContractFactory("SPLCAirdropMerkle");
    drop = await Drop.deploy(await splc.getAddress(), owner.address, deadline);
    await drop.waitForDeployment();

    await splc.mint(await drop.getAddress(), FUND);

    // 1-leaf tree: root = the leaf hash itself.
    const root = leafOf(alice.address, ALICE_AMT);
    await drop.setMerkleRoot(root, deadline);
  });

  describe("constructor", () => {
    it("rejects deadline in past", async () => {
      const Drop = await ethers.getContractFactory("SPLCAirdropMerkle");
      const past = (await ethers.provider.getBlock("latest")).timestamp - 1;
      await expect(
        Drop.deploy(await splc.getAddress(), owner.address, past)
      ).to.be.revertedWith("deadline in past");
    });
  });

  describe("setMerkleRoot", () => {
    it("only owner", async () => {
      await expect(drop.connect(alice).setMerkleRoot(ethers.ZeroHash, deadline)).to.be.reverted;
    });

    it("can rotate before any claim", async () => {
      const newRoot = leafOf(bob.address, E(50));
      await drop.setMerkleRoot(newRoot, deadline);
      expect(await drop.merkleRoot()).to.equal(newRoot);
    });

    it("locks after first claim", async () => {
      await drop.connect(alice).claim(ALICE_AMT, []);
      await expect(drop.setMerkleRoot(ethers.ZeroHash, deadline))
        .to.be.revertedWith("locked after first claim");
    });
  });

  describe("claim", () => {
    it("happy path: alice claims her amount", async () => {
      await expect(drop.connect(alice).claim(ALICE_AMT, []))
        .to.emit(drop, "Claimed").withArgs(alice.address, ALICE_AMT);
      expect(await splc.balanceOf(alice.address)).to.equal(ALICE_AMT);
      expect(await drop.claimed(alice.address)).to.equal(true);
      expect(await drop.totalClaimed()).to.equal(ALICE_AMT);
      expect(await drop.rootLocked()).to.equal(true);
    });

    it("rejects double-claim", async () => {
      await drop.connect(alice).claim(ALICE_AMT, []);
      await expect(drop.connect(alice).claim(ALICE_AMT, []))
        .to.be.revertedWith("already claimed");
    });

    it("rejects wrong amount (bad proof)", async () => {
      await expect(drop.connect(alice).claim(E(999), []))
        .to.be.revertedWith("bad proof");
    });

    it("rejects non-allowlisted claimant", async () => {
      await expect(drop.connect(bob).claim(ALICE_AMT, []))
        .to.be.revertedWith("bad proof");
    });

    it("rejects when root not set", async () => {
      // Fresh contract, no root set
      const Drop = await ethers.getContractFactory("SPLCAirdropMerkle");
      const fresh = await Drop.deploy(await splc.getAddress(), owner.address, deadline);
      await fresh.waitForDeployment();
      await expect(fresh.connect(alice).claim(ALICE_AMT, []))
        .to.be.revertedWith("root not set");
    });

    it("rejects after deadline", async () => {
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await expect(drop.connect(alice).claim(ALICE_AMT, []))
        .to.be.revertedWith("expired");
    });
  });

  describe("sweepUnclaimed", () => {
    it("only owner", async () => {
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await expect(drop.connect(alice).sweepUnclaimed(owner.address)).to.be.reverted;
    });

    it("blocks while still active", async () => {
      await expect(drop.sweepUnclaimed(owner.address)).to.be.revertedWith("still active");
    });

    it("transfers remaining SPLC to treasury after deadline", async () => {
      await drop.connect(alice).claim(ALICE_AMT, []);
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      const remaining = FUND - ALICE_AMT;
      await expect(drop.sweepUnclaimed(owner.address))
        .to.emit(drop, "UnclaimedSwept").withArgs(owner.address, remaining);
      expect(await splc.balanceOf(owner.address)).to.equal(remaining);
    });
  });

  describe("rescueOther", () => {
    it("blocks SPLC drain", async () => {
      await expect(
        drop.rescueOther(await splc.getAddress(), owner.address, 1)
      ).to.be.revertedWith("cannot drain airdrop SPLC");
    });
  });
});
