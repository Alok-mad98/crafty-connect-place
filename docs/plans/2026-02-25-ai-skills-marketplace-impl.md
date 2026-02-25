# AI Skills Marketplace — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete decentralized AI agent skills marketplace where humans and agents buy/sell .md skill files, with MCP server backend, USDC payments on Base, and cinematic UI.

**Architecture:** Monolithic Next.js 14 (App Router) with API routes serving as MCP server, Prisma+PostgreSQL for data, IPFS via Pinata for file storage, Privy for auth, Groq for AI chat, and Solidity smart contracts deployed on Base.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v4, Framer Motion, Privy, ethers.js v6, Prisma, Pinata SDK, Groq SDK, Hardhat, Solidity 0.8.24

---

### Task 1: Project Scaffold & Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```
Expected: Next.js project scaffolded with App Router

**Step 2: Install all dependencies**

Run:
```bash
npm install framer-motion @privy-io/react-auth @privy-io/server-auth ethers@6 @prisma/client pinata groq-sdk viem wagmi @tanstack/react-query
npm install -D prisma hardhat @nomicfoundation/hardhat-toolbox @types/node
```

**Step 3: Create .env.example**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_marketplace"

# Privy
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"
PRIVY_APP_SECRET="your-privy-app-secret"

# Pinata (IPFS)
PINATA_JWT="your-pinata-jwt"
NEXT_PUBLIC_PINATA_GATEWAY="your-gateway.mypinata.cloud"

# Groq
GROQ_API_KEY="your-groq-api-key"

# Smart Contract
NEXT_PUBLIC_CONTRACT_ADDRESS="0x..."
NEXT_PUBLIC_USDC_ADDRESS="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
NEXT_PUBLIC_CHAIN_ID="8453"

# Deployer
DEPLOYER_PRIVATE_KEY="0x..."
```

**Step 4: Configure tailwind.config.ts**

Add custom colors (no purple), fonts (Inter, Geist Mono), glassmorphism utilities, and extend theme with marketplace-specific tokens:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0a0e1a", light: "#111827" },
        amber: { warm: "#c4956a", glow: "#d4a574" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backdropBlur: { glass: "24px" },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "twinkle": "twinkle 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 5: Commit**

```bash
git init && git add -A && git commit -m "feat: scaffold Next.js project with all dependencies"
```

---

### Task 2: Prisma Schema & Database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

**Step 1: Write prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String     @id @default(cuid())
  privyId       String     @unique
  walletAddress String?
  createdAt     DateTime   @default(now())
  skills        Skill[]    @relation("CreatedSkills")
  purchases     Purchase[]
}

model Skill {
  id          String     @id @default(cuid())
  title       String
  description String
  price       Decimal    @db.Decimal(18, 6)
  ipfsCid     String
  modelTags   String[]
  creatorId   String
  creator     User       @relation("CreatedSkills", fields: [creatorId], references: [id])
  onchainId   Int?       @unique
  txHash      String?
  verified    Boolean    @default(false)
  active      Boolean    @default(true)
  createdAt   DateTime   @default(now())
  purchases   Purchase[]

  @@index([creatorId])
  @@index([verified, active])
}

model Purchase {
  id        String   @id @default(cuid())
  buyerId   String
  buyer     User     @relation(fields: [buyerId], references: [id])
  skillId   String
  skill     Skill    @relation(fields: [skillId], references: [id])
  txHash    String
  createdAt DateTime @default(now())

  @@unique([buyerId, skillId])
  @@index([buyerId])
  @@index([skillId])
}
```

**Step 2: Write src/lib/prisma.ts**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully

**Step 4: Commit**

```bash
git add prisma/ src/lib/prisma.ts && git commit -m "feat: add Prisma schema with User, Skill, Purchase models"
```

---

### Task 3: Smart Contract — AgentSkillsMarket.sol

**Files:**
- Create: `contracts/AgentSkillsMarket.sol`
- Create: `contracts/hardhat.config.ts`
- Create: `contracts/scripts/deploy.ts`
- Create: `contracts/package.json`

**Step 1: Write contracts/AgentSkillsMarket.sol**

