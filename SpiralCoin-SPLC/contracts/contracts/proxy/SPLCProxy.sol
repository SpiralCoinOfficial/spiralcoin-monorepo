// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Re-export OZ ERC1967Proxy so hardhat compiles the artifact and the
// AA deploy pipeline (scripts/deploy-aa.js) can deploy it via UserOps.
// Standard hardhat-upgrades deploys (deploy-testnet / deployUpgradeable)
// do not need this — they pull the proxy bytecode from the plugin.
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract SPLCProxy is ERC1967Proxy {
    constructor(address implementation, bytes memory _data)
        ERC1967Proxy(implementation, _data)
    {}
}
