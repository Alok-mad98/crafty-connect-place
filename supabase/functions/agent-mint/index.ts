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
const MINT_PRICE_USD = 10;

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

// --- ETH price feed with 60s cache ---
let cachedEthPrice: { usd: number; timestamp: number } | null = null;

async function getEthPriceUsd(): Promise<number> {
  const now = Date.now();
  if (cachedEthPrice && now - cachedEthPrice.timestamp < 60_000) {
    return cachedEthPrice.usd;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const data = await res.json();
    const price = data?.ethereum?.usd;
    if (typeof price === "number" && price > 0) {
      cachedEthPrice = { usd: price, timestamp: now };
      return price;
    }
  } catch (e) {
    console.error("ETH price fetch error:", e);
  }
  // Fallback: use cached if available, otherwise a safe default
  if (cachedEthPrice) return cachedEthPrice.usd;
  return 2500; // conservative fallback
}

function usdToWei(usd: number, ethPriceUsd: number): bigint {
  // (usd / ethPrice) * 1e18, using BigInt for precision
  const ethAmount = usd / ethPriceUsd;
  return ethers.parseEther(ethAmount.toFixed(18));
}

// --- In-memory rate limit stores (reset on cold start) ---
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

  // Check if payment is required + fetch real-time ETH price
  let paymentRequired = false;
  let paymentAmount = "0";
  let paymentAmountUsd = 0;
  let ethPriceUsd = 0;

  try {
    const contract = getContract();
    const totalMinted = await contract.totalMinted();
    const minted = Number(totalMinted);

    if (minted >= TREASURY_SUPPLY + FREE_SUPPLY) {
      paymentRequired = true;
      paymentAmountUsd = MINT_PRICE_USD;
      ethPriceUsd = await getEthPriceUsd();
      paymentAmount = usdToWei(MINT_PRICE_USD, ethPriceUsd).toString();
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
      amountEth: paymentRequired ? (MINT_PRICE_USD / (ethPriceUsd || 2500)).toFixed(6) : "0",
      ethPriceUsd,
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

    // Dynamic price check: $10 USD at current ETH rate, with 5% slippage tolerance
    const ethPrice = await getEthPriceUsd();
    const requiredWei = usdToWei(MINT_PRICE_USD, ethPrice);
    const minAccepted = requiredWei * 95n / 100n; // 5% slippage
    if (tx.value < minAccepted) {
      return err(`Insufficient payment. Required: ~${(MINT_PRICE_USD / ethPrice).toFixed(6)} ETH ($${MINT_PRICE_USD} at ETH=$${ethPrice}). Sent: ${ethers.formatEther(tx.value)} ETH`);
    }

    // Mark tx as used
    await supabase.from("used_payment_txs").insert({ tx_hash: paymentTxHash, wallet: wallet.toLowerCase() });
  }

  // Mark token as used
  usedTokens.add(tokenId);

  // Send mintTo transaction
  try {
    const mintTx = await contract.mintTo(wallet);
    const mintReceipt = await mintTx.wait();

    // Log to mint_ledger
    await supabase.from("mint_ledger").insert({
      token_id: totalMinted,
      wallet: wallet.toLowerCase(),
      tx_hash: mintReceipt.hash,
      free: isFree,
    });

    return json({
      success: true,
      mode: "agent",
      tokenId: totalMinted,
      txHash: mintReceipt.hash,
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
    const ethPrice = await getEthPriceUsd();
    const mintPriceWei = usdToWei(MINT_PRICE_USD, ethPrice).toString();
    const mintPriceEth = (MINT_PRICE_USD / ethPrice).toFixed(6);

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
      mintPriceUsd: MINT_PRICE_USD,
      mintPriceWei,
      mintPriceEth,
      ethPriceUsd: ethPrice,
      difficulty: DIFFICULTY,
      recentMints: recentMints || [],
    });
  } catch (e) {
    console.error("State error:", e);
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
