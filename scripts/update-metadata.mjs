import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE_DIR = "C:/Users/alokp/Downloads/nft_collection_merged/metadata";
const OUTPUT_DIR = join(__dirname, "../metadata");

const TOTAL_SUPPLY = 779;
const TREASURY_SUPPLY = 2;
const FREE_SUPPLY = 100;

mkdirSync(OUTPUT_DIR, { recursive: true });

for (let fileNum = 1; fileNum <= TOTAL_SUPPLY; fileNum++) {
  // Read original file (1.json through 779.json)
  const original = JSON.parse(readFileSync(join(SOURCE_DIR, `${fileNum}.json`), "utf8"));

  // Token ID is 0-based (file 1.json = token 0, file 2.json = token 1, etc.)
  const tokenId = fileNum - 1;

  // Determine type and phase
  let type, phase;
  if (tokenId < TREASURY_SUPPLY) {
    type = "Treasury";
    phase = "Genesis";
  } else if (tokenId < TREASURY_SUPPLY + FREE_SUPPLY) {
    type = "Free Mint";
    phase = "Phase 1 - Free";
  } else {
    type = "Paid Mint";
    phase = "Phase 2 - Paid";
  }

  // Keep existing attributes, update and add new ones
  const existingAttrs = original.attributes || [];

  // Update Generation to be the token ID
  const updatedAttrs = existingAttrs.map(attr => {
    if (attr.trait_type === "Generation") {
      return { ...attr, value: tokenId };
    }
    return attr;
  });

  // Add new attributes
  updatedAttrs.push(
    { trait_type: "Type", value: type },
    { trait_type: "Phase", value: phase },
    { trait_type: "Network", value: "Base" },
    { trait_type: "Node ID", value: tokenId, display_type: "number" }
  );

  // Build updated metadata
  const updated = {
    name: `Nexus Node #${tokenId}`,
    description: `A Nexus Node on the Base network. Minted by AI agents through proof-of-work challenges. ${original.description}`,
    image: original.image, // keep original ipfs:// image link
    external_url: "https://nexusnode.xyz",
    attributes: updatedAttrs
  };

  // Write as tokenId (no .json extension) for ERC-721 compatibility
  writeFileSync(join(OUTPUT_DIR, `${tokenId}`), JSON.stringify(updated, null, 2));
}

console.log(`Updated ${TOTAL_SUPPLY} metadata files → ${OUTPUT_DIR}`);
console.log(`Files named 0 through ${TOTAL_SUPPLY - 1} (no .json extension)\n`);

// Print samples
console.log("--- Token #0 (Treasury) ---");
console.log(readFileSync(join(OUTPUT_DIR, "0"), "utf8"));
console.log("\n--- Token #50 (Free Mint) ---");
console.log(readFileSync(join(OUTPUT_DIR, "50"), "utf8"));
console.log("\n--- Token #500 (Paid Mint) ---");
console.log(readFileSync(join(OUTPUT_DIR, "500"), "utf8"));
