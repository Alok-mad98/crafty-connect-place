import hre from "hardhat";

async function main() {
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const treasury = process.env.TREASURY_ADDRESS!;
  const Market = await hre.ethers.getContractFactory("AgentSkillsMarket");
  const market = await Market.deploy(USDC, treasury);
  await market.waitForDeployment();
  console.log("AgentSkillsMarket deployed to:", await market.getAddress());
}
main().catch(console.error);
