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
] as const;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xA17a9F8d348FCa79A284C244b6c405BDDd4C4687";
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "8453");

// API base URL — empty string means same origin (works in both Next.js and standalone)
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
export const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "blue-obvious-jackal-985.mypinata.cloud";