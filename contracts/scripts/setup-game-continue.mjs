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
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log('Deployer:', wallet.address);

  const mining = new ethers.Contract(DATA_MINING, MINING_ABI, wallet);
  const token = new ethers.Contract(NEXUS_TOKEN, TOKEN_ABI, wallet);

  // Parse metadata
  const tokenIds = [];
  const rarities = [];
  for (let i = 1; i <= 779; i++) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, `${i}.json`), 'utf8'));
      const tier = data.attributes.find(a => a.trait_type === 'Tier')?.value || 'Common';
      let rarity = 1;
      if (tier === 'Rare') rarity = 2;
      else if (tier === 'Ultra-Rare' || tier === 'Ultra Rare') rarity = 3;
      tokenIds.push(i);
      rarities.push(rarity);
    } catch (e) {}
  }

  // Continue from batch 2 (tokens 201+), batch 1 already done
  const BATCH = 200;
  const START_BATCH = 1; // 0-indexed, so batch index 1 = tokens 201-400
  for (let i = START_BATCH * BATCH; i < tokenIds.length; i += BATCH) {
    const batchIds = tokenIds.slice(i, i + BATCH);
    const batchRarities = rarities.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    console.log(`Batch ${batchNum}: tokens ${batchIds[0]}-${batchIds[batchIds.length - 1]} (${batchIds.length} tokens)...`);

    const nonce = await provider.getTransactionCount(wallet.address, 'latest');
    const tx = await mining.setNFTRarities(batchIds, batchRarities, { nonce });
    const receipt = await tx.wait();
    console.log(`  Done (tx: ${tx.hash}, gas: ${receipt.gasUsed})`);

    // Small delay between batches
    await new Promise(r => setTimeout(r, 2000));
  }

  // Fund rewards pool with 10M NEXUS
  console.log('\nApproving 10M NEXUS...');
  const fundAmount = ethers.parseEther('10000000');
  let nonce = await provider.getTransactionCount(wallet.address, 'latest');
  const approveTx = await token.approve(DATA_MINING, fundAmount, { nonce });
  await approveTx.wait();
  console.log(`  Approved (${approveTx.hash})`);

  await new Promise(r => setTimeout(r, 2000));

  console.log('Funding rewards pool...');
  nonce = await provider.getTransactionCount(wallet.address, 'latest');
  const fundTx = await mining.fundRewardsPool(fundAmount, { nonce });
  await fundTx.wait();
  console.log(`  Funded (${fundTx.hash})`);

  const pool = await mining.rewardsPool();
  console.log(`  Rewards pool: ${ethers.formatEther(pool)} NEXUS`);

  // Start game
  await new Promise(r => setTimeout(r, 2000));
  console.log('\nStarting game...');
  const roundId = await mining.currentRoundId();
  if (Number(roundId) === 0) {
    nonce = await provider.getTransactionCount(wallet.address, 'latest');
    const startTx = await mining.startGame({ nonce });
    await startTx.wait();
    console.log(`  Game started! (${startTx.hash})`);
  } else {
    console.log(`  Already running (round ${roundId})`);
  }

  console.log('\n=== SETUP COMPLETE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
