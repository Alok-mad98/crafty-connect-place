// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NexusToken ($NEXUS)
 * @notice ERC-20 token for the Nexus Protocol on Base
 * @dev 100M fixed supply. Burn + Permit (EIP-2612).
 *      Supply allocation managed off-chain via transfers after mint.
 */
contract NexusToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 1e18; // 100M tokens

    constructor() ERC20("Nexus", "NEXUS") ERC20Permit("Nexus") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
