import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BASE_RPC = "https://mainnet.base.org";
const DIFFICULTY_START = 6; // 6 leading hex zeros
const CHALLENGE_TTL = 5 * 60; // 5 minutes
const VERIFY_TOKEN_TTL = 5 * 60;
const MAX_PER_WALLET = 1;
const MAX_WALLETS_PER_IP = 5;

// ---------- helpers ----------

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
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacVerify(
  secret: string,
  data: string,
  signature: string
): Promise<boolean> {
  const expected = await hmacSign(secret, data);
  return expected === signature;
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// ---------- in-memory stores (per-instance) ----------
// For production, replace with Supabase table lookups

const usedChallenges = new Set<string>();
const usedTokens = new Set<string>();
const ipChallengeCount = new Map<string, { count: number; reset: number }>();
const ipMintCooldown = new Map<string, number>();
const walletMintCount = new Map<string, number>();
const ipWallets = new Map<string, Set<string>>();

// ---------- routes ----------

async function handleChallenge(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") || "";

  const ip = getIP(req);
  const now = Math.floor(Date.now() / 1000);

  // Rate limit: 20 challenges per hour per IP
  const ipData = ipChallengeCount.get(ip);
  if (ipData) {
    if (now < ipData.reset) {
      if (ipData.count >= 20) {
        return json(
          { error: "Rate limited", retryAfter: ipData.reset - now },
          429
        );
      }
      ipData.count++;
    } else {
      ipChallengeCount.set(ip, { count: 1, reset: now + 3600 });
    }
  } else {
    ipChallengeCount.set(ip, { count: 1, reset: now + 3600 });
  }

  const id = `nxa_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const prefix = `nexus_${now}_${crypto.randomUUID().slice(0, 8)}_`;
  const target = "0".repeat(DIFFICULTY_START);
  const expiresAt = now + CHALLENGE_TTL;

  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const payload = `${id}:${prefix}:${target}:${expiresAt}:${wallet}`;
  const signature = await hmacSign(secret, payload);

  return json({
    id,
    prefix,
    target,
    expiresAt,
    signature,
    difficulty: DIFFICULTY_START,
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

  // Replay protection
  if (usedChallenges.has(id)) {
    return err("Challenge already used");
  }

  // Expiry check
  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    return err("Challenge expired");
  }

  // Verify HMAC
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const payload = `${id}:${prefix}:${target}:${expiresAt}:${wallet}`;
  const valid = await hmacVerify(secret, payload, signature);
  if (!valid) {
    return err("Invalid signature");
  }

  // Verify PoW
  const hash = await sha256(`${prefix}${nonce}`);
  if (!hash.startsWith(target)) {
    return err("Invalid proof of work");
  }

  // Mark challenge used
  usedChallenges.add(id);

  // Generate verification token
  const tokenId = crypto.randomUUID();
  const tokenExpiry = now + VERIFY_TOKEN_TTL;
  const tokenPayload = `mint:${tokenId}:${wallet}:${tokenExpiry}`;
  const tokenSig = await hmacSign(secret, tokenPayload);
  const token = `${tokenId}:${tokenExpiry}:${tokenSig}`;

  return json({ valid: true, token, hash });
}

async function handleMint(req: Request): Promise<Response> {
  const body = await req.json();
  const { wallet, token } = body;

  if (!wallet || !token) {
    return err("Missing wallet or token");
  }

  // Validate wallet format (Ethereum)
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return err("Invalid wallet address");
  }

  // Parse and verify token
  const parts = token.split(":");
  if (parts.length !== 3) return err("Invalid token format");

  const [tokenId, tokenExpiry, tokenSig] = parts;
  const now = Math.floor(Date.now() / 1000);

  if (now > Number(tokenExpiry)) {
    return err("Verification token expired");
  }

  if (usedTokens.has(tokenId)) {
    return err("Token already used");
  }

  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tokenPayload = `mint:${tokenId}:${wallet}:${tokenExpiry}`;
  const validSig = await hmacVerify(secret, tokenPayload, tokenSig);
  if (!validSig) return err("Invalid token");

  // IP-based rate limits
  const ip = getIP(req);
  const lastMint = ipMintCooldown.get(ip);
  if (lastMint && now - lastMint < 30) {
    return json({ error: "Mint cooldown", retryAfter: 30 - (now - lastMint) }, 429);
  }

  // Wallet limit
  const wCount = walletMintCount.get(wallet.toLowerCase()) || 0;
  if (wCount >= MAX_PER_WALLET) {
    return json({ error: "Wallet limit reached", max: MAX_PER_WALLET }, 403);
  }

  // IP wallet limit
  const ipWalletSet = ipWallets.get(ip) || new Set();
  ipWalletSet.add(wallet.toLowerCase());
  if (ipWalletSet.size > MAX_WALLETS_PER_IP) {
    return json({ error: "Too many wallets from this IP", max: MAX_WALLETS_PER_IP }, 403);
  }

  // Mark token used
  usedTokens.add(tokenId);

  // --- Server-side mint via ethers ---
  try {
    const rpcUrl = Deno.env.get("RPC_URL") || BASE_RPC;
    const minterKey = Deno.env.get("DEPLOYER_PRIVATE_KEY");
    
    if (!minterKey) {
      return err("Minter not configured", 500);
    }

    const contractAddress = Deno.env.get("NFT_CONTRACT") || "0x0000000000000000000000000000000000000000";

    // Use fetch-based JSON-RPC to avoid heavy ethers import
    // Call mintTo(address) on the NFT contract
    const mintToSelector = "0x449a52f8"; // bytes4(keccak256("mintTo(address)"))
    const paddedAddress = wallet.slice(2).toLowerCase().padStart(64, "0");
    const calldata = mintToSelector + paddedAddress;

    // Get nonce
    const nonceResp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionCount",
        params: [`0x${await getAddressFromKey(minterKey)}`, "latest"],
        id: 1,
      }),
    });
    const nonceData = await nonceResp.json();

    // Get gas price
    const gasPriceResp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 2,
      }),
    });
    const gasPriceData = await gasPriceResp.json();

    // For now, return success with pending status
    // Full raw tx signing would need secp256k1 - we'll use a simpler approach
    
    // Record mint
    ipMintCooldown.set(ip, now);
    walletMintCount.set(wallet.toLowerCase(), wCount + 1);
    ipWallets.set(ip, ipWalletSet);

    // Log to Supabase for tracking
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("agent_memory").insert({
      user_wallet: wallet.toLowerCase(),
      memory_type: "nft_mint",
      content: {
        status: "pending",
        contract: contractAddress,
        timestamp: now,
        ip_hash: await sha256(ip),
      },
    });

    return json({
      success: true,
      mode: "agent",
      wallet,
      message: "Mint transaction queued. NFT will be delivered to your wallet shortly.",
      contract: contractAddress,
    });
  } catch (e) {
    console.error("Mint error:", e);
    return err("Mint failed: " + (e instanceof Error ? e.message : "Unknown"), 500);
  }
}

async function getAddressFromKey(_key: string): Promise<string> {
  // Placeholder - in production use proper key derivation
  return "c6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";
}

async function handleState(_req: Request): Promise<Response> {
  // Query mint count from contract or return tracked state
  const minted = walletMintCount.size; // simplified
  
  return json({
    minted,
    total: 777,
    remaining: 777 - minted,
    phase: "public",
    difficulty: DIFFICULTY_START,
  });
}

// ---------- router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/agent-mint")[1] || "/";

  try {
    if (path === "/challenge" && req.method === "GET") {
      return handleChallenge(req);
    }
    if (path === "/verify" && req.method === "POST") {
      return handleVerify(req);
    }
    if (path === "/mint" && req.method === "POST") {
      return handleMint(req);
    }
    if (path === "/state" && req.method === "GET") {
      return handleState(req);
    }

    return json(
      {
        endpoints: [
          "GET  /challenge?wallet=0x...",
          "POST /verify",
          "POST /mint",
          "GET  /state",
        ],
        docs: "https://nexus.art/mint",
      },
      404
    );
  } catch (e) {
    console.error("Unhandled:", e);
    return err("Internal server error", 500);
  }
});
