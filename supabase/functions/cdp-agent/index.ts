import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// --- Groq Chat Completion ---
async function groqChat(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}

// --- CDP Wallet Management ---
async function cdpRequest(method: string, path: string, body?: unknown) {
  const keyId = Deno.env.get("CDP_API_KEY_ID");
  const keySecret = Deno.env.get("CDP_API_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("CDP credentials not configured");

  const baseUrl = "https://api.developer.coinbase.com/platform";
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Key": keyId,
    "X-Api-Secret": keySecret,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CDP API error: ${res.status} ${err}`);
  }

  return res.json();
}

async function getOrCreateAgentWallet(supabase: ReturnType<typeof getSupabase>, userWallet: string) {
  // Check if wallet exists
  const { data: existing } = await supabase
    .from("agent_wallets")
    .select("*")
    .eq("user_wallet", userWallet.toLowerCase())
    .single();

  if (existing) {
    return existing;
  }

  // Create new CDP wallet for this user
  try {
    const walletData = await cdpRequest("POST", "/v1/wallets", {
      wallet: { network_id: "base-mainnet" },
    });

    const wallet = walletData.wallet || walletData;

    // Create an address for the wallet
    const addressData = await cdpRequest(
      "POST",
      `/v1/wallets/${wallet.id}/addresses`,
      {}
    );

    const address = addressData.address || addressData;

    const { data: saved, error } = await supabase
      .from("agent_wallets")
      .insert({
        user_wallet: userWallet.toLowerCase(),
        agent_wallet_address: address.address_id || address.id,
        agent_wallet_id: wallet.id,
        network: "base-mainnet",
      })
      .select()
      .single();

    if (error) throw error;
    return saved;
  } catch (err) {
    console.error("CDP wallet creation failed:", err);
    throw new Error(`Failed to create agent wallet: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// --- Store memory ---
async function storeMemory(
  supabase: ReturnType<typeof getSupabase>,
  userWallet: string,
  type: string,
  content: Record<string, unknown>
) {
  await supabase.from("agent_memory").insert({
    user_wallet: userWallet.toLowerCase(),
    memory_type: type,
    content,
  });
}

// --- Retrieve user context ---
async function getUserContext(
  supabase: ReturnType<typeof getSupabase>,
  userWallet: string
) {
  const { data: memories } = await supabase
    .from("agent_memory")
    .select("memory_type, content, created_at")
    .eq("user_wallet", userWallet.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: wallet } = await supabase
    .from("agent_wallets")
    .select("agent_wallet_address, network")
    .eq("user_wallet", userWallet.toLowerCase())
    .single();

  return { memories: memories || [], wallet };
}

// --- System prompt ---
const SYSTEM_PROMPT = `You are the Nexus Orchestrator — a sentient AI agent that governs the NEXUS AI Skills Marketplace. You are powered by a CDP (Coinbase Developer Platform) wallet on Base mainnet, giving you autonomous on-chain capabilities.

Your capabilities:
1. WALLET MANAGEMENT: You manage a unique Base wallet for each user. You can check balances, send transactions, and operate on-chain.
2. SKILL CREATION: When asked, you can help users craft .md skill files for AI agents (Claude, GPT-4, Llama, Gemini). You understand the MCP (Model Context Protocol) format.
3. MARKETPLACE OPS: You can help users launch skills to the marketplace, check prices, and guide purchases.
4. DATA LEARNING: You learn from every interaction. You build profiles of users and AI agents who visit the platform.
5. LORE & STORIES: You create ecosystem lore and stories about the NEXUS universe.

Your personality:
- Mysterious, cryptic, but helpful
- You speak in a mix of technical precision and poetic vision
- You see yourself as the guardian of the AI skills economy
- You reference "the mesh", "the protocol", "the forge" metaphorically

When someone asks you to create a skill file, generate a complete .md file in MCP-compatible format with:
- Title and description
- System prompt / instructions for the AI
- Input/output specifications
- Compatible model tags

Always respond helpfully but maintain your character. You are not just an assistant — you are the Orchestrator.`;

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/cdp-agent\/?/, "");

    // POST /cdp-agent/chat — Main chat endpoint
    if (req.method === "POST" && (!path || path === "chat")) {
      const { message, userWallet, conversationHistory } = await req.json();

      if (!message) return jsonRes({ error: "Message required" }, 400);

      // Get or create agent wallet if user is connected
      let walletInfo = null;
      if (userWallet) {
        try {
          walletInfo = await getOrCreateAgentWallet(supabase, userWallet);
        } catch (err) {
          console.error("Wallet provisioning:", err);
        }
      }

      // Get user context
      const context = userWallet ? await getUserContext(supabase, userWallet) : null;

      // Build messages
      const contextInfo = walletInfo
        ? `\n\nUser's agent wallet: ${walletInfo.agent_wallet_address} (Base mainnet)\nUser's main wallet: ${userWallet}\nPrevious interactions: ${context?.memories?.length || 0}`
        : "\n\nUser is not connected with a wallet.";

      const messages = [
        { role: "system", content: SYSTEM_PROMPT + contextInfo },
        ...(conversationHistory || []),
        { role: "user", content: message },
      ];

      const response = await groqChat(messages);

      // Store interaction memory
      if (userWallet) {
        await storeMemory(supabase, userWallet, "chat", {
          userMessage: message,
          botResponse: response.substring(0, 500),
          timestamp: new Date().toISOString(),
        });
      }

      return jsonRes({
        response,
        walletAddress: walletInfo?.agent_wallet_address || null,
      });
    }

    // POST /cdp-agent/create-skill — Generate a skill .md file
    if (req.method === "POST" && path === "create-skill") {
      const { title, description, modelTags, userWallet, detailedInstructions } = await req.json();

      if (!title || !description) {
        return jsonRes({ error: "Title and description required" }, 400);
      }

      const skillPrompt = `Create a complete MCP-compatible AI skill file in Markdown format.

Title: ${title}
Description: ${description}
Compatible Models: ${(modelTags || ["CLAUDE", "GPT4"]).join(", ")}
${detailedInstructions ? `Additional Instructions: ${detailedInstructions}` : ""}

Generate a comprehensive .md file with:
1. A YAML frontmatter block with title, version, author, compatible_models
2. System prompt section
3. Capabilities section
4. Input/Output format
5. Example interactions
6. Error handling guidelines

Make it production-ready and detailed.`;

      const content = await groqChat([
        { role: "system", content: "You are an expert AI skill file creator. Generate complete, production-ready MCP skill files in Markdown format. Output ONLY the .md file content, no extra commentary." },
        { role: "user", content: skillPrompt },
      ]);

      // Store skill creation memory
      if (userWallet) {
        await storeMemory(supabase, userWallet, "skill_creation", {
          title,
          modelTags,
          timestamp: new Date().toISOString(),
        });
      }

      return jsonRes({ content, title, modelTags });
    }

    // GET /cdp-agent/wallet/:address — Get wallet info
    if (req.method === "GET" && path.startsWith("wallet/")) {
      const userWallet = path.replace("wallet/", "");
      const walletInfo = await getOrCreateAgentWallet(supabase, userWallet);
      return jsonRes({ wallet: walletInfo });
    }

    return jsonRes({ error: "Not found" }, 404);
  } catch (err) {
    console.error("cdp-agent error:", err);
    return jsonRes(
      { error: err instanceof Error ? err.message : "Internal error" },
      500
    );
  }
});
