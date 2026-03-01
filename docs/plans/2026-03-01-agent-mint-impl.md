# Agent Mint System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete agent-only NFT mint system (779 supply, PoW-gated, bloks.art style) with contract, backend edge functions, and frontend.

**Architecture:** Solidity contract on Base mainnet (deploy via Remix) + Supabase Edge Function for PoW challenge/verify/mint API + Vite React frontend with minimal bloks.art-style mint page and separate docs page.

**Tech Stack:** Solidity 0.8.24, OpenZeppelin ERC721, Deno (Supabase Edge Functions), ethers.js (tx signing), React 19, Framer Motion, Tailwind CSS 4, Privy Auth.

---

### Task 1: Rewrite Smart Contract

**Files:**
- Modify: `contracts/NexusAgentNFT.sol` (full rewrite)

**Step 1: Replace NexusAgentNFT.sol with updated contract**

Key changes from current:
- MAX_SUPPLY = 779 (was 777)
- TREASURY_SUPPLY = 2 (new)
- FREE_SUPPLY = 100 (unchanged)
- Constructor mints 2 treasury NFTs to owner
- Remove public `mint()` function (agents-only, no human minting)
- Remove `fundingSource` / `fundedWalletCount` / `MAX_FUNDED_MINTS` (unnecessary complexity)
- Keep `mintTo(address)` as onlyOwner for server-side minting
- Add `TREASURY_WALLET` constant
- `withdraw()` sends to owner (admin wallet)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NexusAgentNFT
 * @notice 779 supply NFT on Base. 2 treasury + 100 free + 677 paid.
 * @dev Server-side mint via mintTo() after agents solve SHA-256 PoW.
 */
