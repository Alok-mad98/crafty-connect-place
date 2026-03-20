import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const METADATA_DIR = 'C:/Users/alokp/Downloads/nft_collection_merged/metadata';
const DATA_MINING = '0xe0fB97698dD52ED24eEAA3445f9239229822e02e';
const NEXUS_TOKEN = '0x75737B12CD44D520f517692F125e8D154CCC732B';

const MINING_ABI = [
  'function setNFTRarities(uint256[] tokenIds, uint8[] rarities) external',
  'function fundRewardsPool(uint256 amount) external',
  'function startGame() external',
  'function currentRoundId() external view returns (uint256)',
  'function rewardsPool() external view returns (uint256)',
];

const TOKEN_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log('Deployer:', wallet.address);

  const mining = new ethers.Contract(DATA_MINING, MINING_ABI, wallet);
  const token = new ethers.Contract(NEXUS_TOKEN, TOKEN_ABI, wallet);

  const balance = await token.balanceOf(wallet.address);
  console.log('NEXUS balance:', ethers.formatEther(balance));

  // ─── 1. Parse metadata for rarities ────────────────────────────
  console.log('\n=== STEP 1: Parse NFT rarities from metadata ===');
  const tokenIds = [];
  const rarities = [];
  // Rarity enum: 0=None, 1=Common, 2=Rare, 3=UltraRare

  for (let i = 1; i <= 779; i++) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, `${i}.json`), 'utf8'));
      const tier = data.attributes.find(a => a.trait_type === 'Tier')?.value || 'Common';
      let rarity = 1; // Common
      if (tier === 'Rare') rarity = 2;
      else if (tier === 'Ultra-Rare' || tier === 'Ultra Rare') rarity = 3;
      tokenIds.push(i);
      rarities.push(rarity);
    } catch (e) {
      console.log(`  Skipping token ${i}: ${e.message}`);
    }
  }

  const counts = { common: 0, rare: 0, ultraRare: 0 };
  rarities.forEach(r => {
    if (r === 1) counts.common++;
    else if (r === 2) counts.rare++;
    else if (r === 3) counts.ultraRare++;
  });
  console.log(`  Found: ${counts.common} Common, ${counts.rare} Rare, ${counts.ultraRare} Ultra-Rare`);

  // ─── 2. Set rarities in batches of 200 ─────────────────────────
  console.log('\n=== STEP 2: Set NFT rarities on-chain ===');
  const BATCH = 200;
  for (let i = 0; i < tokenIds.length; i += BATCH) {
    const batchIds = tokenIds.slice(i, i + BATCH);
    const batchRarities = rarities.slice(i, i + BATCH);
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}: tokens ${batchIds[0]}-${batchIds[batchIds.length - 1]}...`);
    const tx = await mining.setNFTRarities(batchIds, batchRarities);
    await tx.wait();
    console.log(`    Done (tx: ${tx.hash})`);
  }

  // ─── 3. Fund rewards pool ──────────────────────────────────────
  console.log('\n=== STEP 3: Fund rewards pool ===');
  // Fund with 10M NEXUS (10% of supply) for game emissions
  const fundAmount = ethers.parseEther('10000000'); // 10M NEXUS

  console.log('  Approving 10M NEXUS to DataMining...');
  const approveTx = await token.approve(DATA_MINING, fundAmount);
  await approveTx.wait();
  console.log(`    Approved (tx: ${approveTx.hash})`);

  console.log('  Funding rewards pool with 10M NEXUS...');
  const fundTx = await mining.fundRewardsPool(fundAmount);
  await fundTx.wait();
  console.log(`    Funded (tx: ${fundTx.hash})`);

  const pool = await mining.rewardsPool();
  console.log(`  Rewards pool: ${ethers.formatEther(pool)} NEXUS`);

  // ─── 4. Start the game ─────────────────────────────────────────
  console.log('\n=== STEP 4: Start the game ===');
  const roundId = await mining.currentRoundId();
  if (Number(roundId) === 0) {
    const startTx = await mining.startGame();
    await startTx.wait();
    console.log(`  Game started! (tx: ${startTx.hash})`);
  } else {
    console.log(`  Game already running (round ${roundId})`);
  }

  console.log('\n=== SETUP COMPLETE ===');
  console.log('  DataMining:', DATA_MINING);
  console.log('  NexusToken:', NEXUS_TOKEN);
  console.log(`  Rarities set: ${counts.common}C / ${counts.rare}R / ${counts.ultraRare}UR`);
  console.log(`  Rewards pool: ${ethers.formatEther(pool)} NEXUS`);
  console.log('  Game: ACTIVE');
}

main().catch(e => { console.error(e); process.exit(1); });
