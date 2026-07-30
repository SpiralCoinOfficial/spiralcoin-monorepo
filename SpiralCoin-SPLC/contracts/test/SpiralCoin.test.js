const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SpiralCoin (SPLC) — 3.14% AMM tax", function () {
  let token, vault, owner, treasury, founder, premine, alice, bob, ammPair, mockTreasuryEOA;
  const PREMINE = ethers.parseUnits("900000000", 18); // 900M
  const FOUNDER = ethers.parseUnits("100000000", 18); // 100M

  beforeEach(async () => {
    [owner, treasury, founder, premine, alice, bob, ammPair, mockTreasuryEOA] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory("SpiralCoin");
    token = await Token.deploy(
      premine.address,
      PREMINE,
      founder.address,
      FOUNDER,
      treasury.address,
      owner.address // temporary; replaced with vault
    );
    await token.waitForDeployment();

    const Vault = await ethers.getContractFactory("SpiralStakingVault");
    vault = await Vault.deploy(await token.getAddress());
    await vault.waitForDeployment();

    await token.setFeeReceivers(treasury.address, await vault.getAddress());
    await token.setFeeExempt(await vault.getAddress(), true);
    await token.setAmmPair(ammPair.address, true);
  });

  describe("Construction invariants", () => {
    it("mints exact premine + founder supply", async () => {
      expect(await token.balanceOf(premine.address)).to.equal(PREMINE);
      expect(await token.balanceOf(founder.address)).to.equal(FOUNDER);
      expect(await token.totalSupply()).to.equal(PREMINE + FOUNDER);
    });

    it("FEE_BPS is exactly 314 and is a constant", async () => {
      expect(await token.FEE_BPS()).to.equal(314n);
      expect(await token.BPS_DENOMINATOR()).to.equal(10000n);
    });

    it("has no setFeeBps function (immutable)", async () => {
      expect(token.interface.fragments.find((f) => f.name === "setFeeBps")).to
        .be.undefined;
    });

    it("founder/premine/treasury/vault all fee-exempt by default", async () => {
      expect(await token.isFeeExempt(premine.address)).to.equal(true);
      expect(await token.isFeeExempt(founder.address)).to.equal(true);
      expect(await token.isFeeExempt(treasury.address)).to.equal(true);
      expect(await token.isFeeExempt(await vault.getAddress())).to.equal(true);
    });
  });

  describe("Wallet-to-wallet transfers (NEVER taxed)", () => {
    it("P2P transfer between non-exempt wallets pays zero fee", async () => {
      // Give alice some tokens (founder is exempt, so this transfer is free)
      await token.connect(founder).transfer(alice.address, ethers.parseUnits("1000", 18));
      await token.setFeeExempt(alice.address, false);
      await token.setFeeExempt(bob.address, false);

      const before = await token.balanceOf(treasury.address);
      await token.connect(alice).transfer(bob.address, ethers.parseUnits("1000", 18));
      const after = await token.balanceOf(treasury.address);

      expect(after).to.equal(before); // treasury got nothing
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseUnits("1000", 18));
    });
  });

  describe("AMM trades (3.14% tax, 50/50 split)", () => {
    beforeEach(async () => {
      // Seed AMM with tokens (from founder, who is exempt -> no tax on seeding)
      await token.connect(founder).transfer(ammPair.address, ethers.parseUnits("10000", 18));
    });

    it("BUY (AMM → user) charges exactly 3.14%, 50/50 split", async () => {
      const amount = ethers.parseUnits("10000", 18);
      const tx = await token.connect(ammPair).transfer(alice.address, amount);
      await tx.wait();

      // 3.14% of 10000 = 314 SPLC fee → 157 treasury, 157 staking, 9686 to alice
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseUnits("9686", 18));
      expect(await token.balanceOf(treasury.address)).to.equal(ethers.parseUnits("157", 18));
      expect(await token.balanceOf(await vault.getAddress())).to.equal(ethers.parseUnits("157", 18));
    });

    it("SELL (user → AMM) charges exactly 3.14%, 50/50 split", async () => {
      // alice gets tokens tax-free via founder, then sells into AMM
      await token.connect(founder).transfer(alice.address, ethers.parseUnits("10000", 18));
      await token.setFeeExempt(alice.address, false);

      const treasuryBefore = await token.balanceOf(treasury.address);
      const vaultBefore = await token.balanceOf(await vault.getAddress());

      await token.connect(alice).transfer(ammPair.address, ethers.parseUnits("10000", 18));

      expect((await token.balanceOf(treasury.address)) - treasuryBefore).to.equal(ethers.parseUnits("157", 18));
      expect((await token.balanceOf(await vault.getAddress())) - vaultBefore).to.equal(ethers.parseUnits("157", 18));
    });

    it("Conservation: treasury + staking + recipient == sent amount", async () => {
      const amount = ethers.parseUnits("12345.678", 18);
      // top up ammPair so it definitely has >= amount
      await token.connect(founder).transfer(ammPair.address, amount);
      const recipientBefore = await token.balanceOf(alice.address);
      const treasuryBefore = await token.balanceOf(treasury.address);
      const vaultBefore = await token.balanceOf(await vault.getAddress());

      await token.connect(ammPair).transfer(alice.address, amount);

      const delta =
        (await token.balanceOf(alice.address)) - recipientBefore +
        ((await token.balanceOf(treasury.address)) - treasuryBefore) +
        ((await token.balanceOf(await vault.getAddress())) - vaultBefore);

      expect(delta).to.equal(amount);
    });

    it("emits FeeTaken with correct split", async () => {
      const amount = ethers.parseUnits("10000", 18);
      await expect(token.connect(ammPair).transfer(alice.address, amount))
        .to.emit(token, "FeeTaken")
        .withArgs(
          ammPair.address,
          alice.address,
          ethers.parseUnits("157", 18),
          ethers.parseUnits("157", 18)
        );
    });

    it("exempt user trading with AMM pays zero tax", async () => {
      // alice is exempt -> AMM → alice should NOT be taxed
      await token.setFeeExempt(alice.address, true);
      const before = await token.balanceOf(treasury.address);
      await token.connect(ammPair).transfer(alice.address, ethers.parseUnits("10000", 18));
      expect(await token.balanceOf(treasury.address)).to.equal(before);
    });
  });

  describe("Edge cases", () => {
    it("tiny value (< 10000/314) pays zero fee (integer floor)", async () => {
      // fee = value * 314 / 10000; for value <= 31 wei → fee floors to 0
      await token.connect(founder).transfer(ammPair.address, 31n);
      const before = await token.balanceOf(treasury.address);
      await token.connect(ammPair).transfer(alice.address, 31n);
      expect(await token.balanceOf(treasury.address)).to.equal(before);
      // alice gets full 31 wei since fee = 0
      expect(await token.balanceOf(alice.address)).to.equal(31n);
    });

    it("zero-value transfer succeeds with no fee", async () => {
      await token.connect(ammPair).transfer(alice.address, 0n);
      expect(await token.balanceOf(alice.address)).to.equal(0n);
    });

    it("odd-wei fee: stakingCut captures the remainder", async () => {
      // pick amount where 3.14% gives an odd number of wei
      // 100 wei * 314 / 10000 = 3 wei fee -> treasury=1, staking=2
      await token.connect(founder).transfer(ammPair.address, 100n);
      const treasuryBefore = await token.balanceOf(treasury.address);
      const vaultBefore = await token.balanceOf(await vault.getAddress());
      await token.connect(ammPair).transfer(alice.address, 100n);
      expect((await token.balanceOf(treasury.address)) - treasuryBefore).to.equal(1n);
      expect((await token.balanceOf(await vault.getAddress())) - vaultBefore).to.equal(2n);
      expect(await token.balanceOf(alice.address)).to.equal(97n);
    });

    it("insufficient balance reverts cleanly", async () => {
      await token.connect(founder).transfer(ammPair.address, ethers.parseUnits("100", 18));
      await expect(
        token.connect(ammPair).transfer(alice.address, ethers.parseUnits("200", 18))
      ).to.be.reverted;
    });
  });

  describe("Access control", () => {
    it("non-owner cannot setAmmPair", async () => {
      await expect(token.connect(alice).setAmmPair(bob.address, true)).to.be.reverted;
    });
    it("non-owner cannot setFeeExempt", async () => {
      await expect(token.connect(alice).setFeeExempt(bob.address, true)).to.be.reverted;
    });
    it("non-owner cannot setFeeReceivers", async () => {
      await expect(
        token.connect(alice).setFeeReceivers(bob.address, bob.address)
      ).to.be.reverted;
    });
    it("rejects zero-address receivers", async () => {
      await expect(
        token.setFeeReceivers(ethers.ZeroAddress, treasury.address)
      ).to.be.revertedWith("zero receiver");
    });
  });

  describe("ERC20Votes — DAO voting power", () => {
    it("delegated balance counts as voting power", async () => {
      await token.connect(founder).delegate(founder.address);
      const votes = await token.getVotes(founder.address);
      expect(votes).to.equal(FOUNDER);
    });
  });

  describe("ERC20Permit — gasless approval", () => {
    it("nonces() returns 0 for new address", async () => {
      expect(await token.nonces(alice.address)).to.equal(0n);
    });
  });
});

