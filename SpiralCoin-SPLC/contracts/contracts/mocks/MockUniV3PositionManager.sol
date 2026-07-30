// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev Mock that emulates the minimal Uniswap V3 NonfungiblePositionManager
///      surface used by SPLCLPLock (safeTransferFrom + collect()).
contract MockUniV3PositionManager is ERC721 {
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    mapping(uint256 => uint128) public mockAmount0;
    mapping(uint256 => uint128) public mockAmount1;

    event MockCollected(uint256 indexed tokenId, address recipient, uint256 a0, uint256 a1);

    constructor() ERC721("MockUniV3LP", "mLP") {}

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
    }

    function setCollectAmounts(uint256 tokenId, uint128 a0, uint128 a1) external {
        mockAmount0[tokenId] = a0;
        mockAmount1[tokenId] = a1;
    }

    function collect(CollectParams calldata p) external returns (uint256, uint256) {
        uint256 a0 = mockAmount0[p.tokenId];
        uint256 a1 = mockAmount1[p.tokenId];
        emit MockCollected(p.tokenId, p.recipient, a0, a1);
        return (a0, a1);
    }
}
