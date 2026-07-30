// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title SpiralDAO
 * @notice On-chain governance for the SpiralCoin protocol. Voting power is
 *         derived from delegated SPLC balances (ERC20Votes snapshots).
 *
 * Configuration (timestamp clock — chain-agnostic):
 *   - votingDelay:   1 day  (proposers cannot snipe)
 *   - votingPeriod:  7 days
 *   - proposalThreshold: 100,000 SPLC (anti-spam)
 *   - quorum: 4% of total supply
 *   - All executions routed through a TimelockController (48h delay)
 *
 * The token (SPLC) overrides clock() to return block.timestamp and
 * CLOCK_MODE() to return "mode=timestamp", so the values below are seconds.
 */
contract SpiralDAO is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    constructor(IVotes _token, TimelockController _timelock)
        Governor("SpiralDAO")
        GovernorSettings(
            1 days,        // voting delay
            7 days,        // voting period
            100_000e18     // proposal threshold (100k SPLC)
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        GovernorTimelockControl(_timelock)
    {}

    // ─── Required overrides ──────────────────────────────────────────────
    function votingDelay()
        public view override(Governor, GovernorSettings) returns (uint256)
    { return super.votingDelay(); }

    function votingPeriod()
        public view override(Governor, GovernorSettings) returns (uint256)
    { return super.votingPeriod(); }

    function quorum(uint256 blockNumber)
        public view override(Governor, GovernorVotesQuorumFraction) returns (uint256)
    { return super.quorum(blockNumber); }

    function proposalThreshold()
        public view override(Governor, GovernorSettings) returns (uint256)
    { return super.proposalThreshold(); }

    function state(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl) returns (ProposalState)
    { return super.state(proposalId); }

    function proposalNeedsQueuing(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl) returns (bool)
    { return super.proposalNeedsQueuing(proposalId); }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    // GovernorTimelockControl._cancel calls _timelock.cancel() (external)
    // then deletes _timelockIds[proposalId] (state write). Slither flags
    // this pattern as reentrancy-no-eth. Safe: TimelockController is a
    // trusted OZ contract and cannot re-enter this function.
    // slither-disable-next-line reentrancy-no-eth
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal view override(Governor, GovernorTimelockControl) returns (address)
    { return super._executor(); }

    // ── IERC6372: inherit timestamp clock from the SPLC token ───────────
    // GovernorVotes.clock()/CLOCK_MODE() delegates to the token when the
    // token implements IERC6372 (which SPLC does, returning mode=timestamp).
    function clock() public view override(Governor, GovernorVotes) returns (uint48) {
        return super.clock();
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public view override(Governor, GovernorVotes) returns (string memory) {
        return super.CLOCK_MODE();
    }
}