describe("SpiralStakingVault", function () {
  let token, vault, owner, treasury, founder, premine, alice, bob, ammPair;

  beforeEach(async () => {
    [owner, treasury, founder, premine, alice, bob, ammPair] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory("SpiralCoin");
    token = await Token.deploy(
      premine.address,
      ethers.parseUnits("900000000", 18),
      founder.address,
      ethers.parseUnits("100000000", 18),
      treasury.address,
      owner.address
    );
    const Vault = await ethers.getContractFactory("SpiralStakingVault");
    vault = await Vault.deploy(await token.getAddress());
    await token.setFeeReceivers(treasury.address, await vault.getAddress());
    await token.setFeeExempt(await vault.getAddress(), true);

    // Give alice and bob some SPLC (founder is exempt → no tax)
    await token.connect(founder).transfer(alice.address, ethers.parseUnits("10000", 18));
    await token.connect(founder).transfer(bob.address, ethers.parseUnits("10000", 18));
  });

  it("stake → claim → unstake full cycle", async () => {
    const vaultAddr = await vault.getAddress();
    await token.connect(alice).approve(vaultAddr, ethers.parseUnits("1000", 18));
    await vault.connect(alice).stake(ethers.parseUnits("1000", 18));
    expect(await vault.totalStaked()).to.equal(ethers.parseUnits("1000", 18));

    // Treasury donates 100 SPLC of rewards via notifyRewardAmount
    await token.connect(founder).approve(vaultAddr, ethers.parseUnits("100", 18));
    await vault.connect(founder).notifyRewardAmount(ethers.parseUnits("100", 18));

    expect(await vault.pending(alice.address)).to.equal(ethers.parseUnits("100", 18));

    const beforeBal = await token.balanceOf(alice.address);
    await vault.connect(alice).claim();
    expect((await token.balanceOf(alice.address)) - beforeBal).to.equal(
      ethers.parseUnits("100", 18)
    );

    await vault.connect(alice).unstake(ethers.parseUnits("1000", 18));
    expect(await vault.totalStaked()).to.equal(0n);
  });

  it("proportional rewards between two stakers (3:1 ratio)", async () => {
    const vaultAddr = await vault.getAddress();

    await token.connect(alice).approve(vaultAddr, ethers.parseUnits("3000", 18));
    await vault.connect(alice).stake(ethers.parseUnits("3000", 18));

    await token.connect(bob).approve(vaultAddr, ethers.parseUnits("1000", 18));
    await vault.connect(bob).stake(ethers.parseUnits("1000", 18));

    // 400 reward → alice should get 300, bob 100
    await token.connect(founder).approve(vaultAddr, ethers.parseUnits("400", 18));
    await vault.connect(founder).notifyRewardAmount(ethers.parseUnits("400", 18));

    expect(await vault.pending(alice.address)).to.equal(ethers.parseUnits("300", 18));
    expect(await vault.pending(bob.address)).to.equal(ethers.parseUnits("100", 18));
  });

  it("rewards notified before any stake remain claimable", async () => {
    const vaultAddr = await vault.getAddress();
    await token.connect(founder).approve(vaultAddr, ethers.parseUnits("500", 18));
    await vault.connect(founder).notifyRewardAmount(ethers.parseUnits("500", 18));
    // totalStaked == 0 → reward sits in contract, accRewardPerShare unchanged
    expect(await vault.accRewardPerShare()).to.equal(0n);
    expect(await token.balanceOf(vaultAddr)).to.equal(ethers.parseUnits("500", 18));
  });

  it("unstake more than staked reverts", async () => {
    const vaultAddr = await vault.getAddress();
    await token.connect(alice).approve(vaultAddr, ethers.parseUnits("100", 18));
    await vault.connect(alice).stake(ethers.parseUnits("100", 18));
    await expect(
      vault.connect(alice).unstake(ethers.parseUnits("101", 18))
    ).to.be.revertedWith("bad amount");
  });
});