Full Solidity contract with:
- IERC20 interface for USDC interaction
- `launchSkill(string calldata ipfsCid, uint256 price)` — transfers 0.5 USDC listing fee to treasury
- `buySkill(uint256 skillId)` — transfers price: 95% to creator, 5% to treasury
- `skills` mapping with struct {address creator, string ipfsCid, uint256 price, bool active}
- `hasPurchased` mapping: address => skillId => bool
- Events: SkillLaunched, SkillPurchased
- Owner functions: updateTreasury, pause/unpause
- Uses OpenZeppelin Ownable and Pausable patterns (inline, no import needed)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract AgentSkillsMarket {
    // --- State ---
    address public owner;
    address public treasury;
    IERC20 public usdc;
    bool public paused;

    uint256 public skillCount;
    uint256 public constant LISTING_FEE = 500_000; // 0.5 USDC (6 decimals)
    uint256 public constant MIN_PRICE = 2_000_000; // 2.0 USDC
    uint256 public constant CREATOR_SHARE = 9500; // 95.00%
    uint256 public constant BASIS = 10000;

    struct SkillData {
        address creator;
        string ipfsCid;
        uint256 price;
        bool active;
    }

    mapping(uint256 => SkillData) public skills;
    mapping(address => mapping(uint256 => bool)) public hasPurchased;

    // --- Events ---
    event SkillLaunched(uint256 indexed skillId, address indexed creator, string ipfsCid, uint256 price);
    event SkillPurchased(uint256 indexed skillId, address indexed buyer, uint256 price);
    event TreasuryUpdated(address newTreasury);
    event Paused(bool isPaused);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    constructor(address _usdc, address _treasury) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    function launchSkill(string calldata ipfsCid, uint256 price) external whenNotPaused returns (uint256) {
        require(price >= MIN_PRICE, "Price below minimum");
        require(bytes(ipfsCid).length > 0, "Empty CID");
        require(usdc.transferFrom(msg.sender, treasury, LISTING_FEE), "Listing fee failed");

        uint256 skillId = skillCount++;
        skills[skillId] = SkillData(msg.sender, ipfsCid, price, true);

        emit SkillLaunched(skillId, msg.sender, ipfsCid, price);
        return skillId;
    }

    function buySkill(uint256 skillId) external whenNotPaused {
        SkillData storage skill = skills[skillId];
        require(skill.active, "Skill not active");
        require(!hasPurchased[msg.sender][skillId], "Already purchased");
        require(skill.creator != msg.sender, "Cannot buy own skill");

        uint256 creatorAmount = (skill.price * CREATOR_SHARE) / BASIS;
        uint256 treasuryAmount = skill.price - creatorAmount;

        require(usdc.transferFrom(msg.sender, skill.creator, creatorAmount), "Creator payment failed");
        require(usdc.transferFrom(msg.sender, treasury, treasuryAmount), "Treasury payment failed");

        hasPurchased[msg.sender][skillId] = true;
        emit SkillPurchased(skillId, msg.sender, skill.price);
    }

    function updateTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function getSkill(uint256 skillId) external view returns (SkillData memory) {
        return skills[skillId];
    }
}
```

**Step 2: Write hardhat config and deploy script**

`contracts/hardhat.config.ts`:
```ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};
export default config;
```

`contracts/scripts/deploy.ts`:
```ts
import { ethers } from "hardhat";

async function main() {
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const treasury = process.env.TREASURY_ADDRESS!;
  const Market = await ethers.getContractFactory("AgentSkillsMarket");
  const market = await Market.deploy(USDC, treasury);
  await market.waitForDeployment();
  console.log("AgentSkillsMarket deployed to:", await market.getAddress());
}
main().catch(console.error);
```

**Step 3: Commit**

```bash
git add contracts/ && git commit -m "feat: add AgentSkillsMarket.sol with listing fee and payout splitter"
```

---

### Task 4: Library Modules (Privy, Pinata, Groq, Contract helpers)

**Files:**
- Create: `src/lib/privy.ts`
- Create: `src/lib/pinata.ts`
- Create: `src/lib/groq.ts`
- Create: `src/lib/contracts.ts`

**Step 1: Write src/lib/privy.ts**

```ts
import { PrivyClient } from "@privy-io/server-auth";

export const privyServer = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);
```

**Step 2: Write src/lib/pinata.ts**

```ts
import { PinataSDK } from "pinata";

export const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY!,
});

export async function uploadSkillToIPFS(file: File): Promise<string> {
  const result = await pinata.upload.file(file);
  return result.IpfsCid;
}

