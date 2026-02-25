// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract AgentSkillsMarket {
    // --- State ---
    address public owner;
    address public treasury;
    IERC20 public usdc;
    bool public paused;

    uint256 public skillCount;
    uint256 public constant LISTING_FEE = 500_000; // 0.5 USDC (6 decimals)
    uint256 public constant MIN_PRICE = 2_000_000; // 2.0 USDC
    uint256 public constant CREATOR_SHARE = 9500; // 95.00%
    uint256 public constant BASIS = 10000;

    struct SkillData {
        address creator;
        string ipfsCid;
        uint256 price;
        bool active;
    }

    mapping(uint256 => SkillData) public skills;
    mapping(address => mapping(uint256 => bool)) public hasPurchased;

    // --- Events ---
    event SkillLaunched(uint256 indexed skillId, address indexed creator, string ipfsCid, uint256 price);
    event SkillPurchased(uint256 indexed skillId, address indexed buyer, uint256 price);
    event TreasuryUpdated(address newTreasury);
    event Paused(bool isPaused);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    constructor(address _usdc, address _treasury) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    function launchSkill(string calldata ipfsCid, uint256 price) external whenNotPaused returns (uint256) {
        require(price >= MIN_PRICE, "Price below minimum");
        require(bytes(ipfsCid).length > 0, "Empty CID");
        require(usdc.transferFrom(msg.sender, treasury, LISTING_FEE), "Listing fee failed");

        uint256 skillId = skillCount++;
        skills[skillId] = SkillData(msg.sender, ipfsCid, price, true);

        emit SkillLaunched(skillId, msg.sender, ipfsCid, price);
        return skillId;
    }

    function buySkill(uint256 skillId) external whenNotPaused {
        SkillData storage skill = skills[skillId];
        require(skill.active, "Skill not active");
        require(!hasPurchased[msg.sender][skillId], "Already purchased");
        require(skill.creator != msg.sender, "Cannot buy own skill");

        uint256 creatorAmount = (skill.price * CREATOR_SHARE) / BASIS;
        uint256 treasuryAmount = skill.price - creatorAmount;

        require(usdc.transferFrom(msg.sender, skill.creator, creatorAmount), "Creator payment failed");
        require(usdc.transferFrom(msg.sender, treasury, treasuryAmount), "Treasury payment failed");

        hasPurchased[msg.sender][skillId] = true;
        emit SkillPurchased(skillId, msg.sender, skill.price);
    }

    function updateTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function getSkill(uint256 skillId) external view returns (SkillData memory) {
        return skills[skillId];
    }
}
