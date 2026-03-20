import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const DATA_MINING = "0xe0fB97698dD52ED24eEAA3445f9239229822e02e";
const NEXUS_TOKEN = "0x75737B12CD44D520f517692F125e8D154CCC732B";
const METADATA_DIR = "C:/Users/alokp/Downloads/nft_collection_merged/metadata";

const DATA_MINING_ABI = [
  "function setNFTRarity(uint256 tokenId, uint8 rarity) external",
  "function setNFTRarities(uint256[] tokenIds, uint8[] rarities) external",
  "function fundRewardsPool(uint256 amount) external",
  "function startGame() external",
  "function nftRarity(uint256) view returns (uint8)",
  "function rewardsPool() view returns (uint256)",
  "function gameActive() view returns (bool)",
];

const ERC20_ABI = [
  "function approve(address, uint256) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
];

// Rarity enum: 0=None, 1=Common, 2=Rare, 3=UltraRare
const RARITY_MAP = { Common: 1, Rare: 2, "Ultra-Rare": 3 };

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("Set DEPLOYER_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(pk, provider);
  console.log("Deployer:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH\n");

  const mining = new ethers.Contract(DATA_MINING, DATA_MINING_ABI, wallet);
  const nexus = new ethers.Contract(NEXUS_TOKEN, ERC20_ABI, wallet);

  // ─── Step 1: Set NFT Rarities ────────────────────────────
  console.log("=== STEP 1: Set NFT Rarities ===");

  // Scan metadata
  const rareIds = [], ultraIds = [];
  for (let i = 0; i < 779; i++) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, `${i}.json`), "utf8"));
      const tier = d.attributes?.find((a) => a.trait_type === "Tier")?.value;
      if (tier === "Rare") rareIds.push(i);
      else if (tier === "Ultra-Rare") ultraIds.push(i);
    } catch {}
  }
  console.log(`Found: ${779 - rareIds.length - ultraIds.length} Common, ${rareIds.length} Rare, ${ultraIds.length} Ultra-Rare`);

  // Check if already set (sample first rare)
  const sampleRarity = await mining.nftRarity(rareIds[0]);
  if (Number(sampleRarity) === 2) {
    console.log("Rarities already set, skipping.\n");
  } else {
    // Set Rare tokens in batches of 50
    console.log("Setting Rare tokens...");
    for (let i = 0; i < rareIds.length; i += 50) {
      const batch = rareIds.slice(i, i + 50);
      const rarities = batch.map(() => 2);
      const tx = await mining.setNFTRarities(batch, rarities);
      await tx.wait();
      console.log(`  Rare batch ${Math.floor(i / 50) + 1}/${Math.ceil(rareIds.length / 50)} done`);
    }

    // Set Ultra-Rare tokens
    console.log("Setting Ultra-Rare tokens...");
    const ultraRarities = ultraIds.map(() => 3);
    const tx2 = await mining.setNFTRarities(ultraIds, ultraRarities);
    await tx2.wait();
    console.log(`  Ultra-Rare batch done (${ultraIds.length} tokens)\n`);
  }

  // ─── Step 2: Fund Rewards Pool ────────────────────────────
  console.log("=== STEP 2: Fund Rewards Pool ===");
  const currentPool = await mining.rewardsPool();
  console.log("Current rewards pool:", ethers.formatEther(currentPool), "NEXUS");

  if (currentPool === 0n) {
    // Fund with 10M NEXUS (10% of supply) for initial game rewards
    const fundAmount = ethers.parseEther("10000000"); // 10M
    const balance = await nexus.balanceOf(wallet.address);
    console.log("Your NEXUS balance:", ethers.formatEther(balance));

    if (balance < fundAmount) {
      console.log("Not enough NEXUS, funding with available balance");
    }

    const amount = balance < fundAmount ? balance : fundAmount;
    console.log("Funding with:", ethers.formatEther(amount), "NEXUS");

    // Approve
    const allowance = await nexus.allowance(wallet.address, DATA_MINING);
    if (allowance < amount) {
      console.log("Approving DataMining to spend NEXUS...");
      const appTx = await nexus.approve(DATA_MINING, amount);
      await appTx.wait();
    }

    // Fund
    console.log("Funding rewards pool...");
    const fundTx = await mining.fundRewardsPool(amount);
    await fundTx.wait();
    console.log("Rewards pool funded!\n");
  } else {
    console.log("Rewards pool already funded, skipping.\n");
  }

  // ─── Step 3: Start Game ────────────────────────────────────
  console.log("=== STEP 3: Start Game ===");
  const active = await mining.gameActive();
  if (active) {
    console.log("Game already active!\n");
  } else {
    console.log("Starting game...");
    const startTx = await mining.startGame();
    await startTx.wait();
    console.log("Game started!\n");
  }

  console.log("=== CONFIGURATION COMPLETE ===");
  console.log("Rarities set: 200 Rare + 49 Ultra-Rare");
  console.log("Rewards pool funded");
  console.log("Game active and running");
}

main().catch(console.error);
