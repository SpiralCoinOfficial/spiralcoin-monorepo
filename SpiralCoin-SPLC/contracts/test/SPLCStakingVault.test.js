// SPDX-License-Identifier: MIT
// Tests for SPLCStakingVault. Uses ERC20Mock as SPLC stand-in.
//
// Run: npx hardhat test test/SPLCStakingVault.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

const E = (n) => ethers.parseUnits(n.toString(), 18);

describe("SPLCStakingVault", function () {
  let splc, vault, owner, alice, bob, carol;

  const STAKE_A = E(100);
  const STAKE_B = E(300);
  const REWARD_RATE = E(1); // 1 SPLC / sec
  const REWARD_FUND = E(10_000);

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("ERC20Mock");
    splc = await Mock.deploy("SpiralCoin", "SPLC");
    await splc.waitForDeployment();

    const Vault = await ethers.getContractFactory("SPLCStakingVault");
    vault = await Vault.deploy(await splc.getAddress(), owner.address);
    await vault.waitForDeployment();

    // Fund vault with rewards
    await splc.mint(await vault.getAddress(), REWARD_FUND);
    // Mint stake tokens to users
    await splc.mint(alice.address, STAKE_A);
    await splc.mint(bob.address,   STAKE_B);
    await splc.mint(carol.address, E(50));

    // Approvals
    await splc.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
    await splc.connect(bob).approve(await vault.getAddress(),   ethers.MaxUint256);
    await splc.connect(carol).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  describe("constructor", () => {
    it("rejects zero splc", async () => {
      const Vault = await ethers.getContractFactory("SPLCStakingVault");
      await expect(Vault.deploy(ethers.ZeroAddress, owner.address)).to.be.reverted;
    });
  });

  describe("setRewardRate", () => {
    it("only owner", async () => {
      await expect(vault.connect(alice).setRewardRate(REWARD_RATE)).to.be.reverted;
    });
    it("enforces MAX_REWARD_RATE cap", async () => {
      const cap = await vault.MAX_REWARD_RATE();
      await expect(vault.setRewardRate(cap + 1n)).to.be.revertedWith("rate cap");
      await vault.setRewardRate(cap); // exactly at cap is OK
    });
    it("emits event", async () => {
      await expect(vault.setRewardRate(REWARD_RATE))
        .to.emit(vault, "RewardRateUpdated").withArgs(REWARD_RATE);
    });
  });

  describe("stake / withdraw / claim cycle", () => {
    it("rejects zero stake/withdraw", async () => {
      await expect(vault.connect(alice).stake(0)).to.be.revertedWith("zero");
      await expect(vault.connect(alice).withdraw(0)).to.be.revertedWith("zero");
    });

    it("cannot withdraw more than staked", async () => {
      await vault.connect(alice).stake(STAKE_A);
      await expect(vault.connect(alice).withdraw(STAKE_A + 1n))
        .to.be.revertedWith("insufficient");
    });

    it("accrues rewards proportional to stake & time", async () => {
      await vault.setRewardRate(REWARD_RATE);
      await vault.connect(alice).stake(STAKE_A);
      // advance ~100s
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine", []);
      const earned = await vault.earned(alice.address);
      // Sole staker for ~100s at 1 SPLC/sec → ~100 SPLC (±1 from block time)
      expect(earned).to.be.gte(E(99));
      expect(earned).to.be.lte(E(101));
    });

    it("splits rewards 3:1 between two stakers (300 vs 100)", async () => {
      await vault.setRewardRate(REWARD_RATE);
      await vault.connect(alice).stake(STAKE_A);   // 100
      await vault.connect(bob).stake(STAKE_B);     // 300
      await ethers.provider.send("evm_increaseTime", [400]);
      await ethers.provider.send("evm_mine", []);
      const ea = await vault.earned(alice.address);
      const eb = await vault.earned(bob.address);
      // bob should earn ~3x alice
      const ratio = (eb * 100n) / ea;
      expect(ratio).to.be.gte(290n);
      expect(ratio).to.be.lte(310n);
    });

    it("claim transfers SPLC and zeroes pending", async () => {
      await vault.setRewardRate(REWARD_RATE);
      await vault.connect(alice).stake(STAKE_A);
      await ethers.provider.send("evm_increaseTime", [50]);
      await ethers.provider.send("evm_mine", []);
      const before = await splc.balanceOf(alice.address);
      await vault.connect(alice).claim();
      const after = await splc.balanceOf(alice.address);
      expect(after - before).to.be.gt(0);
      expect(await vault.earned(alice.address)).to.be.lt(E(2));
    });

    it("withdraw returns principal", async () => {
      await vault.connect(alice).stake(STAKE_A);
      await vault.connect(alice).withdraw(STAKE_A);
      expect(await vault.stakedBalance(alice.address)).to.equal(0);
      expect(await splc.balanceOf(alice.address)).to.equal(STAKE_A);
    });

    it("exit() unstakes + claims in one call", async () => {
      await vault.setRewardRate(REWARD_RATE);
      await vault.connect(alice).stake(STAKE_A);
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine", []);
      await vault.connect(alice).exit();
      expect(await vault.stakedBalance(alice.address)).to.equal(0);
      // got principal back + some rewards on top
      expect(await splc.balanceOf(alice.address)).to.be.gt(STAKE_A);
    });
  });

  describe("claim caps to unstaked reserves", () => {
    it("never pays beyond (balance - totalStaked)", async () => {
      // Deploy a small-funded vault
      const Vault = await ethers.getContractFactory("SPLCStakingVault");
      const smallV = await Vault.deploy(await splc.getAddress(), owner.address);
      await smallV.waitForDeployment();
      await splc.mint(await smallV.getAddress(), E(5)); // tiny reserves
      await splc.connect(alice).approve(await smallV.getAddress(), ethers.MaxUint256);
      await smallV.setRewardRate(E(1));
      await smallV.connect(alice).stake(STAKE_A);
      // advance plenty of time so accrued >> reserves
      await ethers.provider.send("evm_increaseTime", [10_000]);
      await ethers.provider.send("evm_mine", []);
      const before = await splc.balanceOf(alice.address);
      await smallV.connect(alice).claim();
      const paid = (await splc.balanceOf(alice.address)) - before;
      expect(paid).to.be.lte(E(5));
    });
  });

  describe("emergencyWithdraw", () => {
    it("returns principal and forfeits accrued rewards", async () => {
      await vault.setRewardRate(REWARD_RATE);
      await vault.connect(alice).stake(STAKE_A);
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);
      await vault.connect(alice).emergencyWithdraw();
      expect(await vault.stakedBalance(alice.address)).to.equal(0);
      expect(await splc.balanceOf(alice.address)).to.equal(STAKE_A);
      // no pending rewards
      expect(await vault.earned(alice.address)).to.equal(0);
    });
  });

  describe("pausable", () => {
    it("blocks stake while paused, allows emergencyWithdraw", async () => {
      await vault.connect(alice).stake(STAKE_A);
      await vault.pause();
      await expect(vault.connect(bob).stake(STAKE_B)).to.be.reverted;
      // emergency exit still works
      await vault.connect(alice).emergencyWithdraw();
      expect(await vault.stakedBalance(alice.address)).to.equal(0);
    });
  });

  describe("rescueOther", () => {
    it("blocks SPLC drain", async () => {
      await expect(
        vault.rescueOther(await splc.getAddress(), owner.address, 1)
      ).to.be.revertedWith("cannot drain SPLC");
    });
    it("can drain unrelated tokens", async () => {
      const Mock = await ethers.getContractFactory("ERC20Mock");
      const other = await Mock.deploy("Other", "OTH");
      await other.mint(await vault.getAddress(), E(42));
      await vault.rescueOther(await other.getAddress(), owner.address, E(42));
      expect(await other.balanceOf(owner.address)).to.equal(E(42));
    });
  });
});