export async function fetchSkillFromIPFS(cid: string): Promise<string> {
  const response = await fetch(
    `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${cid}`
  );
  return response.text();
}
```

**Step 3: Write src/lib/groq.ts**

```ts
import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export const SYSTEM_PROMPT = `You are the Master AI of the AI Skills Marketplace — a decentralized platform where humans and AI agents buy and sell .md skill files via MCP (Model Context Protocol).

You help users:
- Understand what MCP skills are and how they work
- Browse and discover skills in The Vault
- Launch new skills in The Forge
- Understand USDC payments on Base chain
- Troubleshoot MCP connections

Be concise, helpful, and knowledgeable about Web3 and AI agents. Never execute transactions — only advise.`;
```

**Step 4: Write src/lib/contracts.ts**

```ts
export const AGENT_SKILLS_MARKET_ABI = [
  "function launchSkill(string calldata ipfsCid, uint256 price) external returns (uint256)",
  "function buySkill(uint256 skillId) external",
  "function getSkill(uint256 skillId) external view returns (tuple(address creator, string ipfsCid, uint256 price, bool active))",
  "function hasPurchased(address buyer, uint256 skillId) external view returns (bool)",
  "function skillCount() external view returns (uint256)",
  "function LISTING_FEE() external view returns (uint256)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
] as const;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
```

**Step 5: Commit**

```bash
git add src/lib/ && git commit -m "feat: add lib modules for Privy, Pinata, Groq, and contract helpers"
```

---

### Task 5: Providers (Privy + Wagmi + Framer Motion)

**Files:**
- Create: `src/providers/PrivyProvider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Write src/providers/PrivyProvider.tsx**

```tsx
"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";

const wagmiConfig = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BasePrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: { theme: "dark", accentColor: "#c4956a" },
        defaultChain: base,
        supportedChains: [base],
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </BasePrivyProvider>
  );
}
```

**Step 2: Update src/app/layout.tsx with fonts, providers, global background**

Wire up Inter + Geist Mono fonts, wrap children in Providers, add CinematicBackground component placeholder, add global styles.

**Step 3: Commit**

```bash
git add src/providers/ src/app/layout.tsx && git commit -m "feat: add Privy + Wagmi + React Query providers"
```

---

### Task 6: Cinematic Background Component

**Files:**
- Create: `src/components/CinematicBackground.tsx`

**Step 1: Write the star-field canvas + CSS gradient background**

