//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("MOCK", "MOCK") {
        _mint(msg.sender, 10000000000000000000000);
    }

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}
