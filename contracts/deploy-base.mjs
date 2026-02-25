import 'dotenv/config';
import { ethers } from 'ethers';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Config ---
const RPC_URL = 'https://mainnet.base.org';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function main() {
  console.log('=== AgentSkillsMarket Deployment to Base Mainnet ===\n');

  // 1. Compile contract with solc
  console.log('Step 1: Compiling contract...');
  const solcInput = {
    language: 'Solidity',
    sources: {
      'AgentSkillsMarket.sol': {
        content: readFileSync(path.join(__dirname, 'AgentSkillsMarket.sol'), 'utf8'),
      },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };

  // Use solcjs via hardhat's bundled version or npx
  let compiled;
  try {
    const solcPath = path.join(__dirname, '..', 'node_modules', 'solc');
    const solc = (await import(solcPath)).default;
    const output = JSON.parse(solc.compile(JSON.stringify(solcInput)));

    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length > 0) {
        console.error('Compilation errors:', errors.map(e => e.message).join('\n'));
        process.exit(1);
      }
    }

    compiled = output.contracts['AgentSkillsMarket.sol']['AgentSkillsMarket'];
  } catch (err) {
    console.error('Failed to compile. Trying npx solc...', err.message);
    // Fallback: try using hardhat compile
    try {
      execSync('npx hardhat compile', { cwd: __dirname, stdio: 'pipe' });
      // Read artifacts
      const artifactPath = path.join(__dirname, 'artifacts', 'contracts', 'AgentSkillsMarket.sol', 'AgentSkillsMarket.json');
      const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
      compiled = { abi: artifact.abi, evm: { bytecode: { object: artifact.bytecode.replace('0x', '') } } };
    } catch (err2) {
      console.error('Hardhat compile also failed:', err2.message);
      process.exit(1);
    }
  }

  const abi = compiled.abi;
  const bytecode = '0x' + compiled.evm.bytecode.object;
  console.log('  Contract compiled successfully.\n');

  // 2. Setup wallet
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error('ERROR: DEPLOYER_PRIVATE_KEY not set');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(pk, provider);
  const treasuryAddress = wallet.address; // Treasury = deployer for now

  console.log('Step 2: Deployer wallet');
  console.log('  Address:', wallet.address);
  console.log('  Treasury:', treasuryAddress);

  const balance = await provider.getBalance(wallet.address);
  console.log('  Balance:', ethers.formatEther(balance), 'ETH\n');

  if (balance === 0n) {
    console.error('ERROR: No ETH for gas. Send some ETH to', wallet.address);
    process.exit(1);
  }

  // 3. Deploy
  console.log('Step 3: Deploying AgentSkillsMarket...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(USDC_ADDRESS, treasuryAddress);

  console.log('  Transaction sent:', contract.deploymentTransaction().hash);
  console.log('  Waiting for confirmation...');

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('\n  CONTRACT DEPLOYED!');
  console.log('  Address:', contractAddress);
  console.log('  Explorer: https://basescan.org/address/' + contractAddress);

  // 4. Update .env
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /NEXT_PUBLIC_CONTRACT_ADDRESS="[^"]*"/,
    `NEXT_PUBLIC_CONTRACT_ADDRESS="${contractAddress}"`
  );
  writeFileSync(envPath, envContent);
  console.log('\n  .env updated with contract address.');

  // 5. Save ABI
  const abiPath = path.join(__dirname, '..', 'src', 'lib', 'abi.json');
  writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  console.log('  ABI saved to src/lib/abi.json');

  console.log('\n=== Deployment Complete ===');
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
