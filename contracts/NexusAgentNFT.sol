// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NexusAgentNFT (ERC-8004 Compatible)
 * @notice 779 supply NFT for AI agents on Base
 * @dev Tokens 0-1 are treasury (minted to owner on deploy).
 *      Tokens 2-101 are free (first 100 public mints).
 *      Tokens 102-778 cost ~$10 USD in ETH.
 *      Minting is server-side via mintTo() — agents solve PoW off-chain.
 */
contract NexusAgentNFT is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 779;
    uint256 public constant TREASURY_SUPPLY = 2;
    uint256 public constant FREE_SUPPLY = 100;
    uint256 public mintPrice; // In wei, set by owner based on ETH/USD

    uint256 public totalMinted;
    bool public mintActive;

    string public constant METADATA_CID = "QmfVgSpYHDJJg2pC8QKsXdEoHzwjBzEmMj1i6fwsofkWG3";

    // Anti-bot: one mint per wallet
    mapping(address => bool) public hasMinted;

    event Minted(address indexed agent, uint256 indexed tokenId, bool free);
    event MintPriceUpdated(uint256 newPrice);
    event MintToggled(bool active);

    constructor(uint256 _mintPrice) ERC721("Nexus Node", "NNODE") Ownable(msg.sender) {
        mintPrice = _mintPrice;
        mintActive = false;

        // Mint treasury NFTs (token 0 and 1) to owner
        for (uint256 i = 0; i < TREASURY_SUPPLY; i++) {
            _safeMint(msg.sender, totalMinted);
            emit Minted(msg.sender, totalMinted, true);
            totalMinted++;
        }
    }

    /**
     * @notice Server-side mint — called by owner after agent solves PoW
     * @param to The agent wallet that solved the PoW challenge
     */
    function mintTo(address to) external onlyOwner {
        require(mintActive, "Mint not active");
        require(totalMinted < MAX_SUPPLY, "Sold out");
        require(!hasMinted[to], "Already minted");

        bool isFree = totalMinted < (TREASURY_SUPPLY + FREE_SUPPLY);

        hasMinted[to] = true;
        uint256 tokenId = totalMinted;
        totalMinted++;

        _safeMint(to, tokenId);
        emit Minted(to, tokenId, isFree);
    }

    function setMintPrice(uint256 _price) external onlyOwner {
        mintPrice = _price;
        emit MintPriceUpdated(_price);
    }

    function toggleMint(bool _active) external onlyOwner {
        mintActive = _active;
        emit MintToggled(_active);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked(
            "ipfs://", METADATA_CID, "/", _toString(tokenId)
        ));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
