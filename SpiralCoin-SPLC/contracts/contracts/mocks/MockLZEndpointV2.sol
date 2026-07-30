// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockLZEndpointV2
 * @notice Minimal LayerZero V2 endpoint stub for local Hardhat tests.
 *         OFTUpgradeable initialization calls `endpoint.setDelegate(...)`.
 *         Cross-chain messaging is NOT exercised — that runs against the real
 *         endpoint on forked testnets.
 */
contract MockLZEndpointV2 {
    mapping(address => address) public delegates;

    event DelegateSet(address indexed oapp, address indexed delegate);

    function setDelegate(address _delegate) external {
        delegates[msg.sender] = _delegate;
        emit DelegateSet(msg.sender, _delegate);
    }

    // Common no-op stubs so unexpected calls don't silently misbehave in tests.
    function eid() external pure returns (uint32) {
        return 30101; // arbitrary EID
    }
}
