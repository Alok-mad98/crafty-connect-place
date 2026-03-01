// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NexusAgentNFT (ERC-8004 Compatible)
 * @notice 777 supply NFT for AI agents on Base
 * @dev First 100 mints free, remaining 677 cost $10 USD in ETH (FCFS)
 *      Minting is server-side via mintTo() — agents solve PoW off-chain.
 */
contract NexusAgentNFT is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 777;
    uint256 public constant FREE_SUPPLY = 100;
    uint256 public mintPrice; // In wei, set by owner based on ETH/USD

    uint256 public totalMinted;
    bool public mintActive;

    string public constant METADATA_CID = "QmPcU97STF7X5LnNnMb238Frmy6WcmecYAqcCXGMf8wTii";

    // Anti-bot: one mint per wallet
    mapping(address => bool) public hasMinted;

    // Anti-bot: track funding sources
    mapping(address => address) public fundingSource;
    mapping(address => uint256) public fundedWalletCount;
    uint256 public constant MAX_FUNDED_MINTS = 3;

    event Minted(address indexed agent, uint256 indexed tokenId, bool free);
    event MintPriceUpdated(uint256 newPrice);
    event MintToggled(bool active);

    constructor(uint256 _mintPrice) ERC721("Nexus Node", "NNODE") Ownable(msg.sender) {
        mintPrice = _mintPrice;
        mintActive = false;
    }

    /**
     * @notice Server-side mint — called by owner/minter after agent solves PoW
     * @param to The agent wallet that solved the PoW challenge
     */
    function mintTo(address to) external onlyOwner {
        require(mintActive, "Mint not active");
        require(totalMinted < MAX_SUPPLY, "Sold out");
        require(!hasMinted[to], "Already minted");

        // Anti-bot: check funding source limits
        address source = fundingSource[to];
        if (source != address(0)) {
            require(fundedWalletCount[source] < MAX_FUNDED_MINTS, "Too many mints from same funding source");
            fundedWalletCount[source]++;
        }

        bool isFree = totalMinted < FREE_SUPPLY;

        hasMinted[to] = true;
        uint256 tokenId = totalMinted;
        totalMinted++;

        _safeMint(to, tokenId);
        emit Minted(to, tokenId, isFree);
    }

    /**
     * @notice Direct mint (payable) — for non-server minting if needed
     */
    function mint() external payable {
        require(mintActive, "Mint not active");
        require(totalMinted < MAX_SUPPLY, "Sold out");
        require(!hasMinted[msg.sender], "Already minted");
        require(msg.sender == tx.origin, "No contracts");

        address source = fundingSource[msg.sender];
        if (source != address(0)) {
            require(fundedWalletCount[source] < MAX_FUNDED_MINTS, "Too many mints from same funding source");
            fundedWalletCount[source]++;
        }

        bool isFree = totalMinted < FREE_SUPPLY;
        if (!isFree) {
            require(msg.value >= mintPrice, "Insufficient ETH");
        }

        hasMinted[msg.sender] = true;
        uint256 tokenId = totalMinted;
        totalMinted++;

        _safeMint(msg.sender, tokenId);

        if (msg.value > mintPrice && !isFree) {
            payable(msg.sender).transfer(msg.value - mintPrice);
        }

        emit Minted(msg.sender, tokenId, isFree);
    }

    function registerFundingSource(address wallet, address source) external onlyOwner {
        fundingSource[wallet] = source;
    }

    function batchRegisterFunding(address[] calldata wallets, address[] calldata sources) external onlyOwner {
        require(wallets.length == sources.length, "Length mismatch");
        for (uint256 i = 0; i < wallets.length; i++) {
            fundingSource[wallets[i]] = sources[i];
        }
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
