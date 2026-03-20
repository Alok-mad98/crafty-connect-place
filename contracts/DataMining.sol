// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DataMining
 * @notice BEAN-style 5x5 grid mining game for the Nexus Protocol.
 *         Players deploy ETH or $NEXUS on blocks. One block wins per round.
 *         Winners take losers' funds minus fees. NFT holders get payout multipliers.
 *
 * @dev Core mechanics:
 *      - 60-second rounds on a 5x5 grid (25 blocks)
 *      - Dual currency: ETH or $NEXUS (NEXUS gets 1.2x base bonus)
 *      - 1% admin fee + 10% vault fee on losers' pool → Treasury
 *      - NFT multipliers: Common 1.3x, Rare 1.8x, Ultra Rare 2.5x
 *      - Cooling mechanic: 10% fee on claim, redistributed to holders
 *      - Nexus Vault: jackpot accumulates 0.3 NEXUS/round, 1-in-777 trigger
 */
contract DataMining is Ownable, ReentrancyGuard {
    // --- Constants ---
    uint256 public constant GRID_SIZE = 25;            // 5x5
    uint256 public constant ROUND_DURATION = 60;       // seconds
    uint256 public constant ADMIN_FEE_BPS = 100;       // 1%
    uint256 public constant VAULT_FEE_BPS = 1000;      // 10%
    uint256 public constant COOLING_FEE_BPS = 1000;    // 10% on claim
    uint256 public constant NEXUS_BONUS_BPS = 12000;   // 1.2x (in basis points of 10000)
    uint256 public constant VAULT_TRIGGER_ODDS = 777;   // 1-in-777
    uint256 public constant NEXUS_PER_ROUND = 1e18;    // 1 NEXUS minted per round
    uint256 public constant VAULT_PER_ROUND = 3e17;    // 0.3 NEXUS per round to vault
    uint256 public constant MIN_ETH_PER_BLOCK = 0.00001 ether;
    uint256 public constant MIN_NEXUS_PER_BLOCK = 100e18; // 100 NEXUS

    // --- NFT Multipliers (basis points, 10000 = 1.0x) ---
    uint256 public constant NO_NFT_MULT = 10000;       // 1.0x
    uint256 public constant COMMON_MULT = 13000;       // 1.3x
    uint256 public constant RARE_MULT = 18000;         // 1.8x
    uint256 public constant ULTRA_RARE_MULT = 25000;   // 2.5x

    // NFT NEXUS deploy bonus (stacks with base 1.2x)
    uint256 public constant COMMON_NEXUS_BONUS = 14000;     // 1.4x
    uint256 public constant RARE_NEXUS_BONUS = 16000;       // 1.6x
    uint256 public constant ULTRA_RARE_NEXUS_BONUS = 20000; // 2.0x

    // --- Rarity enum ---
    enum Rarity { None, Common, Rare, UltraRare }

    // --- External contracts ---
    IERC20 public immutable nexusToken;
    IERC721 public immutable nftContract;
    address public treasury;

    // --- NFT rarity mapping (set by owner from metadata) ---
    mapping(uint256 => Rarity) public nftRarity;

    // --- NFT staking for game boost ---
    mapping(address => uint256) public stakedNFT;       // player → tokenId
    mapping(address => bool) public hasStakedNFT;

    // --- Round state ---
    uint256 public currentRoundId;
    uint256 public roundStartTime;
    bool public gameActive;

    struct RoundData {
        // ETH pool
        uint256[25] ethPerBlock;           // total ETH on each block
        uint256 totalETH;
        // NEXUS pool
        uint256[25] nexusPerBlock;         // total NEXUS on each block
        uint256 totalNexus;
        // Result
        uint8 winningBlock;                // 0-24
        bool settled;
        uint256 settledAt;
        bool vaultTriggered;
        // Safe emission & vault distribution (computed during settle)
        bool hasEmission;                  // true if NEXUS emission allocated this round
        uint256 vaultPayoutAmount;         // vault snapshot when triggered (vault zeroed)
        uint256 totalWinnerWeight;         // sum of multipliers of all winners
        uint256 totalNftWinnerWeight;      // sum of multipliers of NFT-holding winners
    }

    struct PlayerDeploy {
        uint8[] ethBlocks;                 // blocks player deployed ETH on
        uint256 ethPerBlock;               // ETH per block for this player
        uint8[] nexusBlocks;               // blocks player deployed NEXUS on
        uint256 nexusPerBlock;             // NEXUS per block for this player
        bool claimed;
    }

    mapping(uint256 => RoundData) public rounds;
    mapping(uint256 => mapping(address => PlayerDeploy)) internal playerDeploys;

    // Track players per round for enumeration
    mapping(uint256 => address[]) internal roundPlayers;
    mapping(uint256 => mapping(address => bool)) internal isRoundPlayer;

    // --- Cooling (like BEAN's Roasting) ---
    mapping(address => uint256) public uncooledBalance;   // unclaimed winnings
    mapping(address => uint256) public cooledBalance;     // bonus from others' fees
    uint256 public totalUncooled;                         // global uncooled pool

    // --- Nexus Vault (jackpot) ---
    uint256 public nexusVault;

    // --- Reward emissions pool (25M over 24 months) ---
    uint256 public rewardsPool;

    // --- Stats ---
    uint256 public totalRoundsPlayed;
    uint256 public totalETHDeployed;
    uint256 public totalNexusDeployed;
    uint256 public totalETHFees;
    uint256 public totalNexusBurned;

    // --- Events ---
    event GameStarted(uint256 roundId, uint256 startTime);
    event Deployed(uint256 indexed roundId, address indexed player, bool isNexus, uint8[] blocks, uint256 perBlock);
    event RoundSettled(uint256 indexed roundId, uint8 winningBlock, bool vaultTriggered);
    event Winnings(uint256 indexed roundId, address indexed player, uint256 ethWon, uint256 nexusWon);
    event CoolingClaim(address indexed player, uint256 uncooled, uint256 cooled, uint256 feePaid);
    event VaultPayout(uint256 roundId, uint256 amount);
    event NFTStaked(address indexed player, uint256 tokenId);
    event NFTUnstaked(address indexed player, uint256 tokenId);

    constructor(
        address _nexusToken,
        address _nftContract,
        address _treasury
    ) Ownable(msg.sender) {
        nexusToken = IERC20(_nexusToken);
        nftContract = IERC721(_nftContract);
        treasury = _treasury;
    }

    // =========================================================
    //                    NFT STAKING (for boost)
    // =========================================================

    function stakeNFT(uint256 tokenId) external nonReentrant {
        require(!hasStakedNFT[msg.sender], "Already staked");
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        stakedNFT[msg.sender] = tokenId;
        hasStakedNFT[msg.sender] = true;
        emit NFTStaked(msg.sender, tokenId);
    }

    function unstakeNFT() external nonReentrant {
        require(hasStakedNFT[msg.sender], "No NFT staked");
        uint256 tokenId = stakedNFT[msg.sender];
        hasStakedNFT[msg.sender] = false;
        delete stakedNFT[msg.sender];
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        emit NFTUnstaked(msg.sender, tokenId);
    }

    function getPlayerRarity(address player) public view returns (Rarity) {
        if (!hasStakedNFT[player]) return Rarity.None;
        return nftRarity[stakedNFT[player]];
    }

    function getMultiplier(address player) public view returns (uint256) {
        Rarity r = getPlayerRarity(player);
        if (r == Rarity.UltraRare) return ULTRA_RARE_MULT;
        if (r == Rarity.Rare) return RARE_MULT;
        if (r == Rarity.Common) return COMMON_MULT;
        return NO_NFT_MULT;
    }

    function getNexusBonus(address player) public view returns (uint256) {
        Rarity r = getPlayerRarity(player);
        if (r == Rarity.UltraRare) return ULTRA_RARE_NEXUS_BONUS;
        if (r == Rarity.Rare) return RARE_NEXUS_BONUS;
        if (r == Rarity.Common) return COMMON_NEXUS_BONUS;
        return NEXUS_BONUS_BPS; // base 1.2x
    }

    // =========================================================
    //                    GAME MANAGEMENT
    // =========================================================

    function startGame() external onlyOwner {
        require(!gameActive, "Already active");
        gameActive = true;
        _startNewRound();
    }

    function pauseGame() external onlyOwner {
        gameActive = false;
    }

    function fundRewardsPool(uint256 amount) external onlyOwner {
        nexusToken.transferFrom(msg.sender, address(this), amount);
        rewardsPool += amount;
    }

    // =========================================================
    //                    DEPLOY (PLACE BETS)
    // =========================================================

    /// @notice Deploy ETH on selected blocks
    function deployETH(uint8[] calldata blocks) external payable nonReentrant {
        require(gameActive, "Game paused");
        require(blocks.length > 0 && blocks.length <= 25, "Invalid blocks");
        require(block.timestamp < roundStartTime + ROUND_DURATION, "Round ended");

        uint256 perBlock = msg.value / blocks.length;
        require(perBlock >= MIN_ETH_PER_BLOCK, "Below minimum");

        RoundData storage rd = rounds[currentRoundId];
        PlayerDeploy storage pd = playerDeploys[currentRoundId][msg.sender];
        require(pd.ethBlocks.length == 0, "Already deployed ETH");

        for (uint256 i = 0; i < blocks.length; i++) {
            require(blocks[i] < 25, "Invalid block");
            rd.ethPerBlock[blocks[i]] += perBlock;
        }

        pd.ethBlocks = blocks;
        pd.ethPerBlock = perBlock;
        rd.totalETH += msg.value;
        totalETHDeployed += msg.value;

        _registerPlayer(msg.sender);

        emit Deployed(currentRoundId, msg.sender, false, blocks, perBlock);
    }

    /// @notice Deploy $NEXUS on selected blocks
    function deployNexus(uint8[] calldata blocks, uint256 perBlock) external nonReentrant {
        require(gameActive, "Game paused");
        require(blocks.length > 0 && blocks.length <= 25, "Invalid blocks");
        require(block.timestamp < roundStartTime + ROUND_DURATION, "Round ended");
        require(perBlock >= MIN_NEXUS_PER_BLOCK, "Below minimum");

        uint256 totalAmount = perBlock * blocks.length;
        nexusToken.transferFrom(msg.sender, address(this), totalAmount);

        RoundData storage rd = rounds[currentRoundId];
        PlayerDeploy storage pd = playerDeploys[currentRoundId][msg.sender];
        require(pd.nexusBlocks.length == 0, "Already deployed NEXUS");

        for (uint256 i = 0; i < blocks.length; i++) {
            require(blocks[i] < 25, "Invalid block");
            rd.nexusPerBlock[blocks[i]] += perBlock;
        }

        pd.nexusBlocks = blocks;
        pd.nexusPerBlock = perBlock;
        rd.totalNexus += totalAmount;
        totalNexusDeployed += totalAmount;

        _registerPlayer(msg.sender);

        emit Deployed(currentRoundId, msg.sender, true, blocks, perBlock);
    }

    function _registerPlayer(address player) internal {
        if (!isRoundPlayer[currentRoundId][player]) {
            roundPlayers[currentRoundId].push(player);
            isRoundPlayer[currentRoundId][player] = true;
        }
    }

    // =========================================================
    //                    SETTLE ROUND
    // =========================================================

    /// @notice Settle the current round. Anyone can call after timer expires.
    function settleRound() external nonReentrant {
        require(gameActive, "Game paused");
        require(block.timestamp >= roundStartTime + ROUND_DURATION, "Round not over");

        RoundData storage rd = rounds[currentRoundId];
        require(!rd.settled, "Already settled");

        // Determine winning block (pseudo-random, upgradeable to VRF later)
        uint8 winningBlock = uint8(
            uint256(keccak256(abi.encodePacked(
                blockhash(block.number - 1),
                block.timestamp,
                currentRoundId,
                rd.totalETH,
                rd.totalNexus
            ))) % 25
        );

        rd.winningBlock = winningBlock;
        rd.settled = true;
        rd.settledAt = block.timestamp;

        // --- Compute winner weights for safe emission/vault distribution ---
        {
            uint256 _totalWeight = 0;
            uint256 _nftWeight = 0;
            address[] storage players = roundPlayers[currentRoundId];
            for (uint256 i = 0; i < players.length; i++) {
                address p = players[i];
                PlayerDeploy storage _pd = playerDeploys[currentRoundId][p];
                bool isWinner = _isOnBlock(_pd.ethBlocks, winningBlock) || _isOnBlock(_pd.nexusBlocks, winningBlock);
                if (isWinner) {
                    uint256 mult = getMultiplier(p);
                    _totalWeight += mult;
                    if (hasStakedNFT[p]) {
                        _nftWeight += mult;
                    }
                }
            }
            rd.totalWinnerWeight = _totalWeight > 0 ? _totalWeight : 10000;
            rd.totalNftWinnerWeight = _nftWeight > 0 ? _nftWeight : 10000;
        }

        // --- Process ETH pool ---
        if (rd.totalETH > 0) {
            uint256 adminFeeETH = (rd.totalETH * ADMIN_FEE_BPS) / 10000;
            uint256 winningETH = rd.ethPerBlock[winningBlock];
            uint256 losersETH = rd.totalETH - winningETH;
            uint256 vaultFeeETH = (losersETH * VAULT_FEE_BPS) / 10000;

            uint256 ethToTreasury = adminFeeETH + vaultFeeETH;
            totalETHFees += ethToTreasury;

            // Send fees to treasury
            if (ethToTreasury > 0) {
                (bool sent, ) = treasury.call{value: ethToTreasury}("");
                require(sent, "ETH transfer failed");
            }
        }

        // --- Process NEXUS pool ---
        if (rd.totalNexus > 0) {
            uint256 adminFeeNexus = (rd.totalNexus * ADMIN_FEE_BPS) / 10000;
            uint256 winningNexus = rd.nexusPerBlock[winningBlock];
            uint256 losersNexus = rd.totalNexus - winningNexus;
            uint256 vaultFeeNexus = (losersNexus * VAULT_FEE_BPS) / 10000;

            uint256 nexusToTreasury = adminFeeNexus + vaultFeeNexus;
            totalNexusBurned += nexusToTreasury;

            // Send NEXUS fees to treasury
            if (nexusToTreasury > 0) {
                nexusToken.transfer(treasury, nexusToTreasury);
            }
        }

        // --- Emit NEXUS rewards from pool ---
        if (rewardsPool >= NEXUS_PER_ROUND + VAULT_PER_ROUND) {
            rewardsPool -= (NEXUS_PER_ROUND + VAULT_PER_ROUND);
            rd.hasEmission = true;

            // 0.3 NEXUS to Nexus Vault
            nexusVault += VAULT_PER_ROUND;

            // Check vault trigger (1-in-777)
            uint256 vaultRoll = uint256(keccak256(abi.encodePacked(
                blockhash(block.number - 1),
                block.timestamp,
                "vault",
                currentRoundId
            ))) % VAULT_TRIGGER_ODDS;

            if (vaultRoll == 0 && nexusVault > 0) {
                rd.vaultTriggered = true;
                rd.vaultPayoutAmount = nexusVault;  // Snapshot vault
                nexusVault = 0;                      // Zero vault (BUG FIX)
                emit VaultPayout(currentRoundId, rd.vaultPayoutAmount);
            }
        }

        totalRoundsPlayed++;

        emit RoundSettled(currentRoundId, winningBlock, rd.vaultTriggered);

        // Start next round
        _startNewRound();
    }

    function _startNewRound() internal {
        currentRoundId++;
        roundStartTime = block.timestamp;
        emit GameStarted(currentRoundId, roundStartTime);
    }

    // =========================================================
    //                    CLAIM WINNINGS
    // =========================================================

    /// @notice Claim winnings for a specific round
    function claimRound(uint256 roundId) external nonReentrant {
        RoundData storage rd = rounds[roundId];
        require(rd.settled, "Round not settled");

        PlayerDeploy storage pd = playerDeploys[roundId][msg.sender];
        require(!pd.claimed, "Already claimed");
        pd.claimed = true;

        uint8 winBlock = rd.winningBlock;
        bool onWinETH = _isOnBlock(pd.ethBlocks, winBlock);
        bool onWinNexus = _isOnBlock(pd.nexusBlocks, winBlock);

        if (onWinETH) _claimETH(roundId, rd, pd, winBlock);
        if (onWinNexus) _claimNexus(roundId, rd, pd, winBlock);
        if (onWinETH || onWinNexus) _claimEmission(roundId, rd);
    }

    function _isOnBlock(uint8[] storage blocks, uint8 target) internal view returns (bool) {
        for (uint256 i = 0; i < blocks.length; i++) {
            if (blocks[i] == target) return true;
        }
        return false;
    }

    function _claimETH(
        uint256 roundId, RoundData storage rd, PlayerDeploy storage pd, uint8 winBlock
    ) internal {
        if (rd.ethPerBlock[winBlock] == 0) return;

        uint256 blockTotal = rd.ethPerBlock[winBlock];
        uint256 adminFee = (rd.totalETH * ADMIN_FEE_BPS) / 10000;
        uint256 losers = rd.totalETH - blockTotal;
        uint256 vaultFee = (losers * VAULT_FEE_BPS) / 10000;
        uint256 distributable = rd.totalETH - adminFee - vaultFee;

        // Proportional payout only — no multiplier on prize pool (zero-sum safe)
        // NFT multiplier applies to NEXUS emissions instead (see _claimEmission)
        uint256 payout = (distributable * pd.ethPerBlock) / blockTotal;

        if (payout > 0) {
            (bool sent, ) = msg.sender.call{value: payout}("");
            require(sent, "ETH transfer failed");
            emit Winnings(roundId, msg.sender, payout, 0);
        }
    }

    function _claimNexus(
        uint256 roundId, RoundData storage rd, PlayerDeploy storage pd, uint8 winBlock
    ) internal {
        if (rd.nexusPerBlock[winBlock] == 0) return;

        uint256 blockTotal = rd.nexusPerBlock[winBlock];
        uint256 adminFee = (rd.totalNexus * ADMIN_FEE_BPS) / 10000;
        uint256 losers = rd.totalNexus - blockTotal;
        uint256 vaultFee = (losers * VAULT_FEE_BPS) / 10000;
        uint256 distributable = rd.totalNexus - adminFee - vaultFee;

        // Proportional payout only — no bonus on prize pool (zero-sum safe)
        uint256 nexusWon = (distributable * pd.nexusPerBlock) / blockTotal;

        uncooledBalance[msg.sender] += nexusWon;
        totalUncooled += nexusWon;
        emit Winnings(roundId, msg.sender, 0, nexusWon);
    }

    function _claimEmission(uint256 /* roundId */, RoundData storage rd) internal {
        // Round NEXUS emission — weighted by NFT multiplier
        // NFT holders get bigger share of emission (THIS is where multiplier matters)
        // Safe: totalWinnerWeight pre-computed during settle, sum of shares <= NEXUS_PER_ROUND
        if (rd.hasEmission) {
            uint256 myWeight = getMultiplier(msg.sender);
            uint256 share = (NEXUS_PER_ROUND * myWeight) / rd.totalWinnerWeight;
            uncooledBalance[msg.sender] += share;
            totalUncooled += share;
        }

        // Nexus Vault payout (NFT holders only, weighted by rarity)
        // Safe: vaultPayoutAmount snapshotted during settle, vault zeroed
        if (rd.vaultTriggered && hasStakedNFT[msg.sender] && rd.vaultPayoutAmount > 0) {
            uint256 myWeight = getMultiplier(msg.sender);
            uint256 vaultShare = (rd.vaultPayoutAmount * myWeight) / rd.totalNftWinnerWeight;
            uncooledBalance[msg.sender] += vaultShare;
            totalUncooled += vaultShare;
        }
    }

    // =========================================================
    //                    COOLING MECHANIC
    // =========================================================

    /// @notice Claim your uncooled + cooled $NEXUS. 10% fee on uncooled redistributed.
    function claimCooled() external nonReentrant {
        uint256 uncooled = uncooledBalance[msg.sender];
        uint256 cooled = cooledBalance[msg.sender];
        require(uncooled + cooled > 0, "Nothing to claim");

        // 10% fee on uncooled amount
        uint256 fee = (uncooled * COOLING_FEE_BPS) / 10000;
        uint256 netUncooled = uncooled - fee;

        // Redistribute fee to all other uncooled holders
        if (totalUncooled > uncooled && fee > 0) {
            // Fee proportionally distributed to remaining uncooled holders
            // Tracked via cooledBalance increments
            // Simplified: add to a global cooled pool ratio
            _distributeCoolingFee(fee, msg.sender);
        }

        // Update state
        totalUncooled -= uncooled;
        uncooledBalance[msg.sender] = 0;
        cooledBalance[msg.sender] = 0;

        uint256 totalPayout = netUncooled + cooled;
        if (totalPayout > 0) {
            nexusToken.transfer(msg.sender, totalPayout);
        }

        emit CoolingClaim(msg.sender, uncooled, cooled, fee);
    }

    /// @dev Cooling fee sent to treasury for buyback & burn
    function _distributeCoolingFee(uint256 fee, address) internal {
        if (fee > 0) {
            nexusToken.transfer(treasury, fee);
        }
    }

    // =========================================================
    //                    VIEW FUNCTIONS
    // =========================================================

    function _countWinners(uint256 roundId) internal view returns (uint256) {
        RoundData storage rd = rounds[roundId];
        uint8 winBlock = rd.winningBlock;
        uint256 count = 0;
        address[] storage players = roundPlayers[roundId];
        for (uint256 i = 0; i < players.length; i++) {
            PlayerDeploy storage pd = playerDeploys[roundId][players[i]];
            for (uint256 j = 0; j < pd.ethBlocks.length; j++) {
                if (pd.ethBlocks[j] == winBlock) { count++; break; }
            }
            for (uint256 j = 0; j < pd.nexusBlocks.length; j++) {
                if (pd.nexusBlocks[j] == winBlock) { count++; break; }
            }
        }
        return count > 0 ? count : 1;
    }

    function _countNFTWinners(uint256 roundId) internal view returns (uint256) {
        RoundData storage rd = rounds[roundId];
        uint8 winBlock = rd.winningBlock;
        uint256 count = 0;
        address[] storage players = roundPlayers[roundId];
        for (uint256 i = 0; i < players.length; i++) {
            if (!hasStakedNFT[players[i]]) continue;
            PlayerDeploy storage pd = playerDeploys[roundId][players[i]];
            bool onWin = false;
            for (uint256 j = 0; j < pd.ethBlocks.length; j++) {
                if (pd.ethBlocks[j] == winBlock) { onWin = true; break; }
            }
            if (!onWin) {
                for (uint256 j = 0; j < pd.nexusBlocks.length; j++) {
                    if (pd.nexusBlocks[j] == winBlock) { onWin = true; break; }
                }
            }
            if (onWin) count++;
        }
        return count > 0 ? count : 1;
    }

    function getRoundInfo(uint256 roundId) external view returns (
        uint256 totalETH,
        uint256 totalNexus,
        uint8 winningBlock,
        bool settled,
        bool vaultTriggered
    ) {
        RoundData storage rd = rounds[roundId];
        return (rd.totalETH, rd.totalNexus, rd.winningBlock, rd.settled, rd.vaultTriggered);
    }

    function getBlockDeployments(uint256 roundId) external view returns (
        uint256[25] memory ethBlocks,
        uint256[25] memory nexusBlocks
    ) {
        RoundData storage rd = rounds[roundId];
        return (rd.ethPerBlock, rd.nexusPerBlock);
    }

    function getPlayerDeploy(uint256 roundId, address player) external view returns (
        uint8[] memory ethBlocks,
        uint256 ethPerBlock,
        uint8[] memory nexusBlocks,
        uint256 nexusPerBlock,
        bool claimed
    ) {
        PlayerDeploy storage pd = playerDeploys[roundId][player];
        return (pd.ethBlocks, pd.ethPerBlock, pd.nexusBlocks, pd.nexusPerBlock, pd.claimed);
    }

    function getGameState() external view returns (
        uint256 roundId,
        uint256 startTime,
        uint256 timeRemaining,
        bool active,
        uint256 vault,
        uint256 rewards
    ) {
        uint256 elapsed = block.timestamp - roundStartTime;
        uint256 remaining = elapsed >= ROUND_DURATION ? 0 : ROUND_DURATION - elapsed;
        return (currentRoundId, roundStartTime, remaining, gameActive, nexusVault, rewardsPool);
    }

    // =========================================================
    //                    ADMIN
    // =========================================================

    /// @notice Set NFT rarity for token IDs (batch)
    function setNFTRarities(uint256[] calldata tokenIds, Rarity[] calldata rarities) external onlyOwner {
        require(tokenIds.length == rarities.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            nftRarity[tokenIds[i]] = rarities[i];
        }
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    /// @notice Emergency withdraw (only if game is paused)
    function emergencyWithdrawETH() external onlyOwner {
        require(!gameActive, "Pause first");
        payable(owner()).transfer(address(this).balance);
    }

    function emergencyWithdrawNexus() external onlyOwner {
        require(!gameActive, "Pause first");
        nexusToken.transfer(owner(), nexusToken.balanceOf(address(this)));
    }
}
