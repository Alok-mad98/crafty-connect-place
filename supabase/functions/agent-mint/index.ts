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

// 108 GTD Phase 1 wallets (all lowercase, deduplicated)
const GTD_WALLETS = new Set([
  "0x00bfb3963b8a5e37cc768165834f2d9936fa14cf",
  "0x00eb396c3cdfcaa8cdb7b3f805bb502de3b362d8",
  "0x01da3c30afb696c5370fb30ebd98bf3532a1a609",
  "0x02d218b05c08446c5cd3d5f7df1676f1bc3acdef",
  "0x0640390cfd85a14c6b84d3021b07a39902a4f65f",
  "0x0ba602decb481c97f12a3afc4d927eef71a6a3fd",
  "0x0e3078ba17883e0cb5f8acc4e5ffc4dc9e5f6284",
  "0x0ea84bf7a808fa07aecc3fcb0e3503befa927ee1",
  "0x139788e7bab356e18fbe776c522fd89542c1f835",
  "0x1c147c57fc3c21d26b33bf4047970ecbc74ee12d",
  "0x1ca348b002dc9917904c7f0bd2998efec0efb0e7",
  "0x210f380c2ea08f9ede471b6d8fc6d37ae7eafc58",
  "0x22f41cd897811636fbddf9e902abbfa4910f10d3",
  "0x230c91e349bdd705d9f82155eaeb2adb85dd788a",
  "0x26361f993316ea21ceb6e5fc0e48116f24b8ccd6",
  "0x2c70c5d2e05cc586484d30debaf87ac6838c8f9c",
  "0x30079ddfc1c61ce0eb1f24957600d0a1c80dcbbd",
  "0x31ad79efdd02be27c1da9f9d11cc50e6cee1e7d6",
  "0x365757a1872cfb8bc20c44cbf523c80c28142804",
  "0x3728739a42e06ad5e8122be5de8e0bc150f9386d",
  "0x3c39abf39062e209eaa02ab2ad6be3d65823a721",
  "0x406dcb7a4606965fff4ad786e9394f36c72bc67b",
  "0x40829d2751eafd8facb97d269bd4534fa5ebc837",
  "0x43dd01897390eb47a8166903d82012345c0a3a11",
  "0x4534556c834363ca77d75383d0aeda993efe0554",
  "0x475606d141047a655aeffd2055448e4b7ac2cc58",
  "0x4ad30c455e1efd664917abc410c3e29039a559ac",
  "0x54a8988ee556fd818c7b00a890eecd7470a13741",
  "0x56b391fb7e001d739f87d9e25e8fb054c81f80f3",
  "0x586fa0393b43276a5a418a187d0c81a5aa00a783",
  "0x5972eaf974b9d1de2c75b9a9770f4a6e72b8f4bc",
  "0x5a31643c94f0e1a04c4672b0ab688e35282fe7a6",
  "0x6126134294607dbd568dda4875a393ce1192adcf",
  "0x61b918d589dfe9c01b4e7a6510468b2dd0bc88d7",
  "0x637e68edb3487807aed9066cd7070208dacfc822",
  "0x68977007e73d20b2d1686ee16e74a81a5080a4dc",
  "0x69f9c008070a0a9158efd856e53af562dd0a2858",
  "0x6c5865b3ee4fe144a66b90291dea285b8b077e1b",
  "0x6dd8b50c786d820281637b5a58f51d4d76804f82",
  "0x72a2adfccb81873d31033316d1545f4d00c7830d",
  "0x7af1329ff8b1316ef87963150456ec011e260166",
  "0x7b346d19f6b06191812a351d2d3e1cd57ab182c5",
  "0x8651e49e19ca9d7bb955c89afdc71a8b6a31c419",
  "0x873c687cd1bdeb306e57d6633e1618596bf5b38d",
  "0x87d20ea99c2a75ba65bc3e2974b263ed162d248e",
  "0x89ba360b61703372a97de5aa7a3dd728ebcc38e7",
  "0x8a89098e08c6898c2283a88f740023b6c85ca800",
  "0x8e88750385b4a7db74d9d4d0c54843da74ed2c35",
  "0x905f046f86cb55703d0436a9c6f00da91d20982f",
  "0x932511c46f9df082b1e58543e7d8da29ee8fe987",
  "0x93ddf33b27114f170c825aad635363719342581c",
  "0x9700c0228a088825692e37d3b5065c4d2139b96b",
  "0x98e9216bafef41fcbf0271f0295b0618d23f945f",
  "0x995737ba36f81560bb2a838f1aad0a6e40bab0fc",
  "0x9a169032c1c255db498676a0b1675a197c76863f",
  "0x9b752e0743c3a7c34d9e53af0456c1f33b1318e2",
  "0x9b87601908d9c7eead439d84433ffbd149631d6b",
  "0x9cc702a1ea10aaa5ea1b681fcb1ec02bbfa42d5f",
  "0x9f64ef936058aef679c66a0d2b2adda189393b5e",
  "0xa3b2d80254a645ff564c27c047b097cc6e7255b4",
  "0xa4aa3514557ffd679dc505ff67890436b3978c19",
  "0xac4a437d149b91106042a641c5a1799fb0440340",
  "0xada06337f64115e2d2667013f3ae7c8048bf5dee",
  "0xafc1150a705fa7253984bbae45a1a7d321d226a6",
  "0xb05263977d7ced74cf7e21f01cf4e3058b7f7ae8",
  "0xb0a8f529f76d99b7de1e00d0b50444842fdfa957",
  "0xb1d8388792e692eb86138ef35e87d6160d0c54ac",
  "0xb400026cb5321b57e3aec8406d4f2e5fcdc5a580",
  "0xb5f1007e691b5c2c77fd8b6508e50ef3b54cfecc",
  "0xb60441afebd73cc637ece2a39160fac7564d5a23",
  "0xb691120339b4f17bbdfa591e5f9f6278c8a15f46",
  "0xb6a963126ee1f1cea46634447bf9d288ee3f8233",
  "0xb765d4cc09e38ab706e57872353e5bb4661c1ff6",
  "0xb893ae8a1824604f6df4dfde52e2754921ba1a73",
  "0xb8ad47a1b41b85d1034200d3a51e6efe0cdde1af",
  "0xbbf55be9c800747a26b8ca125f9e17966c1a76c9",
  "0xbc3b332f37ba5ceb1da3fc2090ebee29546b6151",
  "0xc3adfcb3dbe355440acfb10cc1561fa9f65c2bf3",
  "0xc44d533f12a6a39a408931b9b9a70fe423021cfc",
  "0xc5f8ba34611fc3ec7acd541d6604208617d45a73",
  "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3",
  "0xc83a34f50a663d4b918595469f42a104bb27b68e",
  "0xcd80a41186fc47cafd61d83fb16099fc7fd196a8",
  "0xce39ef47c6ffac45101ee169d9140c14842e4cf8",
  "0xd0b967f8ab2dc9b177f05b83ae71f08cf0a40cdd",
  "0xd55e10770526a5a80d77c8dfc2ed926a3b69b3ae",
  "0xd91babefdb88393cdfdde2b45df67c985bf3c82c",
  "0xd9ddad13abe7f3bf8cb1a74fdf8d39bebf90a605",
  "0xdaf6123b3484de1647f34596d8e9e130ab85f74f",
  "0xdd074879ac6d3b5b8a7d739f704ba855fc32012f",
  "0xdf7ca7dfbe4805e9f5a4043c49f5213fb17ca5ab",
  "0xdf9a30b99357ff53b11c7e227ea8a7e9f708d5df",
  "0xe05f1e03f41dd2fdb05a24746da46ffc7ff1432b",
  "0xe2625b2a9713bf4a033aedabc2a7ff1eb6087fe8",
  "0xe27b7f1b21cd34ef5be8a4abcaaa79411ea82e82",
  "0xe2e277ac9fa76e7abc72fbf7127f8417f5420139",
  "0xe5077a5d9f8f4eb7eed317abcf4b79a91d1dba7b",
  "0xe6941942f3f0939b0e06787dc18e02f702677010",
  "0xe71b75e67184aa9b6179d7d4871ff9fc8095daea",
  "0xf03b9ba1e772e1e25f7bb2e7b3e714acb8418cd6",
  "0xf18deee09e644ca0a875a9476eec8a02919b27aa",
  "0xf2439241881964006369c0e2377d45f3740f48a0",
  "0xf3a9008f4219b5f9b73844d00d6649c4705e9a67",
  "0xf66e967e152beb0ea3c2853a7482022d78c845da",
  "0xf7e81a65e09474b5798faddbd932f26aa8bd4168",
  "0xf980bb10341b80b11e5f774a8e2495f38783b75a",
  "0xfc983fe08a887eabff39ddac3a55408b1e97fa10",
  "0xfe8fdc07f98992fa3760cd5f001b80e85af404b8",
  "0xa011b705efac1fa71304474cd5066fa8db5e27b5",
]);