describe("SpiralDAO (Governor)", function () {
  let token, timelock, dao, owner, voter;
  const MIN_DELAY = 172800n; // 48h

  beforeEach(async () => {
    [owner, voter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("SpiralCoin");
    token = await Token.deploy(
      voter.address,
      ethers.parseUnits("1000000000", 18), // 1B premine to voter for quorum
      owner.address,
      0,
      owner.address,
      owner.address
    );

    const Timelock = await ethers.getContractFactory(
      "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController"
    );
    timelock = await Timelock.deploy(MIN_DELAY, [], [], owner.address);

    const DAO = await ethers.getContractFactory("SpiralDAO");
    dao = await DAO.deploy(await token.getAddress(), await timelock.getAddress());
  });

  it("deploys with correct configuration", async () => {
    expect(await dao.votingDelay()).to.equal(86400n); // 1 day
    expect(await dao.votingPeriod()).to.equal(604800n); // 7 days
    expect(await dao.proposalThreshold()).to.equal(ethers.parseUnits("100000", 18));
  });

  it("4% quorum is reachable by voter with 1B tokens", async () => {
    await token.connect(voter).delegate(voter.address);
    // mine one block so checkpoint is in the past
    await ethers.provider.send("evm_mine");
    const blockNumber = await ethers.provider.getBlockNumber();
    const quorum = await dao.quorum(blockNumber - 1);
    const voterPower = await token.getVotes(voter.address);
    expect(voterPower).to.be.gt(quorum);
  });
});
