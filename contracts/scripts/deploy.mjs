import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("Set DEPLOYER_PRIVATE_KEY env var");
  }

  // Load compiled artifact
  const artifactPath = join(__dirname, "../../artifacts/contracts/NexusAgentNFT.sol/NexusAgentNFT.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  // Connect to Base mainnet
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer wallet has no ETH. Fund it first.");
  }

  // 0.005 ETH mint price
  const mintPrice = ethers.parseEther("0.005");
  console.log("Mint price:", mintPrice.toString(), "wei (0.005 ETH)");

  // Deploy
  console.log("\nDeploying NexusAgentNFT to Base mainnet...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(mintPrice);

  console.log("Transaction hash:", contract.deploymentTransaction().hash);
  console.log("Waiting for confirmation...");

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
  console.log("Contract address:", address);
  console.log("Transaction:", contract.deploymentTransaction().hash);
  console.log("Treasury tokens (0, 1) minted to:", wallet.address);
  console.log("=============================");
}

main().catch((error) => {
  console.error("Deployment failed:", error.message || error);
  process.exit(1);
});