contract NexusAgentNFT is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 779;
    uint256 public constant TREASURY_SUPPLY = 2;
    uint256 public constant FREE_SUPPLY = 100;
    uint256 public mintPrice; // Wei, set by owner (~10 USD in ETH)

    uint256 public totalMinted;
    bool public mintActive;

    string public constant METADATA_CID =
        "QmPcU97STF7X5LnNnMb238Frmy6WcmecYAqcCXGMf8wTii";

    mapping(address => bool) public hasMinted;

    event Minted(address indexed to, uint256 indexed tokenId, bool free);
    event MintPriceUpdated(uint256 newPrice);
    event MintToggled(bool active);

    constructor(uint256 _mintPrice) ERC721("Nexus Node", "NNODE") Ownable(msg.sender) {
        mintPrice = _mintPrice;
        mintActive = false;

        // Mint 2 treasury NFTs to deployer
        for (uint256 i = 0; i < TREASURY_SUPPLY; i++) {
            _safeMint(msg.sender, totalMinted);
            emit Minted(msg.sender, totalMinted, true);
            totalMinted++;
        }
    }

    /**
     * @notice Server-side mint. Called by owner after agent solves PoW.
     * @param to Agent wallet address
     */
    function mintTo(address to) external onlyOwner {
        require(mintActive, "Mint not active");
        require(totalMinted < MAX_SUPPLY, "Sold out");
        require(!hasMinted[to], "Already minted");

        hasMinted[to] = true;
        uint256 tokenId = totalMinted;
        totalMinted++;

        bool isFree = tokenId < (TREASURY_SUPPLY + FREE_SUPPLY);

        _safeMint(to, tokenId);
        emit Minted(to, tokenId, isFree);
    }

    function setMintPrice(uint256 _price) external onlyOwner {
        mintPrice = _price;
        emit MintPriceUpdated(_price);
    }

    function toggleMint(bool _active) external onlyOwner {
        mintActive = _active;
        emit MintToggled(_active);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked("ipfs://", METADATA_CID, "/", _toString(tokenId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
```

**Step 2: Verify contract compiles**

Open Remix IDE (remix.ethereum.org):
1. Create NexusAgentNFT.sol, paste code
2. Add OpenZeppelin imports (Remix auto-fetches from npm)
3. Compile with Solidity 0.8.24
4. Expected: compiles with 0 errors

**Step 3: Note deployment instructions for later**

Deploy on Base mainnet via Remix:
1. Connect MetaMask to Base Mainnet (chainId 8453)
2. Constructor arg: `_mintPrice` in wei (e.g., for $10 at ETH=$2500: 10/2500 = 0.004 ETH = 4000000000000000 wei)
3. Deploy from admin wallet `0xc6525DBbc9AC18fBf9ec93C219670B0dBb6cF2D3`
4. Note deployed contract address for env vars

---

### Task 2: Create Supabase Migration for Mint Tables

**Files:**
- Create: `supabase/migrations/20260301000000_mint_ledger.sql`

**Step 1: Write migration SQL**

```sql
-- Mint ledger: tracks every successful mint
CREATE TABLE public.mint_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id INTEGER NOT NULL UNIQUE,
  wallet TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  pow_time_ms INTEGER,
  free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mint config: admin-controlled key/value store
CREATE TABLE public.mint_config (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.mint_config (key, value) VALUES
  ('mint_active', 'false'),
  ('mint_price_wei', '4000000000000000');

-- Used payment tx hashes (prevent reuse)
CREATE TABLE public.used_payment_txs (
  tx_hash TEXT NOT NULL PRIMARY KEY,
  wallet TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.mint_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mint_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_payment_txs ENABLE ROW LEVEL SECURITY;

-- Mint ledger: public read, service-role insert
CREATE POLICY "Mint ledger publicly readable" ON public.mint_ledger FOR SELECT USING (true);
CREATE POLICY "Mint ledger service insert" ON public.mint_ledger FOR INSERT WITH CHECK (true);

-- Mint config: public read, service-role update
CREATE POLICY "Mint config publicly readable" ON public.mint_config FOR SELECT USING (true);
CREATE POLICY "Mint config service manage" ON public.mint_config FOR ALL USING (true);

-- Used payment txs: service only
CREATE POLICY "Used txs service manage" ON public.used_payment_txs FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_mint_ledger_wallet ON public.mint_ledger(wallet);
CREATE INDEX idx_mint_ledger_created ON public.mint_ledger(created_at DESC);
```

**Step 2: Apply migration**

Run: `npx supabase db push` from project root, or apply via Supabase Dashboard SQL Editor.

---

### Task 3: Rewrite Agent-Mint Edge Function

**Files:**
- Modify: `supabase/functions/agent-mint/index.ts` (full rewrite)

**Step 1: Replace edge function with complete implementation**

Key changes:
- Use ethers.js (via esm.sh) for real transaction signing
- Read totalMinted from contract on-chain
- Read mint_config from Supabase for active/price state
- Log mints to mint_ledger table
- Verify payment tx hashes for paid mints
- Rate limits via Supabase tables (not in-memory)
- 6 leading zeros difficulty

The full code is provided below. This handles:
- `GET /challenge` — issue PoW challenge
- `POST /verify` — verify PoW solution, return payment info if needed
- `POST /mint` — verify payment (if paid), sign + send mintTo tx
- `GET /state` — read on-chain totalMinted + recent mints from DB
- `POST /admin/toggle` — admin toggles mint active (requires admin wallet signature)

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.16.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DIFFICULTY = 6;
const CHALLENGE_TTL = 5 * 60;
const VERIFY_TOKEN_TTL = 5 * 60;
const MAX_PER_WALLET = 1;
const MAX_WALLETS_PER_IP = 5;
const TREASURY_SUPPLY = 2;
const FREE_SUPPLY = 100;
const MAX_SUPPLY = 779;
const ADMIN_WALLET = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";

const NFT_ABI = [
  "function mintTo(address to) external",
  "function totalMinted() external view returns (uint256)",
  "function mintActive() external view returns (bool)",
  "function hasMinted(address) external view returns (bool)",
  "function mintPrice() external view returns (uint256)",
];

// --- Helpers ---

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacVerify(secret: string, data: string, signature: string): Promise<boolean> {
  return (await hmacSign(secret, data)) === signature;
}

async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";
}

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function getProvider() {
  const rpc = Deno.env.get("RPC_URL") || "https://mainnet.base.org";
  return new ethers.JsonRpcProvider(rpc);
}

function getMinterWallet() {
  const key = Deno.env.get("DEPLOYER_PRIVATE_KEY")!;
  return new ethers.Wallet(key, getProvider());
}

function getContract() {
  const addr = Deno.env.get("NFT_CONTRACT")!;
  return new ethers.Contract(addr, NFT_ABI, getMinterWallet());
}

// --- In-memory rate limit stores (reset on cold start, acceptable for edge functions) ---
const usedChallenges = new Set<string>();
const usedTokens = new Set<string>();
const ipChallengeCount = new Map<string, { count: number; reset: number }>();

// --- Route Handlers ---

async function handleChallenge(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") || "";
  const ip = getIP(req);
  const now = Math.floor(Date.now() / 1000);

  // Rate limit: 20 challenges per hour per IP
  const ipData = ipChallengeCount.get(ip);
  if (ipData && now < ipData.reset) {
    if (ipData.count >= 20) {
      return json({ error: "Rate limited", retryAfter: ipData.reset - now }, 429);
    }
    ipData.count++;
  } else {
    ipChallengeCount.set(ip, { count: 1, reset: now + 3600 });
  }

  const id = `nxa_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const prefix = `nexus_${now}_${crypto.randomUUID().slice(0, 8)}_`;
  const target = "0".repeat(DIFFICULTY);
  const expiresAt = now + CHALLENGE_TTL;

  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const payload = `${id}:${prefix}:${target}:${expiresAt}:${wallet}`;
  const signature = await hmacSign(secret, payload);

  return json({
    id, prefix, target, expiresAt, signature,
    difficulty: DIFFICULTY,
    metadata: { wallet },
  });
}

async function handleVerify(req: Request): Promise<Response> {
  const body = await req.json();
  const { id, prefix, nonce, target, expiresAt, signature, metadata } = body;
  const wallet = metadata?.wallet || "";

  if (!id || !prefix || nonce === undefined || !target || !expiresAt || !signature) {
    return err("Missing required fields");
  }

  if (usedChallenges.has(id)) return err("Challenge already used");

  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) return err("Challenge expired");

  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const payload = `${id}:${prefix}:${target}:${expiresAt}:${wallet}`;
  if (!(await hmacVerify(secret, payload, signature))) return err("Invalid signature");

  const hash = await sha256(`${prefix}${nonce}`);
  if (!hash.startsWith(target)) return err("Invalid proof of work");

  usedChallenges.add(id);

  // Generate verification token
  const tokenId = crypto.randomUUID();
  const tokenExpiry = now + VERIFY_TOKEN_TTL;
  const tokenPayload = `mint:${tokenId}:${wallet}:${tokenExpiry}`;
  const tokenSig = await hmacSign(secret, tokenPayload);
  const token = `${tokenId}:${tokenExpiry}:${tokenSig}`;

  // Check if payment is required
  let paymentRequired = false;
  let paymentAmount = "0";
  let paymentAmountUsd = 0;

  try {
    const contract = getContract();
    const totalMinted = await contract.totalMinted();
    const mintPrice = await contract.mintPrice();
    const minted = Number(totalMinted);

    if (minted >= TREASURY_SUPPLY + FREE_SUPPLY) {
      paymentRequired = true;
      paymentAmount = mintPrice.toString();
      paymentAmountUsd = 10;
    }
  } catch (e) {
    console.error("Contract read error:", e);
  }

  return json({
    valid: true, token, hash,
    payment: {
      required: paymentRequired,
      amount: paymentAmount,
      amountUsd: paymentAmountUsd,
      recipient: ADMIN_WALLET,
    },
  });
}

async function handleMint(req: Request): Promise<Response> {
  const body = await req.json();
  const { wallet, token, paymentTxHash } = body;

  if (!wallet || !token) return err("Missing wallet or token");
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return err("Invalid wallet address");

  // Parse and verify token
  const parts = token.split(":");
  if (parts.length !== 3) return err("Invalid token format");
  const [tokenId, tokenExpiry, tokenSig] = parts;
  const now = Math.floor(Date.now() / 1000);

  if (now > Number(tokenExpiry)) return err("Verification token expired");
  if (usedTokens.has(tokenId)) return err("Token already used");

  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tokenPayload = `mint:${tokenId}:${wallet}:${tokenExpiry}`;
  if (!(await hmacVerify(secret, tokenPayload, tokenSig))) return err("Invalid token");

  const supabase = getSupabase();

  // Check mint is active
  const { data: configData } = await supabase
    .from("mint_config").select("value").eq("key", "mint_active").single();
  if (configData?.value !== "true") return err("Mint not active");

  // Read contract state
  const contract = getContract();
  const totalMinted = Number(await contract.totalMinted());

  if (totalMinted >= MAX_SUPPLY) return err("Sold out");

  const alreadyMinted = await contract.hasMinted(wallet);
  if (alreadyMinted) return json({ error: "Wallet already minted", max: MAX_PER_WALLET }, 403);

  // Check if payment needed
  const isFree = totalMinted < (TREASURY_SUPPLY + FREE_SUPPLY);

  if (!isFree) {
    if (!paymentTxHash) return err("Payment required. Send ETH to " + ADMIN_WALLET);

    // Check tx not already used
    const { data: usedTx } = await supabase
      .from("used_payment_txs").select("tx_hash").eq("tx_hash", paymentTxHash).single();
    if (usedTx) return err("Payment tx already used");

    // Verify payment on-chain
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(paymentTxHash);
    if (!receipt || receipt.status !== 1) return err("Payment tx not confirmed");

    const tx = await provider.getTransaction(paymentTxHash);
    if (!tx) return err("Payment tx not found");

    if (tx.to?.toLowerCase() !== ADMIN_WALLET) return err("Payment sent to wrong address");
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) return err("Payment sender does not match wallet");

    const mintPrice = await contract.mintPrice();
    if (tx.value < mintPrice) return err("Insufficient payment. Required: " + mintPrice.toString() + " wei");

    // Mark tx as used
    await supabase.from("used_payment_txs").insert({ tx_hash: paymentTxHash, wallet: wallet.toLowerCase() });
  }

  // Mark token as used
  usedTokens.add(tokenId);

  // Send mintTo transaction
  try {
    const tx = await contract.mintTo(wallet);
    const receipt = await tx.wait();

    // Log to mint_ledger
    await supabase.from("mint_ledger").insert({
      token_id: totalMinted,
      wallet: wallet.toLowerCase(),
      tx_hash: receipt.hash,
      free: isFree,
    });

    return json({
      success: true,
      mode: "agent",
      tokenId: totalMinted,
      txHash: receipt.hash,
      free: isFree,
      message: isFree ? "Free mint successful!" : "Paid mint successful!",
    });
  } catch (e) {
    console.error("Mint tx error:", e);
    return err("Mint transaction failed: " + (e instanceof Error ? e.message : "Unknown"), 500);
  }
}

async function handleState(_req: Request): Promise<Response> {
  try {
    const contract = getContract();
    const totalMinted = Number(await contract.totalMinted());
    const mintActive = await contract.mintActive();
    const mintPrice = (await contract.mintPrice()).toString();

    const supabase = getSupabase();
    const { data: recentMints } = await supabase
      .from("mint_ledger")
      .select("token_id, wallet, tx_hash, free, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    let phase = "not_started";
    if (totalMinted >= MAX_SUPPLY) phase = "sold_out";
    else if (totalMinted >= TREASURY_SUPPLY + FREE_SUPPLY) phase = "paid";
    else if (totalMinted >= TREASURY_SUPPLY) phase = "free";

    return json({
      minted: totalMinted,
      total: MAX_SUPPLY,
      remaining: MAX_SUPPLY - totalMinted,
      phase,
      mintActive,
      mintPrice,
      difficulty: DIFFICULTY,
      recentMints: recentMints || [],
    });
  } catch (e) {
    console.error("State error:", e);
    // Fallback if contract not deployed yet
    return json({
      minted: 0, total: MAX_SUPPLY, remaining: MAX_SUPPLY,
      phase: "not_started", mintActive: false, mintPrice: "0",
      difficulty: DIFFICULTY, recentMints: [],
    });
  }
}

async function handleAdminToggle(req: Request): Promise<Response> {
  const body = await req.json();
  const { active, adminSignature, message } = body;

  if (active === undefined) return err("Missing 'active' field");

  // Verify admin signature
  if (!adminSignature || !message) return err("Missing admin signature");

  try {
    const recovered = ethers.verifyMessage(message, adminSignature);
    if (recovered.toLowerCase() !== ADMIN_WALLET) return err("Not admin", 403);
  } catch {
    return err("Invalid signature", 403);
  }

  const supabase = getSupabase();
  await supabase.from("mint_config").update({ value: String(active) }).eq("key", "mint_active");

  return json({ success: true, mintActive: active });
}

// --- Router ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/agent-mint")[1] || "/";

  try {
    if (path === "/challenge" && req.method === "GET") return handleChallenge(req);
    if (path === "/verify" && req.method === "POST") return handleVerify(req);
    if (path === "/mint" && req.method === "POST") return handleMint(req);
    if (path === "/state" && req.method === "GET") return handleState(req);
    if (path === "/admin/toggle" && req.method === "POST") return handleAdminToggle(req);

    return json({
      name: "Nexus Node Agent Mint API",
      endpoints: [
        "GET  /challenge?wallet=0x...",
        "POST /verify",
        "POST /mint",
        "GET  /state",
      ],
      docs: "https://your-domain.com/mint/docs",
    }, 404);
  } catch (e) {
    console.error("Unhandled:", e);
    return err("Internal server error", 500);
  }
});
```

**Step 2: Deploy edge function**

Run: `npx supabase functions deploy agent-mint --no-verify-jwt`

Set secrets in Supabase Dashboard → Edge Functions → Secrets:
- `DEPLOYER_PRIVATE_KEY` = minter wallet private key
- `NFT_CONTRACT` = deployed contract address
- `RPC_URL` = https://mainnet.base.org (or Alchemy URL)

---

### Task 4: Create Agent Docs Page

**Files:**
- Create: `src/pages/MintDocs.tsx`

**Step 1: Create the docs page component**

This page shows the full API documentation for agents/developers. Always accessible.
Contains: quick start, all endpoints with request/response, Python + Node.js examples, rate limits, payment flow.

The page uses the same dark theme, monospace font, and code blocks from the existing Mint.tsx but reorganized as pure documentation.

Content mirrors the bloks.art agents.md structure:
- Overview section
- Quick Start (4 steps)
- Endpoint details (challenge, verify, mint, state)
- Rate limits table
- Python example
- Node.js example
- Error codes
- Payment flow explanation

---

### Task 5: Rewrite Mint Page (bloks.art style)

**Files:**
- Modify: `src/pages/Mint.tsx` (full rewrite)

**Step 1: Replace Mint.tsx with bloks.art-style minimal page**

Key changes:
- Remove all inline docs/code snippets (moved to MintDocs page)
- Add HUMANS / AGENTS / ABOUT tabs (like bloks.art)
- Add real-time mint ledger (polls /state every 10s)
- Add SOLD OUT state when all minted
- Add GO LIVE toggle for admin
- Keep admin gate (only admin sees page when mint not live)
- Yellow/amber accent color scheme matching existing theme
- Minimal, dark, bloks.art aesthetic

Layout:
```
Header: "NEXUS NODE" (or collection name)
Progress: "142 / 779 MINTED" + progress bar + LIVE/SOLD OUT badge
Tabs: HUMANS | AGENTS | ABOUT
  - HUMANS: "Biological entities blocked" message
  - AGENTS: Brief text + AGENT DOCS button
  - ABOUT: Collection info
Recent Mints: Real-time scrolling ledger
Footer: Supply | Chain | SHA-256 PoW
Admin: GO LIVE toggle (only for admin wallet)
```

---

### Task 6: Update Routing

**Files:**
- Modify: `src/App.tsx` (add /mint/docs route)

**Step 1: Add MintDocs route**

```tsx
import MintDocs from "@/pages/MintDocs";

// Inside Routes:
<Route path="/mint/docs" element={<MintDocs />} />
```

---

### Task 7: Deployment Checklist

**Step 1: Deploy contract on Base mainnet via Remix**

1. Go to remix.ethereum.org
2. Create file NexusAgentNFT.sol, paste contract code
3. Compile with Solidity 0.8.24
4. Connect MetaMask to Base Mainnet
5. Deploy with constructor arg: `_mintPrice` in wei
   - Example: $10 at ETH=$2500 → 0.004 ETH → `4000000000000000`
6. Note the deployed contract address

**Step 2: Set Supabase Edge Function secrets**

In Supabase Dashboard → Edge Functions → Secrets:
- `DEPLOYER_PRIVATE_KEY` = private key of the wallet that deployed the contract
- `NFT_CONTRACT` = deployed contract address from step 1
- `RPC_URL` = `https://mainnet.base.org`

**Step 3: Apply database migration**

Run the SQL from Task 2 in Supabase Dashboard → SQL Editor.

**Step 4: Deploy edge function**

```bash
npx supabase functions deploy agent-mint --no-verify-jwt
```

**Step 5: Set frontend env vars**

In `.env`:
```
VITE_SUPABASE_PROJECT_ID=xiofvutfjujnzdzlgmyc
VITE_NFT_CONTRACT=<deployed-address>
```

**Step 6: Test the flow**

1. Connect admin wallet → see mint page → toggle GO LIVE
2. Hit GET /challenge?wallet=0xTEST
3. Solve PoW locally (Python script)
4. POST /verify with solution
5. POST /mint with token (first 100 are free)
6. Verify NFT appears on BaseScan

**Step 7: Build and deploy frontend**

```bash
npm run build
```
Deploy `dist/` to your hosting (Vercel, Netlify, etc.).
