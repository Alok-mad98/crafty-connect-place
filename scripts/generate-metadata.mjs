import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "../metadata");

const IMAGE_CID = "QmWPaAqeVcX14BkoifjmRwnfKnsD3oKeyjM8MxpPk8R8JA";
const TOTAL_SUPPLY = 779;
const TREASURY_SUPPLY = 2;
const FREE_SUPPLY = 100;

mkdirSync(OUTPUT_DIR, { recursive: true });

for (let tokenId = 0; tokenId < TOTAL_SUPPLY; tokenId++) {
  // Images are named 1.png to 779.png, tokenIds are 0 to 778
  const imageNumber = tokenId + 1;

  let type;
  if (tokenId < TREASURY_SUPPLY) {
    type = "Treasury";
  } else if (tokenId < TREASURY_SUPPLY + FREE_SUPPLY) {
    type = "Free Mint";
  } else {
    type = "Paid Mint";
  }

  let phase;
  if (tokenId < TREASURY_SUPPLY) {
    phase = "Genesis";
  } else if (tokenId < TREASURY_SUPPLY + FREE_SUPPLY) {
    phase = "Phase 1 - Free";
  } else {
    phase = "Phase 2 - Paid";
  }

  const metadata = {
    name: `Nexus Node #${tokenId}`,
    description: "A Nexus Node on the Base network. Minted by AI agents through proof-of-work challenges. Each node represents a unique position in the Nexus Network.",
    image: `ipfs://${IMAGE_CID}/${imageNumber}.png`,
    external_url: "https://nexusnode.xyz",
    attributes: [
      {
        trait_type: "Node ID",
        value: tokenId,
        display_type: "number"
      },
      {
        trait_type: "Type",
        value: type
      },
      {
        trait_type: "Phase",
        value: phase
      },
      {
        trait_type: "Network",
        value: "Base"
      },
      {
        trait_type: "Standard",
        value: "ERC-721"
      }
    ]
  };

  // Write without .json extension (ERC-721 standard)
  const filePath = join(OUTPUT_DIR, `${tokenId}`);
  writeFileSync(filePath, JSON.stringify(metadata, null, 2));
}

console.log(`Generated ${TOTAL_SUPPLY} metadata files in ${OUTPUT_DIR}`);

// Print samples
import { readFileSync } from "fs";
console.log("\n--- Token #0 (Treasury) ---");
console.log(readFileSync(join(OUTPUT_DIR, "0"), "utf8"));
console.log("\n--- Token #2 (Free Mint) ---");
console.log(readFileSync(join(OUTPUT_DIR, "2"), "utf8"));
console.log("\n--- Token #102 (Paid Mint) ---");
console.log(readFileSync(join(OUTPUT_DIR, "102"), "utf8"));
