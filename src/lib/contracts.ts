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

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xA17a9F8d348FCa79A284C244b6c405BDDd4C4687";
export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || "8453");

export const API_BASE = import.meta.env.VITE_API_BASE || "";
<<<<<<< HEAD
<<<<<<< HEAD
export const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "ipfs.filebase.io";
=======
export const IPFS_GATEWAY = "ipfs.filebase.io";
>>>>>>> 9d86b3f035a6f85aa3a958056cd47d0fbcc397ec
=======
export const IPFS_GATEWAY = "ipfs.filebase.io";
>>>>>>> 9d86b3f035a6f85aa3a958056cd47d0fbcc397ec
