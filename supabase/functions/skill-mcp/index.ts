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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/skill-mcp\/?/, "");
  const skillId = path || url.searchParams.get("id");

  if (!skillId) {
    return jsonRes({ error: "Skill ID required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: skill, error } = await supabase
      .from("skills")
      .select("*")
      .eq("id", skillId)
      .single();

    if (error || !skill) return jsonRes({ error: "Skill not found" }, 404);

    const gateway = "ipfs.filebase.io";
    const fileUrl = `https://${gateway}/ipfs/${skill.ipfs_cid}`;

    // Fetch the actual .md content from IPFS
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return jsonRes({ error: "Failed to fetch skill file from IPFS" }, 502);
    }
    const content = await fileRes.text();

    // Return MCP-compatible skill payload
    return jsonRes({
      schema: "mcp-skill/v1",
      skill: {
        id: skill.id,
        title: skill.title,
        description: skill.description,
        modelTags: skill.model_tags,
        creator: skill.creator_wallet,
        price: String(skill.price),
        onchainId: skill.onchain_id,
      },
      content,
      fileUrl,
      instructions: `To use this skill, feed the content above to your AI agent as a system prompt or MCP tool definition. Compatible models: ${(skill.model_tags || []).join(", ")}.`,
    });
  } catch (err) {
    console.error("skill-mcp error:", err);
    return jsonRes({ error: "Internal error" }, 500);
  }
});
