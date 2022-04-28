//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    constructor() ERC721("MOCK", "MOCK") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}