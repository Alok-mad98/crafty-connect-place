require('dotenv').config();
const { ethers } = require('ethers');
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');
const solc = require('solc');

const RPC_URL = 'https://mainnet.base.org';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function main() {
  console.log('=== AgentSkillsMarket Deployment to Base Mainnet ===\n');

  // 1. Compile
  console.log('Step 1: Compiling contract...');
  const source = readFileSync(path.join(__dirname, 'AgentSkillsMarket.sol'), 'utf8');
  const input = JSON.stringify({
    language: 'Solidity',
    sources: { 'AgentSkillsMarket.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  });

  const output = JSON.parse(solc.compile(input));
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compile errors:', errors.map(e => e.formattedMessage).join('\n'));
      process.exit(1);
    }
    // Print warnings
    output.errors.filter(e => e.severity === 'warning').forEach(w => console.log('  Warning:', w.message));
  }

  const compiled = output.contracts['AgentSkillsMarket.sol']['AgentSkillsMarket'];
  const abi = compiled.abi;
  const bytecode = '0x' + compiled.evm.bytecode.object;
  console.log('  Compiled successfully. Bytecode size:', Math.round(bytecode.length / 2), 'bytes\n');

  // 2. Setup wallet
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk || pk === '0x...') {
    console.error('ERROR: DEPLOYER_PRIVATE_KEY not set');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);
  const treasuryAddress = wallet.address;

  console.log('Step 2: Wallet info');
  console.log('  Deployer:', wallet.address);
  console.log('  Treasury:', treasuryAddress, '(same as deployer)');

  const balance = await provider.getBalance(wallet.address);
  console.log('  ETH Balance:', ethers.formatEther(balance), 'ETH\n');

  if (balance === 0n) {
    console.error('ERROR: No ETH for gas fees');
    process.exit(1);
  }

  // 3. Deploy
  console.log('Step 3: Deploying to Base mainnet...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(USDC_ADDRESS, treasuryAddress);

  const txHash = contract.deploymentTransaction().hash;
  console.log('  Tx hash:', txHash);
  console.log('  Waiting for confirmation...');

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('\n  === CONTRACT DEPLOYED ===');
  console.log('  Address:', contractAddress);
  console.log('  BaseScan: https://basescan.org/address/' + contractAddress);

  // 4. Update .env
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /NEXT_PUBLIC_CONTRACT_ADDRESS="[^"]*"/,
    'NEXT_PUBLIC_CONTRACT_ADDRESS="' + contractAddress + '"'
  );
  writeFileSync(envPath, envContent);
  console.log('\n  .env updated with NEXT_PUBLIC_CONTRACT_ADDRESS');

  // 5. Save ABI
  const abiPath = path.join(__dirname, '..', 'src', 'lib', 'abi.json');
  writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  console.log('  ABI saved to src/lib/abi.json');

  console.log('\n=== Deployment Complete ===');
}

main().catch((err) => {
  console.error('\nDeployment failed:', err.message || err);
  process.exit(1);
});
