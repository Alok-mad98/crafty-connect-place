import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { entries } = body;

    // entries: Array<{ wallet: string, wagered: number, won: number, roundId: number }>
    if (!Array.isArray(entries) || entries.length === 0) {
      return json({ error: "entries array required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = [];

    for (const entry of entries) {
      const { wallet, wagered, won, roundId } = entry;
      if (!wallet || wagered == null || won == null) continue;

      const walletLower = wallet.toLowerCase();
      const pnl = won - wagered;

      // Check if exists
      const { data: existing } = await supabase
        .from("game_pnl")
        .select("id, total_wagered, total_won, pnl, rounds_played")
        .eq("wallet", walletLower)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("game_pnl")
          .update({
            total_wagered: Number(existing.total_wagered) + wagered,
            total_won: Number(existing.total_won) + won,
            pnl: Number(existing.pnl) + pnl,
            rounds_played: existing.rounds_played + 1,
            last_round_id: roundId || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          console.error("Update error for", walletLower, error);
        } else {
          results.push({ wallet: walletLower, action: "updated" });
        }
      } else {
        const { error } = await supabase
          .from("game_pnl")
          .insert({
            wallet: walletLower,
            total_wagered: wagered,
            total_won: won,
            pnl,
            rounds_played: 1,
            last_round_id: roundId || null,
          });

        if (error) {
          console.error("Insert error for", walletLower, error);
        } else {
          results.push({ wallet: walletLower, action: "inserted" });
        }
      }
    }

    return json({ success: true, processed: results.length });
  } catch (err) {
    console.error("update-pnl error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
