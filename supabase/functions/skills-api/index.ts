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
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/skills-api\/?/, "");
  const supabase = getSupabase();

  try {
    // GET /skills-api — list all active skills
    if (req.method === "GET" && (!path || path === "list")) {
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const skills = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: String(s.price),
        modelTags: s.model_tags || [],
        ipfsCid: s.ipfs_cid,
        onchainId: s.onchain_id,
        creator: { walletAddress: s.creator_wallet },
      }));

      return jsonRes({ skills });
    }

    // GET /skills-api/skill/:id — single skill detail (for AI agents)
    if (req.method === "GET" && path.startsWith("skill/")) {
      const skillId = path.replace("skill/", "");
      const { data, error } = await supabase
        .from("skills")
        .select("*")
        .eq("id", skillId)
        .single();

      if (error || !data) return jsonRes({ error: "Skill not found" }, 404);

      const gateway = "ipfs.filebase.io";

      return jsonRes({
        id: data.id,
        title: data.title,
        description: data.description,
        price: String(data.price),
        modelTags: data.model_tags,
        ipfsCid: data.ipfs_cid,
        onchainId: data.onchain_id,
        creator: data.creator_wallet,
        fileUrl: `https://${gateway}/ipfs/${data.ipfs_cid}`,
        mcpEndpoint: `${url.origin}/functions/v1/skill-mcp/${data.id}`,
        createdAt: data.created_at,
      });
    }

    // POST /skills-api — create a new skill
    if (req.method === "POST" && (!path || path === "create")) {
      const body = await req.json();
      const { title, description, price, modelTags, ipfsCid, onchainId, creatorWallet, txHash } = body;

      if (!title || !description || !ipfsCid || !creatorWallet) {
        return jsonRes({ error: "Missing required fields" }, 400);
      }

      const { data, error } = await supabase
        .from("skills")
        .insert({
          title,
          description,
          price: parseFloat(price),
          model_tags: modelTags || [],
          ipfs_cid: ipfsCid,
          onchain_id: onchainId,
          creator_wallet: creatorWallet,
          tx_hash: txHash,
        })
        .select()
        .single();

      if (error) throw error;
      return jsonRes({ skill: data }, 201);
    }

    // POST /skills-api/purchase — record a purchase
    if (req.method === "POST" && path === "purchase") {
      const body = await req.json();
      const { skillId, buyerWallet, txHash } = body;

      if (!skillId || !buyerWallet) {
        return jsonRes({ error: "Missing skillId or buyerWallet" }, 400);
      }

      const { data, error } = await supabase
        .from("purchases")
        .insert({
          skill_id: skillId,
          buyer_wallet: buyerWallet,
          tx_hash: txHash,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") return jsonRes({ error: "Already purchased" }, 409);
        throw error;
      }
      return jsonRes({ purchase: data }, 201);
    }

    // GET /skills-api/purchases/:wallet — get purchases for a wallet
    if (req.method === "GET" && path.startsWith("purchases/")) {
      const wallet = path.replace("purchases/", "");
      const { data, error } = await supabase
        .from("purchases")
        .select("skill_id")
        .eq("buyer_wallet", wallet.toLowerCase());

      if (error) throw error;
      return jsonRes({ purchasedSkillIds: (data || []).map((p: any) => p.skill_id) });
    }

    return jsonRes({ error: "Not found" }, 404);
  } catch (err) {
    console.error("skills-api error:", err);
    return jsonRes({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