Full component with:
- Fixed position, full viewport coverage, z-index behind content
- CSS gradient layers: deep navy (#0a0e1a) top → warm amber glow (#c4956a) at horizon → dark field at bottom
- HTML Canvas rendering ~200 stars with random positions, sizes (1-3px), and twinkling animation (opacity sine waves at varied frequencies)
- useEffect + requestAnimationFrame loop for smooth star animation
- Framer Motion `useScroll` + `useTransform` for parallax shift on background layers
- Cleanup on unmount

**Step 2: Commit**

```bash
git add src/components/CinematicBackground.tsx && git commit -m "feat: add cinematic starfield background with parallax"
```

---

### Task 7: UI Primitives (GlassCard, Buttons, Navbar)

**Files:**
- Create: `src/components/ui/GlassCard.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/Navbar.tsx`

**Step 1: Write GlassCard**

Reusable glassmorphic container: `bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/20`. Accept className override and children. Framer Motion wrapper with hover scale(1.01) and initial fade-in-up animation.

**Step 2: Write Button**

Two variants:
- `primary`: `bg-white text-black font-semibold rounded-xl px-6 py-3 hover:bg-white/90`
- `ghost`: `border border-white/20 text-white rounded-xl px-6 py-3 hover:bg-white/[0.06]`

Framer Motion whileHover scale(1.02) and whileTap scale(0.98).

**Step 3: Write Navbar**

Glassmorphic top bar fixed at top. Contains:
- Left: "NEXUS" logo text (Inter bold, white)
- Center: Navigation links — Home, Vault, Forge, Pricing (ghost style, white/60)
- Right: Privy login button using `usePrivy().login()` — shows [ Connect ] (primary white) when not authed, wallet address when authed
- `bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.06]`

**Step 4: Commit**

```bash
git add src/components/ && git commit -m "feat: add UI primitives — GlassCard, Button, Navbar with Privy auth"
```

---

### Task 8: The Nexus — Home Page (app/page.tsx)

**Files:**
- Create/Modify: `src/app/page.tsx`

**Step 1: Build the hero section**

- Massive center-aligned text: "AI That Thinks With You, Not For You."
- Subtext: "Equip your AI with premium skills instantly via MCP."
- Framer Motion staggered reveal: heading fades up (delay 0), subtext fades up (delay 0.2), CTA button fades up (delay 0.4)
- Primary white button: [ Explore Skills ] → links to /vault
- Ghost button: [ Launch a Skill ] → links to /forge
- All text Inter, white, tracking-tight
- Spring animation: damping 25, stiffness 120

**Step 2: Add a features/value proposition section below hero**

3 floating glassmorphic cards in a row:
1. "MCP Native" — "Skills that plug directly into any MCP-compatible AI agent"
2. "Onchain Payments" — "USDC on Base. Instant, transparent, 95% to creators"
3. "AI Verified" — "Every skill verified by our Master AI for MCP compliance"

Staggered reveal on scroll using `useInView`.

**Step 3: Commit**

```bash
git add src/app/page.tsx && git commit -m "feat: add Nexus home page with hero and feature cards"
```

---

### Task 9: Skill Card Component

**Files:**
- Create: `src/components/SkillCard.tsx`

**Step 1: Build the SkillCard**

Glassmorphic card displaying:
- Title (Inter semibold, white)
- Description (white/60, 2-line clamp)
- Model Tags as monospace chips: `[CLAUDE]` `[GPT4]` — Geist Mono, bg-white/[0.08], rounded-md, text-xs
- Price: "5.00 USDC" in Geist Mono, amber-warm color
- Two buttons at bottom:
  - [ Connect via MCP ] — ghost button
  - [ Download .md ] — ghost button
- Framer Motion: fade-in-up on mount, hover lift (y: -4), hover border glow (border-white/[0.15])

Props: `{ skill: { id, title, description, price, modelTags, ipfsCid } }`

**Step 2: Commit**

```bash
git add src/components/SkillCard.tsx && git commit -m "feat: add SkillCard component with glassmorphism and model tags"
```

---

### Task 10: The Vault — Buy Page (app/vault/page.tsx)

**Files:**
- Create: `src/app/vault/page.tsx`

**Step 1: Build the Vault page**

- Page title: "The Vault" — large heading with fade-in
- Subtitle: "Discover premium AI skills" — white/60
- Bento grid layout: CSS Grid, responsive (1 col mobile, 2 col tablet, 3 col desktop)
- Fetches skills from `/api/skills` on mount (client component with useEffect)
- Maps skills to SkillCard components
- Staggered reveal: each card delays by index * 0.1s
- Empty state: "No skills yet. Be the first to launch one."

**Step 2: Commit**

```bash
git add src/app/vault/ && git commit -m "feat: add Vault page with bento grid skill browsing"
```

---

### Task 11: The Forge — Launch Page (app/forge/page.tsx)

**Files:**
- Create: `src/app/forge/page.tsx`
- Create: `src/components/ForgeModal.tsx`

**Step 1: Build the ForgeModal component**

Centered glassmorphic modal containing:
- Title: "Launch a Skill" (Inter bold)
- Drag-and-drop zone: dashed border-white/[0.15], accepts .md files, shows file name on drop, `onDragOver`/`onDrop` handlers
- Title input: glassmorphic input field
- Description textarea: glassmorphic
- Model tags: multi-select chips (CLAUDE, GPT4, LLAMA, GEMINI) — toggle on click
- Price input: number, USDC denomination, minimum 2.00
- Big primary white button: [ Pay 0.5 USDC to Mint Skill ]
- On submit: calls Privy wallet to approve USDC, then call launchSkill on contract, then POST /api/skills with metadata

**Step 2: Build the Forge page**

Simple page wrapper that centers the ForgeModal. Requires auth (redirect to login if not connected via Privy).

**Step 3: Commit**

```bash
git add src/app/forge/ src/components/ForgeModal.tsx && git commit -m "feat: add Forge page with skill upload and onchain minting"
```

---

### Task 12: API Routes — Skills CRUD

**Files:**
- Create: `src/app/api/skills/route.ts`

**Step 1: Write GET /api/skills**

Returns all active, verified skills with creator info. Prisma query with includes.

**Step 2: Write POST /api/skills**

Authenticated (verify Privy token). Accepts: title, description, price, ipfsCid, modelTags, onchainId, txHash. Creates Skill record in database.

**Step 3: Commit**

```bash
git add src/app/api/skills/ && git commit -m "feat: add skills API routes for listing and creation"
```

---

### Task 13: API Route — MCP 402 Payment Endpoint

**Files:**
- Create: `src/app/api/mcp/skill/[id]/route.ts`

**Step 1: Write the MCP endpoint**

```ts
// GET /api/mcp/skill/[id]
// 1. Extract Privy auth token from Authorization header
// 2. Verify with privyServer.verifyAuthToken()
// 3. Look up user by privyId
// 4. Check Purchase table: has user purchased this skill?
// 5. If YES:
//    - Fetch .md content from IPFS via Pinata
//    - Return 200 with MCP resource format:
//      { type: "resource", uri: `mcp://skills/${id}`, mimeType: "text/markdown", content: "..." }
// 6. If NO:
//    - Return 402 with payment instructions:
//      { error: "payment_required", skill: { id, title, price },
//        payment: { currency: "USDC", chain: "base", chainId: 8453,
//                   contract: CONTRACT_ADDRESS, method: "buySkill(uint256)",
//                   args: [onchainId] } }
```

**Step 2: Commit**

```bash
git add src/app/api/mcp/ && git commit -m "feat: add MCP 402 payment gateway endpoint"
```

---

### Task 14: API Route — Master AI Chat

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Write POST /api/chat**

Streaming endpoint. Accepts `{ messages: [...] }`. Calls Groq SDK with Llama 3 70B, system prompt from `src/lib/groq.ts`, streams response back using ReadableStream.

**Step 2: Commit**

```bash
git add src/app/api/chat/ && git commit -m "feat: add Groq-powered Master AI chat endpoint"
```

---

### Task 15: Master AI Chat Widget

**Files:**
- Create: `src/components/MasterAIChat.tsx`

**Step 1: Build the floating chat widget**

- Bottom-right fixed position
- Collapsed state: glassmorphic circle button with a sparkle/brain icon
- Expanded state: glassmorphic panel (~350px wide, ~500px tall) with:
  - Header: "Master AI" title + close button
  - Message list: scrollable, user messages right-aligned, AI messages left-aligned
  - Input bar: glassmorphic text input + send button
- Uses `/api/chat` endpoint with streaming response parsing
- Framer Motion: AnimatePresence for open/close, layoutId for smooth transition from circle to panel
- Messages animate in with fade-up

**Step 2: Add MasterAIChat to layout.tsx (renders on all pages)**

**Step 3: Commit**

```bash
git add src/components/MasterAIChat.tsx src/app/layout.tsx && git commit -m "feat: add floating Master AI chat widget with Groq streaming"
```

---

### Task 16: API Route — Skill Verification

**Files:**
- Create: `src/app/api/verify/route.ts`

**Step 1: Write POST /api/verify**

Accepts a skill ID. Fetches the .md from IPFS, sends to Groq with a verification prompt (checks for valid MCP skill structure: frontmatter, description, instructions). Updates `verified` field in database. Returns verification result.

**Step 2: Commit**

```bash
git add src/app/api/verify/ && git commit -m "feat: add AI-powered skill verification endpoint"
```

---

### Task 17: Purchase Flow Integration

**Files:**
- Modify: `src/components/SkillCard.tsx`
- Create: `src/app/api/purchases/route.ts`

**Step 1: Add purchase API route**

POST /api/purchases — records a purchase after verifying the onchain transaction. Accepts: skillId, txHash. Verifies the tx on Base via ethers provider, confirms it's a buySkill call, then creates Purchase record.

**Step 2: Wire up buy flow in SkillCard**

When user clicks [ Connect via MCP ] or a buy button:
1. Check if already purchased (GET /api/purchases?skillId=X)
2. If not: prompt USDC approval → call buySkill on contract → POST /api/purchases with txHash
3. If yes: show MCP connection URI

**Step 3: Commit**

```bash
git add src/components/SkillCard.tsx src/app/api/purchases/ && git commit -m "feat: add purchase flow with onchain verification"
```

---

### Task 18: Page Transitions & Polish

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/PageTransition.tsx`

**Step 1: Add AnimatePresence page transitions**

Wrap page content in AnimatePresence with fade + slide transitions between routes.

**Step 2: Add smooth scroll behavior, final responsive tweaks, loading states**

**Step 3: Final commit**

```bash
git add -A && git commit -m "feat: add page transitions, responsive polish, and loading states"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffold | package.json, configs |
| 2 | Prisma schema | prisma/schema.prisma |
| 3 | Smart contract | AgentSkillsMarket.sol |
| 4 | Lib modules | privy.ts, pinata.ts, groq.ts, contracts.ts |
| 5 | Providers | PrivyProvider.tsx, layout.tsx |
| 6 | Background | CinematicBackground.tsx |
| 7 | UI primitives | GlassCard, Button, Navbar |
| 8 | Home page | app/page.tsx |
| 9 | Skill card | SkillCard.tsx |
| 10 | Vault page | app/vault/page.tsx |
| 11 | Forge page | app/forge/page.tsx, ForgeModal.tsx |
| 12 | Skills API | api/skills/route.ts |
| 13 | MCP 402 endpoint | api/mcp/skill/[id]/route.ts |
| 14 | Chat API | api/chat/route.ts |
| 15 | Chat widget | MasterAIChat.tsx |
| 16 | Verification API | api/verify/route.ts |
| 17 | Purchase flow | api/purchases/route.ts, SkillCard updates |
| 18 | Polish & transitions | PageTransition.tsx, responsive |
