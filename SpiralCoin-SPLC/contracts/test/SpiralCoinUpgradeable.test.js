// SPDX-License-Identifier: MIT
// Hardhat tests for SpiralCoinUpgradeable.
//
// Run: npx hardhat test test/SpiralCoinUpgradeable.test.js
//
// We deploy a local MockLZEndpointV2 so OFT initialization (endpoint.setDelegate)
// succeeds. Cross-chain messaging is NOT exercised here — that runs against the
// real LayerZero endpoint on forked testnets.

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

const ZERO = ethers.ZeroAddress;

const PREMINE = ethers.parseUnits("500000000", 18);
const FOUNDER = ethers.parseUnits("500000000", 18);

describe("SpiralCoinUpgradeable", function () {
  let splc, owner, treasury, stakingVault, premineW, founderW, alice, bob, ammPair;
  let lzEndpoint;

  beforeEach(async () => {
    [owner, treasury, stakingVault, premineW, founderW, alice, bob, ammPair] =
      await ethers.getSigners();

    const Endpoint = await ethers.getContractFactory("MockLZEndpointV2");
    lzEndpoint = await Endpoint.deploy();
    await lzEndpoint.waitForDeployment();
    const endpointAddr = await lzEndpoint.getAddress();

    const Factory = await ethers.getContractFactory("SpiralCoinUpgradeable");
    splc = await upgrades.deployProxy(
      Factory,
      [
        premineW.address,
        PREMINE,
        founderW.address,
        FOUNDER,
        treasury.address,
        stakingVault.address,
        owner.address,
      ],
      {
        kind: "uups",
        constructorArgs: [endpointAddr],
        unsafeAllow: [
          "constructor",
          "state-variable-immutable",
          "missing-initializer-call",
          "missing-public-upgradeable-function",
        ],
      }
    );
    await splc.waitForDeployment();
  });

  describe("initialization", () => {
    it("mints premine + founder", async () => {
      expect(await splc.balanceOf(premineW.address)).to.equal(PREMINE);
      expect(await splc.balanceOf(founderW.address)).to.equal(FOUNDER);
      expect(await splc.totalSupply()).to.equal(PREMINE + FOUNDER);
    });

    it("sets metadata", async () => {
      expect(await splc.name()).to.equal("SpiralCoin");
      expect(await splc.symbol()).to.equal("SPLC");
      expect(await splc.decimals()).to.equal(18);
    });

    it("marks fee-exempts at init", async () => {
      expect(await splc.isFeeExempt(owner.address)).to.equal(true);
      expect(await splc.isFeeExempt(treasury.address)).to.equal(true);
      expect(await splc.isFeeExempt(stakingVault.address)).to.equal(true);
      expect(await splc.isFeeExempt(premineW.address)).to.equal(true);
      expect(await splc.isFeeExempt(founderW.address)).to.equal(true);
    });

    it("cannot re-initialize", async () => {
      await expect(
        splc.initialize(
          premineW.address, PREMINE, founderW.address, FOUNDER,
          treasury.address, stakingVault.address, owner.address
        )
      ).to.be.reverted;
    });

    it("FEE_BPS is immutable 314", async () => {
      expect(await splc.FEE_BPS()).to.equal(314);
      expect(await splc.BPS_DENOMINATOR()).to.equal(10000);
    });
  });

  describe("P2P transfers — no tax", () => {
    it("user-to-user transfer keeps full amount", async () => {
      const amt = ethers.parseUnits("1000", 18);
      await splc.connect(premineW).transfer(alice.address, amt);
      await splc.connect(alice).transfer(bob.address, amt);
      expect(await splc.balanceOf(bob.address)).to.equal(amt);
    });
  });

  describe("AMM tax — 3.14% on buys + sells", () => {
    beforeEach(async () => {
      await splc.setAmmPair(ammPair.address, true);
      // alice gets tokens (premine sender is fee-exempt — fund alice)
      await splc.connect(premineW).transfer(alice.address, ethers.parseUnits("10000", 18));
    });

    it("alice sells to pool — tax taken", async () => {
      const sellAmt = ethers.parseUnits("1000", 18);
      const fee = (sellAmt * 314n) / 10000n;
      const treasuryCut = fee / 2n;
      const stakingCut = fee - treasuryCut;
      const netToPool = sellAmt - fee;

      await splc.connect(alice).transfer(ammPair.address, sellAmt);

      expect(await splc.balanceOf(ammPair.address)).to.equal(netToPool);
      expect(await splc.balanceOf(treasury.address)).to.equal(treasuryCut);
      expect(await splc.balanceOf(stakingVault.address)).to.equal(stakingCut);
    });

    it("bob buys from pool — tax taken", async () => {
      // fund pool first via premineW (exempt)
      await splc.connect(premineW).transfer(ammPair.address, ethers.parseUnits("5000", 18));
      const buyAmt = ethers.parseUnits("1000", 18);
      const fee = (buyAmt * 314n) / 10000n;
      const netToBob = buyAmt - fee;
      await splc.connect(ammPair).transfer(bob.address, buyAmt);
      expect(await splc.balanceOf(bob.address)).to.equal(netToBob);
    });

    it("fee-exempt sender bypasses tax even with pool", async () => {
      const amt = ethers.parseUnits("1000", 18);
      // premineW is exempt; transfer TO pool should not tax
      const tBefore = await splc.balanceOf(treasury.address);
      await splc.connect(premineW).transfer(ammPair.address, amt);
      expect(await splc.balanceOf(treasury.address)).to.equal(tBefore); // no fee
      expect(await splc.balanceOf(ammPair.address)).to.be.gte(amt);
    });

    it("non-AMM transfer of taxed-eligible accts is still untaxed", async () => {
      // alice → bob (neither is AMM pair) — no tax
      const amt = ethers.parseUnits("500", 18);
      await splc.connect(alice).transfer(bob.address, amt);
      expect(await splc.balanceOf(bob.address)).to.equal(amt);
    });

    it("emits FeeTaken event", async () => {
      const amt = ethers.parseUnits("100", 18);
      await expect(splc.connect(alice).transfer(ammPair.address, amt))
        .to.emit(splc, "FeeTaken");
    });
  });

  describe("admin gating", () => {
    it("only owner setAmmPair", async () => {
      await expect(splc.connect(alice).setAmmPair(ammPair.address, true)).to.be.reverted;
    });
    it("only owner setFeeExempt", async () => {
      await expect(splc.connect(alice).setFeeExempt(alice.address, true)).to.be.reverted;
    });
    it("only owner setFeeReceivers", async () => {
      await expect(splc.connect(alice).setFeeReceivers(alice.address, bob.address)).to.be.reverted;
    });
    it("setFeeReceivers rejects zero", async () => {
      await expect(splc.setFeeReceivers(ZERO, stakingVault.address)).to.be.reverted;
      await expect(splc.setFeeReceivers(treasury.address, ZERO)).to.be.reverted;
    });
  });

  describe("UUPS upgrade", () => {
    it("only owner can authorize upgrade", async () => {
      const endpointAddr = await lzEndpoint.getAddress();
      const Factory = await ethers.getContractFactory("SpiralCoinUpgradeable");
      const NewImpl = await Factory.connect(alice).deploy(endpointAddr);
      await NewImpl.waitForDeployment();
      await expect(
        splc.connect(alice).upgradeToAndCall(await NewImpl.getAddress(), "0x")
      ).to.be.reverted;
    });

    it("owner upgrade preserves storage", async () => {
      const endpointAddr = await lzEndpoint.getAddress();
      const Factory = await ethers.getContractFactory("SpiralCoinUpgradeable");
      const upgraded = await upgrades.upgradeProxy(
        await splc.getAddress(),
        Factory,
        {
          kind: "uups",
          constructorArgs: [endpointAddr],
          unsafeAllow: [
            "constructor",
            "state-variable-immutable",
            "missing-initializer-call",
            "missing-public-upgradeable-function",
          ],
        }
      );
      expect(await upgraded.balanceOf(premineW.address)).to.equal(PREMINE);
      expect(await upgraded.treasury()).to.equal(treasury.address);
    });
  });

  describe("permit (EIP-2612)", () => {
    it("nonces() works", async () => {
      expect(await splc.nonces(alice.address)).to.equal(0);
    });
  });

  describe("votes (ERC20Votes)", () => {
    it("clock is timestamp-mode", async () => {
      expect(await splc.CLOCK_MODE()).to.equal("mode=timestamp");
    });
    it("auto-delegation requires explicit delegate()", async () => {
      await splc.connect(premineW).transfer(alice.address, ethers.parseUnits("100", 18));
      expect(await splc.getVotes(alice.address)).to.equal(0);
      await splc.connect(alice).delegate(alice.address);
      expect(await splc.getVotes(alice.address)).to.equal(ethers.parseUnits("100", 18));
    });
  });
});
