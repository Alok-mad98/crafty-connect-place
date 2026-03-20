import 'dotenv/config';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const RPC_URL = 'https://mainnet.base.org';

// Already deployed
const NEXUS_AGENT_NFT = '0x050bf16a260b3376BFf70aa9E87c95bd965Dc3b4';
const NEXUS_TOKEN = '0x75737B12CD44D520f517692F125e8D154CCC732B';
const NEXUS_TREASURY = '0x440082F9435bb491CE018feAe742d668469a6fA9';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function loadArtifact(contractName) {
  const p = path.join(ROOT, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('ERROR: DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);

  console.log('Deployer:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log('Current nonce:', nonce, '\n');

  // ─── 3. DataMining ───
  console.log('3/4 Deploying DataMining...');
  const dmArtifact = loadArtifact('DataMining');
  const dmFactory = new ethers.ContractFactory(dmArtifact.abi, dmArtifact.bytecode, wallet);
  const dataMining = await dmFactory.deploy(NEXUS_TOKEN, NEXUS_AGENT_NFT, NEXUS_TREASURY, { nonce });
  console.log('   Tx:', dataMining.deploymentTransaction().hash);
  await dataMining.waitForDeployment();
  const dmAddr = await dataMining.getAddress();
  console.log('   DataMining:', dmAddr);
  console.log('   BaseScan: https://basescan.org/address/' + dmAddr + '\n');

  // ─── 4. AgentSkillsMarket ───
  console.log('4/4 Deploying AgentSkillsMarket...');
  const smArtifact = loadArtifact('AgentSkillsMarket');
  const smFactory = new ethers.ContractFactory(smArtifact.abi, smArtifact.bytecode, wallet);
  const skillsMarket = await smFactory.deploy(USDC_BASE, NEXUS_TREASURY, { nonce: nonce + 1 });
  console.log('   Tx:', skillsMarket.deploymentTransaction().hash);
  await skillsMarket.waitForDeployment();
  const smAddr = await skillsMarket.getAddress();
  console.log('   AgentSkillsMarket:', smAddr);
  console.log('   BaseScan: https://basescan.org/address/' + smAddr + '\n');

  // ─── Post-Deploy Config ───
  console.log('Setting DataMining as authorized source on Treasury...');
  const treasuryContract = new ethers.Contract(NEXUS_TREASURY, dmArtifact.abi.length ? loadArtifact('NexusTreasury').abi : [], wallet);
  const treasuryAbi = loadArtifact('NexusTreasury').abi;
  const treasury = new ethers.Contract(NEXUS_TREASURY, treasuryAbi, wallet);
  const tx = await treasury.setAuthorizedSource(dmAddr, true);
  await tx.wait();
  console.log('   Done\n');

  // ─── Summary ───
  console.log('========================================');
  console.log('  ALL CONTRACTS DEPLOYED');
  console.log('========================================\n');
  console.log('  NexusAgentNFT:      ', NEXUS_AGENT_NFT);
  console.log('  NexusToken:         ', NEXUS_TOKEN);
  console.log('  NexusTreasury:      ', NEXUS_TREASURY);
  console.log('  DataMining:         ', dmAddr);
  console.log('  AgentSkillsMarket:  ', smAddr);

  const envContent = [
    `NEXUS_AGENT_NFT=${NEXUS_AGENT_NFT}`,
    `NEXUS_TOKEN=${NEXUS_TOKEN}`,
    `NEXUS_TREASURY=${NEXUS_TREASURY}`,
    `DATA_MINING=${dmAddr}`,
    `SKILLS_MARKET=${smAddr}`,
  ].join('\n');
  writeFileSync(path.join(__dirname, '..', 'deployed-addresses.txt'), envContent);
  console.log('\nAddresses saved to contracts/deployed-addresses.txt');
}

main().catch((err) => {
  console.error('\nFailed:', err.message || err);
  process.exit(1);
});
