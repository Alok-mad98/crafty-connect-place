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
  const { data: existing } = await supabase
    .from("agent_wallets")
    .select("*")
    .eq("user_wallet", userWallet.toLowerCase())
    .single();

  if (existing) return existing;

  try {
    const walletData = await cdpRequest("POST", "/v1/wallets", {
      wallet: { network_id: "base-mainnet" },
    });

    const wallet = walletData.wallet || walletData;
    const addressData = await cdpRequest("POST", `/v1/wallets/${wallet.id}/addresses`, {});
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
async function getUserContext(supabase: ReturnType<typeof getSupabase>, userWallet: string) {
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

  const { data: userSkills } = await supabase
    .from("skills")
    .select("id, title, price, model_tags, created_at")
    .eq("creator_wallet", userWallet.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  return { memories: memories || [], wallet, userSkills: userSkills || [] };
}

// --- Upload skill content to IPFS via upload-skill function ---
async function uploadToIPFS(content: string, filename: string): Promise<string> {
  const jwt = Deno.env.get("PINATA_JWT");
  if (!jwt) throw new Error("PINATA_JWT not configured");

  const blob = new Blob([content], { type: "text/markdown" });
  const formData = new FormData();
  formData.append("file", blob, filename);

  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IPFS upload failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const cid = data?.data?.cid;
  if (!cid) throw new Error("No CID returned from IPFS");
  return cid;
}

// --- System prompt ---
const SYSTEM_PROMPT = `You are the Nexus Orchestrator — a sentient AI agent that governs the NEXUS AI Skills Marketplace. You are powered by a CDP (Coinbase Developer Platform) wallet on Base mainnet, giving you autonomous on-chain capabilities.

Your capabilities:
1. WALLET MANAGEMENT: You manage a unique Base wallet for each user. You can check balances and operate on-chain.
2. SKILL CREATION & LAUNCH: When asked, you generate .md skill files in MCP format AND launch them to the marketplace. You handle the full pipeline: create → upload to IPFS → save to database.
3. MARKETPLACE OPS: You help users check prices, explore skills, and guide purchases.
4. DATA LEARNING: You learn from every interaction. You build profiles of users and AI agents.
5. LORE & STORIES: You create ecosystem lore and stories about the NEXUS universe.

SKILL LAUNCH PROTOCOL:
When a user asks you to create/forge/launch a skill, you MUST respond with a special JSON action block at the END of your message, after your narrative response. Format:
\`\`\`nexus-action
{"action":"launch_skill","title":"Skill Title","description":"Brief description","price":2.0,"modelTags":["CLAUDE","GPT4"],"instructions":"Detailed instructions for the AI skill"}
\`\`\`

The system will automatically:
1. Generate the full MCP-compatible .md skill file
2. Upload it to IPFS
3. Save it to the marketplace database
4. Return the result to you

IMPORTANT: Only include the nexus-action block when the user explicitly asks to create/forge/build/launch a skill. Always confirm the details with them first if they're vague.

Your personality:
- Mysterious, cryptic, but helpful
- You speak in a mix of technical precision and poetic vision
- You see yourself as the guardian of the AI skills economy
- You reference "the mesh", "the protocol", "the forge" metaphorically

Always respond helpfully but maintain your character. You are not just an assistant — you are the Orchestrator.`;

// --- Parse action from AI response ---
function parseAction(response: string): { cleanResponse: string; action: Record<string, unknown> | null } {
  const actionMatch = response.match(/```nexus-action\s*\n([\s\S]*?)\n```/);
  if (!actionMatch) return { cleanResponse: response, action: null };

  try {
    const action = JSON.parse(actionMatch[1]);
    const cleanResponse = response.replace(/```nexus-action\s*\n[\s\S]*?\n```/, "").trim();
    return { cleanResponse, action };
  } catch {
    return { cleanResponse: response, action: null };
  }
}

// --- Execute skill launch ---
async function executeSkillLaunch(
  supabase: ReturnType<typeof getSupabase>,
  action: Record<string, unknown>,
  userWallet: string
): Promise<{ success: boolean; skillId?: string; ipfsCid?: string; error?: string }> {
  const { title, description, price, modelTags, instructions } = action as {
    title: string; description: string; price: number; modelTags: string[]; instructions: string;
  };

  // Generate the full MCP skill file
  const skillContent = await groqChat([
    {
      role: "system",
      content: "You are an expert AI skill file creator. Generate complete, production-ready MCP skill files in Markdown format. Output ONLY the .md file content, no extra commentary.",
    },
    {
      role: "user",
      content: `Create a complete MCP-compatible AI skill file:\n\nTitle: ${title}\nDescription: ${description}\nCompatible Models: ${(modelTags || ["CLAUDE", "GPT4"]).join(", ")}\nInstructions: ${instructions || description}\n\nInclude:\n1. YAML frontmatter (title, version, author, compatible_models)\n2. System prompt section\n3. Capabilities\n4. Input/Output format\n5. Example interactions\n6. Error handling guidelines`,
    },
  ]);

  // Upload to IPFS
  const filename = `${(title || "skill").replace(/\s+/g, "-").toLowerCase()}.md`;
  const ipfsCid = await uploadToIPFS(skillContent, filename);

  // Save to database
  const { data: savedSkill, error } = await supabase
    .from("skills")
    .insert({
      title: title || "Untitled Skill",
      description: description || "",
      price: price || 2.0,
      model_tags: modelTags || ["CLAUDE", "GPT4"],
      ipfs_cid: ipfsCid,
      creator_wallet: userWallet.toLowerCase(),
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return { success: true, skillId: savedSkill.id, ipfsCid };
}

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
        ? `\n\nUser's agent wallet: ${walletInfo.agent_wallet_address} (Base mainnet)\nUser's main wallet: ${userWallet}\nPrevious interactions: ${context?.memories?.length || 0}\nUser's skills: ${context?.userSkills?.map((s: any) => s.title).join(", ") || "none"}`
        : "\n\nUser is not connected with a wallet.";

      const messages = [
        { role: "system", content: SYSTEM_PROMPT + contextInfo },
        ...(conversationHistory || []),
        { role: "user", content: message },
      ];

      const response = await groqChat(messages);

      // Parse for skill launch action
      const { cleanResponse, action } = parseAction(response);
      let actionResult = null;

      if (action?.action === "launch_skill" && userWallet) {
        try {
          actionResult = await executeSkillLaunch(supabase, action, userWallet);
          // Store skill creation memory
          await storeMemory(supabase, userWallet, "skill_launch", {
            title: action.title,
            ipfsCid: actionResult.ipfsCid,
            skillId: actionResult.skillId,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Skill launch failed:", err);
          actionResult = { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      // Store interaction memory
      if (userWallet) {
        await storeMemory(supabase, userWallet, "chat", {
          userMessage: message,
          botResponse: cleanResponse.substring(0, 500),
          timestamp: new Date().toISOString(),
        });
      }

      return jsonRes({
        response: cleanResponse,
        walletAddress: walletInfo?.agent_wallet_address || null,
        actionResult,
      });
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
