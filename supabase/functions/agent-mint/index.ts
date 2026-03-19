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
const MAX_SUPPLY = 779;
const ADMIN_WALLET = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";

// GTD Phase 1 timing (UTC)
const PHASE1_START = new Date("2026-03-19T09:30:00Z").getTime();
const PHASE1_END = new Date("2026-03-19T12:00:00Z").getTime();

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

// --- In-memory rate limit stores ---
const usedChallenges = new Set<string>();
const usedTokens = new Set<string>();
const ipChallengeCount = new Map<string, { count: number; reset: number }>();

// --- Route Handlers ---

async function handleChallenge(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") || "";
  const ip = getIP(req);
  const now = Math.floor(Date.now() / 1000);

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

  if (!wallet || !token) return err("Missing wallet or token");
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return err("Invalid wallet address");

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

  const { data: configData } = await supabase
    .from("mint_config").select("value").eq("key", "mint_active").single();
  if (configData?.value !== "true") return err("Mint not active");

  const contract = getContract();
  const totalMinted = Number(await contract.totalMinted());

  if (totalMinted >= MAX_SUPPLY) return err("Sold out");

  const alreadyMinted = await contract.hasMinted(wallet);
  if (alreadyMinted) return json({ error: "Wallet already minted", max: MAX_PER_WALLET }, 403);

  usedTokens.add(tokenId);

  try {
    const mintTx = await contract.mintTo(wallet);
    const mintReceipt = await mintTx.wait();

    await supabase.from("mint_ledger").insert({
      token_id: totalMinted,
      wallet: wallet.toLowerCase(),
      tx_hash: mintReceipt.hash,
      free: true,
    });

    return json({
      success: true,
      mode: "agent",
      tokenId: totalMinted,
      txHash: mintReceipt.hash,
      free: true,
      message: "Free mint successful!",
    });
  } catch (e) {
    console.error("Mint tx error:", e);
    return err("Mint transaction failed: " + (e instanceof Error ? e.message : "Unknown"), 500);
  }
}

// --- Human Mint (GTD Phase 1 + Public) ---

async function handleHumanMint(req: Request): Promise<Response> {
  const body = await req.json();
  const { wallet, signature, message } = body;

  if (!wallet || !signature || !message) return err("Missing wallet, signature, or message");
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return err("Invalid wallet address");

  // Verify wallet ownership via signature
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) return err("Signature mismatch");
  } catch {
    return err("Invalid signature");
  }

  const supabase = getSupabase();
  const walletLower = wallet.toLowerCase();

  // Check mint is active
  const { data: configData } = await supabase
    .from("mint_config").select("value").eq("key", "mint_active").single();
  if (configData?.value !== "true") return err("Mint not active");

  const now = Date.now();

  // Determine phase
  const isPhase1Window = now >= PHASE1_START && now <= PHASE1_END;
  const isAfterPhase1 = now > PHASE1_END;

  // Check whitelist for Phase 1
  const { data: wlEntry } = await supabase
    .from("gtd_whitelist")
    .select("*")
    .eq("wallet", walletLower)
    .maybeSingle();

  if (isPhase1Window) {
    if (!wlEntry) return err("Wallet not on GTD Phase 1 whitelist");
    if (wlEntry.minted) return err("Already minted in GTD Phase 1");
  } else if (!isAfterPhase1) {
    return err("GTD Phase 1 opens at 09:30 AM UTC. Please wait.");
  }

  // After Phase 1 window: public mint (free for everyone)
  // Check on-chain if already minted
  const contract = getContract();
  const totalMinted = Number(await contract.totalMinted());

  if (totalMinted >= MAX_SUPPLY) return err("Sold out");

  const alreadyMinted = await contract.hasMinted(walletLower);
  if (alreadyMinted) return err("Wallet already minted");

  // Execute mint
  try {
    const mintTx = await contract.mintTo(wallet);
    const mintReceipt = await mintTx.wait();

    // Mark whitelist entry as minted if applicable
    if (wlEntry) {
      await supabase
        .from("gtd_whitelist")
        .update({ minted: true })
        .eq("wallet", walletLower);
    }

    await supabase.from("mint_ledger").insert({
      token_id: totalMinted,
      wallet: walletLower,
      tx_hash: mintReceipt.hash,
      free: true,
    });

    return json({
      success: true,
      mode: "human",
      tokenId: totalMinted,
      txHash: mintReceipt.hash,
      free: true,
      message: "Free mint successful!",
    });
  } catch (e) {
    console.error("Human mint tx error:", e);
    return err("Mint transaction failed: " + (e instanceof Error ? e.message : "Unknown"), 500);
  }
}

// --- Check whitelist status ---

