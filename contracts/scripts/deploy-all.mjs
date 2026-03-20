import 'dotenv/config';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

// --- Config ---
const RPC_URL = 'https://mainnet.base.org';
const NEXUS_AGENT_NFT = '0x050bf16a260b3376BFf70aa9E87c95bd965Dc3b4';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function loadArtifact(contractName) {
  const p = path.join(ROOT, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
  const artifact = JSON.parse(readFileSync(p, 'utf8'));
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

async function deployContract(wallet, name, args = []) {
  const { abi, bytecode } = loadArtifact(name);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  console.log(`   Deploying ${name}...`);
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  console.log(`   Tx: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`   ${name}: ${addr}`);
  console.log(`   BaseScan: https://basescan.org/address/${addr}\n`);
  return { contract, address: addr, abi };
}

async function main() {
  // Setup
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('ERROR: DEPLOYER_PRIVATE_KEY not set in .env'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('\n========================================');
  console.log('  NEXUS PROTOCOL — BASE MAINNET DEPLOY');
  console.log('========================================\n');
  console.log('Deployer:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  if (balance === 0n) { console.error('ERROR: No ETH for gas'); process.exit(1); }

  // ─── 1. NexusToken ───
  console.log('1/4 NexusToken (ERC-20, 100M supply)');
  const nexusToken = await deployContract(wallet, 'NexusToken');

  // ─── 2. NexusTreasury ───
  console.log('2/4 NexusTreasury (fee collection, buyback & burn)');
  const treasury = await deployContract(wallet, 'NexusTreasury', [nexusToken.address]);

  // ─── 3. DataMining ───
  console.log('3/4 DataMining (5x5 grid mining game)');
  const dataMining = await deployContract(wallet, 'DataMining', [
    nexusToken.address,
    NEXUS_AGENT_NFT,
    treasury.address,
  ]);

  // ─── 4. AgentSkillsMarket ───
  console.log('4/4 AgentSkillsMarket (AI skills marketplace)');
  const skillsMarket = await deployContract(wallet, 'AgentSkillsMarket', [
    USDC_BASE,
    treasury.address,
  ]);

  // ─── Post-Deploy: Set DataMining as authorized source on Treasury ───
  console.log('========================================');
  console.log('  POST-DEPLOY CONFIG');
  console.log('========================================\n');

  console.log('Setting DataMining as authorized source on Treasury...');
  const treasuryContract = new ethers.Contract(treasury.address, treasury.abi, wallet);
  const tx = await treasuryContract.setAuthorizedSource(dataMining.address, true);
  await tx.wait();
  console.log('   Done\n');

  // ─── Summary ───
  console.log('========================================');
  console.log('  DEPLOYMENT COMPLETE');
  console.log('========================================\n');
  console.log('Contract Addresses:');
  console.log('  NexusAgentNFT:      ', NEXUS_AGENT_NFT, '(already deployed)');
  console.log('  NexusToken:         ', nexusToken.address);
  console.log('  NexusTreasury:      ', treasury.address);
  console.log('  DataMining:         ', dataMining.address);
  console.log('  AgentSkillsMarket:  ', skillsMarket.address);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Set NFT rarities: dataMining.setNFTRarities(tokenIds, rarities)');
  console.log('  2. Fund rewards pool: nexusToken.approve(dataMining) → dataMining.fundRewardsPool(amount)');
  console.log('  3. Start game: dataMining.startGame()');
  console.log('  4. Update frontend contracts.ts with new addresses');

  // Save addresses
  const envContent = [
    `NEXUS_TOKEN=${nexusToken.address}`,
    `NEXUS_TREASURY=${treasury.address}`,
    `DATA_MINING=${dataMining.address}`,
    `SKILLS_MARKET=${skillsMarket.address}`,
    `NEXUS_AGENT_NFT=${NEXUS_AGENT_NFT}`,
  ].join('\n');

  const deployPath = path.join(__dirname, '..', 'deployed-addresses.txt');
  writeFileSync(deployPath, envContent);
  console.log(`\nAddresses saved to: ${deployPath}`);
}

main().catch((err) => {
  console.error('\nDeployment failed:', err.message || err);
  process.exit(1);
});
