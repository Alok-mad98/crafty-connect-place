// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title NexusTreasury
 * @notice Collects fees from DataMining + marketplace, executes buyback & burn.
 * @dev Revenue flow:
 *      - ETH fees from mining game → buyback $NEXUS on DEX → 70% burn, 20% NFT holders, 10% stakers
 *      - $NEXUS fees from mining game → burned directly
 *      - Owner triggers buybacks manually (can be automated via keeper later)
 */
contract NexusTreasury is Ownable {
    ERC20Burnable public immutable nexusToken;

    // Distribution ratios (basis points, total = 10000)
    uint256 public burnRatio = 7000;       // 70% burned
    uint256 public nftHolderRatio = 2000;  // 20% to NFT stakers
    uint256 public coreStakerRatio = 1000; // 10% to core stakers

    // Reward pools (accumulated $NEXUS for distribution)
    uint256 public nftRewardPool;
    uint256 public coreRewardPool;

    // Tracking
    uint256 public totalBurned;
    uint256 public totalDistributed;

    // Authorized fee sources (DataMining contract, marketplace, etc.)
    mapping(address => bool) public authorizedSources;

    event ETHReceived(address indexed from, uint256 amount);
    event NexusReceived(address indexed from, uint256 amount);
    event BuybackExecuted(uint256 ethSpent, uint256 nexusBought);
    event NexusBurned(uint256 amount);
    event NexusDistributed(uint256 toNftPool, uint256 toCorePool);
    event RewardsClaimed(address indexed to, uint256 amount, string pool);
    event RatiosUpdated(uint256 burn, uint256 nft, uint256 core);

    constructor(address _nexusToken) Ownable(msg.sender) {
        nexusToken = ERC20Burnable(_nexusToken);
    }

    // --- Fee Collection ---

    /// @notice Receive ETH fees from mining game
    receive() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }

    /// @notice Receive $NEXUS fees — burned directly
    function depositNexus(uint256 amount) external {
        require(amount > 0, "Zero amount");
        nexusToken.transferFrom(msg.sender, address(this), amount);

        // $NEXUS fees are burned directly
        uint256 toBurn = (amount * burnRatio) / 10000;
        uint256 toNft = (amount * nftHolderRatio) / 10000;
        uint256 toCore = amount - toBurn - toNft;

        if (toBurn > 0) {
            nexusToken.burn(toBurn);
            totalBurned += toBurn;
            emit NexusBurned(toBurn);
        }

        nftRewardPool += toNft;
        coreRewardPool += toCore;
        totalDistributed += toNft + toCore;

        emit NexusDistributed(toNft, toCore);
    }

    // --- Buyback ---

    /// @notice Owner executes buyback by swapping ETH for $NEXUS on DEX, then sending here
    /// @dev In production, this would integrate with Aerodrome/Uniswap router.
    ///      For now, owner buys off-chain and sends $NEXUS to distribute.
    function distributeBuyback(uint256 nexusAmount) external onlyOwner {
        require(nexusAmount > 0, "Zero amount");
        nexusToken.transferFrom(msg.sender, address(this), nexusAmount);

        uint256 toBurn = (nexusAmount * burnRatio) / 10000;
        uint256 toNft = (nexusAmount * nftHolderRatio) / 10000;
        uint256 toCore = nexusAmount - toBurn - toNft;

        if (toBurn > 0) {
            nexusToken.burn(toBurn);
            totalBurned += toBurn;
            emit NexusBurned(toBurn);
        }

        nftRewardPool += toNft;
        coreRewardPool += toCore;
        totalDistributed += toNft + toCore;

        emit BuybackExecuted(0, nexusAmount);
        emit NexusDistributed(toNft, toCore);
    }

    // --- Reward Claims (called by staking contracts) ---

    /// @notice Staking contracts call this to withdraw from their pool
    function claimNftRewards(address to, uint256 amount) external onlyOwner {
        require(amount <= nftRewardPool, "Exceeds pool");
        nftRewardPool -= amount;
        nexusToken.transfer(to, amount);
        emit RewardsClaimed(to, amount, "nft");
    }

    function claimCoreRewards(address to, uint256 amount) external onlyOwner {
        require(amount <= coreRewardPool, "Exceeds pool");
        coreRewardPool -= amount;
        nexusToken.transfer(to, amount);
        emit RewardsClaimed(to, amount, "core");
    }

    // --- Admin ---

    function setRatios(uint256 _burn, uint256 _nft, uint256 _core) external onlyOwner {
        require(_burn + _nft + _core == 10000, "Must total 10000");
        burnRatio = _burn;
        nftHolderRatio = _nft;
        coreStakerRatio = _core;
        emit RatiosUpdated(_burn, _nft, _core);
    }

    function setAuthorizedSource(address source, bool authorized) external onlyOwner {
        authorizedSources[source] = authorized;
    }

    /// @notice Withdraw ETH for off-chain buyback execution
    function withdrawETH(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Exceeds balance");
        payable(owner()).transfer(amount);
    }

    /// @notice Emergency recover stuck tokens (not $NEXUS reward pools)
    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(nexusToken) || amount <= nexusToken.balanceOf(address(this)) - nftRewardPool - coreRewardPool, "Cannot take reward pools");
        IERC20(token).transfer(owner(), amount);
    }

    function pause() external onlyOwner {
        // Future: implement Pausable if needed
    }
}
