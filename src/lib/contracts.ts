// ─── Deployed Contract Addresses (Base Mainnet) ─────────────────────
export const NEXUS_AGENT_NFT_ADDRESS = "0x050bf16a260b3376BFf70aa9E87c95bd965Dc3b4";
export const NEXUS_TOKEN_ADDRESS = "0x75737B12CD44D520f517692F125e8D154CCC732B";
export const NEXUS_TREASURY_ADDRESS = "0x440082F9435bb491CE018feAe742d668469a6fA9";
export const DATA_MINING_ADDRESS = "0xe0fB97698dD52ED24eEAA3445f9239229822e02e";
export const SKILLS_MARKET_ADDRESS = "0xDB6117C690F814dFA08047bedD9e50EEa880bdF2";
export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const CHAIN_ID = 8453;

// Legacy alias for Vault/Forge pages
export const CONTRACT_ADDRESS = SKILLS_MARKET_ADDRESS;

// ─── ABIs ───────────────────────────────────────────────────────────
export const AGENT_SKILLS_MARKET_ABI = [
  "function launchSkill(string calldata ipfsCid, uint256 price) external returns (uint256)",
  "function buySkill(uint256 skillId) external",
  "function getSkill(uint256 skillId) external view returns (tuple(address creator, string ipfsCid, uint256 price, bool active))",
  "function hasPurchased(address buyer, uint256 skillId) external view returns (bool)",
  "function skillCount() external view returns (uint256)",
  "function LISTING_FEE() external view returns (uint256)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
] as const;

export const NEXUS_TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function burn(uint256 amount) external",
] as const;

export const DATA_MINING_ABI = [
  "function deployETH(uint8[] blocks) external payable",
  "function deployNexus(uint8[] blocks, uint256 perBlock) external",
  "function settleRound() external",
  "function claimRound(uint256 roundId) external",
  "function claimCooled() external",
  "function startGame() external",
  "function stakeNFT(uint256 tokenId) external",
  "function unstakeNFT() external",
  "function fundRewardsPool(uint256 amount) external",
  "function getGameState() external view returns (uint256 roundId, uint256 startTime, uint256 timeRemaining, bool active, uint256 vault, uint256 rewards)",
  "function getRoundInfo(uint256 roundId) external view returns (uint256 totalETH, uint256 totalNexus, uint8 winningBlock, bool settled, bool vaultTriggered)",
  "function getBlockDeployments(uint256 roundId) external view returns (uint256[25] ethBlocks, uint256[25] nexusBlocks)",
  "function getPlayerDeploy(uint256 roundId, address player) external view returns (uint8[] ethBlocks, uint256 ethPerBlock, uint8[] nexusBlocks, uint256 nexusPerBlock, bool claimed)",
  "function getMultiplier(address player) external view returns (uint256)",
  "function getPlayerRarity(address player) external view returns (uint8)",
  "function uncooledBalance(address) external view returns (uint256)",
  "function cooledBalance(address) external view returns (uint256)",
  "function nexusVault() external view returns (uint256)",
  "function currentRoundId() external view returns (uint256)",
  "function hasStakedNFT(address) external view returns (bool)",
  "function stakedTokenId(address) external view returns (uint256)",
  "function totalRoundsPlayed() external view returns (uint256)",
  "function totalETHFees() external view returns (uint256)",
  "function totalNexusBurned() external view returns (uint256)",
  "function rewardsPool() external view returns (uint256)",
] as const;

export const NEXUS_NFT_ABI = [
  "function mintTo(address to) external",
  "function toggleMint(bool _active) external",
  "function totalMinted() external view returns (uint256)",
  "function mintActive() external view returns (bool)",
  "function hasMinted(address) external view returns (bool)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
] as const;

export const NEXUS_TREASURY_ABI = [
  "function totalBurned() external view returns (uint256)",
  "function totalDistributed() external view returns (uint256)",
  "function nftRewardPool() external view returns (uint256)",
  "function coreRewardPool() external view returns (uint256)",
  "function burnRatio() external view returns (uint256)",
  "function nftHolderRatio() external view returns (uint256)",
  "function coreStakerRatio() external view returns (uint256)",
] as const;

export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const IPFS_GATEWAY = "ipfs.filebase.io";