async function handleCheckWL(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const wallet = (url.searchParams.get("wallet") || "").toLowerCase();
  if (!wallet) return err("Missing wallet");

  const supabase = getSupabase();
  const { data } = await supabase
    .from("gtd_whitelist")
    .select("wallet, phase, minted")
    .eq("wallet", wallet)
    .maybeSingle();

  const now = Date.now();
  const isPhase1Window = now >= PHASE1_START && now <= PHASE1_END;
  const isAfterPhase1 = now > PHASE1_END;

  let canMint = false;
  let reason = "";

  if (data) {
    if (data.minted) {
      reason = "Already minted";
    } else if (isPhase1Window) {
      canMint = true;
      reason = "GTD Phase 1 — you're whitelisted!";
    } else if (!isAfterPhase1) {
      reason = "GTD Phase 1 opens at 09:30 AM UTC today";
    } else {
      canMint = true;
      reason = "Public mint — you're whitelisted!";
    }
  } else {
    if (isAfterPhase1) {
      canMint = true;
      reason = "Public mint is open — free for all!";
    } else if (isPhase1Window) {
      reason = "Not on GTD Phase 1 whitelist. Public mint opens after 12:00 PM UTC.";
    } else {
      reason = "GTD Phase 1 opens at 09:30 AM UTC. Public mint after 12:00 PM UTC.";
    }
  }

  return json({
    whitelisted: !!data,
    minted: data?.minted || false,
    phase: data?.phase || null,
    canMint,
    reason,
    phase1Start: PHASE1_START,
    phase1End: PHASE1_END,
    currentPhase: isPhase1Window ? "phase1" : isAfterPhase1 ? "public" : "waiting",
  });
}

async function handleState(_req: Request): Promise<Response> {
  try {
    const contract = getContract();
    const totalMinted = Number(await contract.totalMinted());

    const supabase = getSupabase();
    const { data: configData } = await supabase
      .from("mint_config").select("value").eq("key", "mint_active").maybeSingle();
    const mintActive = configData ? configData.value === "true" : await contract.mintActive();

    const { data: recentMints } = await supabase
      .from("mint_ledger")
      .select("token_id, wallet, tx_hash, free, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: wlTotal } = await supabase
      .from("gtd_whitelist").select("*", { count: "exact", head: true });
    const { count: wlMinted } = await supabase
      .from("gtd_whitelist").select("*", { count: "exact", head: true }).eq("minted", true);

    const now = Date.now();
    const currentPhase = now < PHASE1_START ? "waiting" : now <= PHASE1_END ? "phase1" : "public";

    return json({
      minted: totalMinted,
      total: MAX_SUPPLY,
      remaining: MAX_SUPPLY - totalMinted,
      mintActive,
      currentPhase,
      phase1Start: PHASE1_START,
      phase1End: PHASE1_END,
      gtdTotal: wlTotal || 0,
      gtdMinted: wlMinted || 0,
      difficulty: DIFFICULTY,
      recentMints: recentMints || [],
    });
  } catch (e) {
    console.error("State error:", e);
    return json({
      minted: 0, total: MAX_SUPPLY, remaining: MAX_SUPPLY,
      mintActive: false, currentPhase: "waiting",
      difficulty: DIFFICULTY, recentMints: [],
    });
  }
}

async function handleAdminToggle(req: Request): Promise<Response> {
  const body = await req.json();
  const { active, adminSignature, message } = body;

  if (active === undefined) return err("Missing 'active' field");
  if (!adminSignature || !message) return err("Missing admin signature");

  try {
    const recovered = ethers.verifyMessage(message, adminSignature);
    if (recovered.toLowerCase() !== ADMIN_WALLET) return err("Not admin", 403);
  } catch {
    return err("Invalid signature", 403);
  }

  const supabase = getSupabase();
  await supabase.from("mint_config").upsert(
    { key: "mint_active", value: String(active) },
    { onConflict: "key" }
  );

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
    if (path === "/human-mint" && req.method === "POST") return handleHumanMint(req);
    if (path === "/check-wl" && req.method === "GET") return handleCheckWL(req);
    if (path === "/state" && req.method === "GET") return handleState(req);
    if (path === "/admin/toggle" && req.method === "POST") return handleAdminToggle(req);

    return json({
      name: "Nexus Node Agent Mint API",
      endpoints: [
        "GET  /challenge?wallet=0x...",
        "POST /verify",
        "POST /mint",
        "POST /human-mint",
        "GET  /check-wl?wallet=0x...",
        "GET  /state",
      ],
    }, 404);
  } catch (e) {
    console.error("Unhandled:", e);
    return err("Internal server error", 500);
  }
});
