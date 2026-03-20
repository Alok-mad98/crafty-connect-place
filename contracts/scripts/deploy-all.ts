import hre from "hardhat";

/**
 * Full Nexus Protocol deployment to Base mainnet
 *
 * Deployment order:
 * 1. NexusToken       — ERC-20, 100M supply
 * 2. NexusTreasury    — fee collection, buyback & burn
 * 3. DataMining       — BEAN-style 5x5 mining game
 * 4. AgentSkillsMarket — AI skills marketplace
 *
 * Post-deploy config:
 * - Set DataMining as authorized source on Treasury
 * - Set NFT rarities on DataMining (from metadata)
 * - Fund rewards pool on DataMining
 */

// Already deployed
const NEXUS_AGENT_NFT = "0x050bf16a260b3376BFf70aa9E87c95bd965Dc3b4";
// Base mainnet USDC
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("No ETH balance — need gas for deployment");
  }

  console.log("\n========================================");
  console.log("  NEXUS PROTOCOL — BASE MAINNET DEPLOY");
  console.log("========================================\n");

  // ─── 1. NexusToken ───────────────────────────────────
  console.log("1/4 Deploying NexusToken...");
  const NexusToken = await hre.ethers.getContractFactory("NexusToken");
  const nexusToken = await NexusToken.deploy();
  await nexusToken.waitForDeployment();
  const nexusTokenAddr = await nexusToken.getAddress();
  console.log("   NexusToken:", nexusTokenAddr);
  console.log("   100M $NEXUS minted to deployer\n");

  // ─── 2. NexusTreasury ────────────────────────────────
  console.log("2/4 Deploying NexusTreasury...");
  const NexusTreasury = await hre.ethers.getContractFactory("NexusTreasury");
  const nexusTreasury = await NexusTreasury.deploy(nexusTokenAddr);
  await nexusTreasury.waitForDeployment();
  const treasuryAddr = await nexusTreasury.getAddress();
  console.log("   NexusTreasury:", treasuryAddr);
  console.log("   Burn: 70% | NFT Stakers: 20% | Core Stakers: 10%\n");

  // ─── 3. DataMining ───────────────────────────────────
  console.log("3/4 Deploying DataMining...");
  const DataMining = await hre.ethers.getContractFactory("DataMining");
  const dataMining = await DataMining.deploy(nexusTokenAddr, NEXUS_AGENT_NFT, treasuryAddr);
  await dataMining.waitForDeployment();
  const dataMiningAddr = await dataMining.getAddress();
  console.log("   DataMining:", dataMiningAddr);
  console.log("   5x5 grid, 60s rounds, ETH + NEXUS\n");

  // ─── 4. AgentSkillsMarket ────────────────────────────
  console.log("4/4 Deploying AgentSkillsMarket...");
  const AgentSkillsMarket = await hre.ethers.getContractFactory("AgentSkillsMarket");
  const skillsMarket = await AgentSkillsMarket.deploy(USDC_BASE, treasuryAddr);
  await skillsMarket.waitForDeployment();
  const skillsMarketAddr = await skillsMarket.getAddress();
  console.log("   AgentSkillsMarket:", skillsMarketAddr);
  console.log("   USDC payments, 95% creator / 5% treasury\n");

  // ─── Post-Deploy Configuration ────────────────────────
  console.log("========================================");
  console.log("  POST-DEPLOY CONFIGURATION");
  console.log("========================================\n");

  // Set DataMining as authorized source on Treasury
  console.log("Setting DataMining as authorized source on Treasury...");
  const tx1 = await nexusTreasury.setAuthorizedSource(dataMiningAddr, true);
  await tx1.wait();
  console.log("   Done\n");

  // ─── Summary ──────────────────────────────────────────
  console.log("========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("");
  console.log("Contract Addresses:");
  console.log("  NexusAgentNFT:      ", NEXUS_AGENT_NFT, "(already deployed)");
  console.log("  NexusToken:         ", nexusTokenAddr);
  console.log("  NexusTreasury:      ", treasuryAddr);
  console.log("  DataMining:         ", dataMiningAddr);
  console.log("  AgentSkillsMarket:  ", skillsMarketAddr);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Set NFT rarities: dataMining.setNFTRarities(tokenIds, rarities)");
  console.log("  2. Fund rewards pool: nexusToken.approve(dataMining, amount) → dataMining.fundRewardsPool(amount)");
  console.log("  3. Start game: dataMining.startGame()");
  console.log("  4. Update frontend contracts.ts with new addresses");
  console.log("");
  console.log("Save these addresses! Add to .env:");
  console.log(`  NEXUS_TOKEN=${nexusTokenAddr}`);
  console.log(`  NEXUS_TREASURY=${treasuryAddr}`);
  console.log(`  DATA_MINING=${dataMiningAddr}`);
  console.log(`  SKILLS_MARKET=${skillsMarketAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
