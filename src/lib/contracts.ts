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

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