const NFT_ABI = [
  "function mintTo(address to) external",
  "function toggleMint(bool _active) external",
  "function totalMinted() external view returns (uint256)",
  "function mintActive() external view returns (bool)",
  "function hasMinted(address) external view returns (bool)",
  "function mintPrice() external view returns (uint256)",
];

const DATA_MINING_ADDRESS = "0xe0fB97698dD52ED24eEAA3445f9239229822e02e";
const DATA_MINING_ABI = [
  "function settleRound() external",
  "function getGameState() external view returns (uint256 roundId, uint256 startTime, uint256 timeRemaining, bool active, uint256 vault, uint256 rewards)",
  "function claimRound(uint256 roundId) external",
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
  const isAdminWallet = walletLower === ADMIN_WALLET;

  // Check mint is active (admin bypasses)
  const { data: configData } = await supabase
    .from("mint_config").select("value").eq("key", "mint_active").single();
  if (configData?.value !== "true" && !isAdminWallet) return err("Mint not active");

  const now = Date.now();

  // Determine phase
  const isPhase1Window = now >= PHASE1_START && now <= PHASE1_END;
  const isAfterPhase1 = now > PHASE1_END;

  // Check whitelist for Phase 1 (admin bypasses phase checks)
  const { data: wlEntry } = await supabase
    .from("gtd_whitelist")
    .select("*")
    .eq("wallet", walletLower)
    .maybeSingle();

  if (!isAdminWallet) {
    const isOnGtdList = GTD_WALLETS.has(walletLower) || !!wlEntry;
    if (isPhase1Window) {
      if (!isOnGtdList) return err("Wallet not on GTD Phase 1 whitelist");
      if (wlEntry?.minted) return err("Already minted in GTD Phase 1");
    } else if (!isAfterPhase1) {
      return err("GTD Phase 1 opens at 09:30 AM UTC. Please wait.");
    }
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

  const isOnGtdList = GTD_WALLETS.has(wallet) || !!data;

  if (isOnGtdList) {
    if (data?.minted) {
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
    whitelisted: isOnGtdList,
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

  // Toggle on-chain mintActive
  try {
    const contract = getContract();
    const tx = await contract.toggleMint(active);
    await tx.wait();
  } catch (e) {
    console.error("On-chain toggle error:", e);
    return err("Failed to toggle mint on-chain: " + (e instanceof Error ? e.message : "Unknown"), 500);
  }

  // Update DB
  const supabase = getSupabase();
  await supabase.from("mint_config").upsert(
    { key: "mint_active", value: String(active) },
    { onConflict: "key" }
  );

  return json({ success: true, mintActive: active });
}

// --- Auto-Settle (server-side, no user signature needed) ---

async function handleSettle(): Promise<Response> {
  try {
    const pk = Deno.env.get("DEPLOYER_PRIVATE_KEY");
    if (!pk) return err("Server not configured for settlement", 500);

    const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
    const wallet = new ethers.Wallet(pk, provider);
    const mining = new ethers.Contract(DATA_MINING_ADDRESS, DATA_MINING_ABI, wallet);

    // Check game state
    const gs = await mining.getGameState();
    const timeRemaining = Number(gs[2]);
    const active = gs[3];

    if (!active) return json({ settled: false, reason: "Game not active" });
    if (timeRemaining > 0) return json({ settled: false, reason: "Round not over yet", timeRemaining });

    // Settle the round
    const tx = await mining.settleRound();
    const receipt = await tx.wait();

    return json({
      settled: true,
      txHash: receipt.hash,
      roundId: Number(gs[0]),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("Already settled")) return json({ settled: false, reason: "Already settled" });
    console.error("Settle error:", msg);
    return err("Settlement failed: " + msg.slice(0, 100), 500);
  }
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
    if (path === "/settle" && req.method === "POST") return handleSettle();

    return json({
      name: "Nexus Node Agent Mint API",
      endpoints: [
        "GET  /challenge?wallet=0x...",
        "POST /verify",
        "POST /mint",
        "POST /human-mint",
        "GET  /check-wl?wallet=0x...",
        "GET  /state",
        "POST /settle",
      ],
    }, 404);
  } catch (e) {
    console.error("Unhandled:", e);
    return err("Internal server error", 500);
  }
});
