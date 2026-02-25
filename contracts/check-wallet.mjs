import 'dotenv/config';
import { ethers } from 'ethers';

const pk = process.env.DEPLOYER_PRIVATE_KEY;
if (!pk || pk === '0x...') {
  console.log('ERROR: DEPLOYER_PRIVATE_KEY not set in .env');
  process.exit(1);
}

const wallet = new ethers.Wallet(pk);
console.log('DEPLOYER_ADDRESS:', wallet.address);

// Check ETH balance on Base
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const balance = await provider.getBalance(wallet.address);
console.log('BASE_ETH_BALANCE:', ethers.formatEther(balance), 'ETH');

if (balance === 0n) {
  console.log('WARNING: No ETH on Base mainnet. You need a tiny amount (~$0.01) for gas.');
}
