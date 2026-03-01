import hre from "hardhat";

async function main() {
  // 0.005 ETH = 5000000000000000 wei
  const mintPrice = 5000000000000000n;

  console.log("Deploying NexusAgentNFT to Base mainnet...");
  console.log("Mint price:", mintPrice.toString(), "wei (0.005 ETH)");

  const NFT = await hre.ethers.getContractFactory("NexusAgentNFT");
  const nft = await NFT.deploy(mintPrice);
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("NexusAgentNFT deployed to:", address);
  console.log("Treasury tokens (0, 1) minted to deployer");
  console.log("Done!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
