import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_SLOTS = 288;
const MIN_SCORE = 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/game-gtd\/?/, "");
  const supabase = getSupabase();

  try {
    // GET /status — remaining GTD slots
    if (req.method === "GET" && (!path || path === "status")) {
      const { count, error } = await supabase
        .from("game_gtd")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      const used = count || 0;

      return json({ total: MAX_SLOTS, used, remaining: MAX_SLOTS - used });
    }

    // GET /check/:wallet — check if wallet already claimed
    if (req.method === "GET" && path.startsWith("check/")) {
      const wallet = path.replace("check/", "").toLowerCase();
      const { data, error } = await supabase
        .from("game_gtd")
        .select("id")
        .eq("wallet_address", wallet)
        .maybeSingle();

      if (error) throw error;
      return json({ claimed: !!data });
    }

    // POST /submit — claim a GTD spot
    if (req.method === "POST" && path === "submit") {
      const body = await req.json();
      const { twitter, wallet, score } = body;

      if (!twitter || !wallet) {
        return json({ error: "Missing twitter or wallet" }, 400);
      }
      if (typeof score !== "number" || score < MIN_SCORE) {
        return json({ error: `Score must be at least ${MIN_SCORE}` }, 400);
      }
      if (!/^@\w{1,30}$/.test(twitter)) {
        return json({ error: "Invalid twitter handle (must start with @)" }, 400);
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return json({ error: "Invalid ETH wallet address" }, 400);
      }

      const walletLower = wallet.toLowerCase();

      // Check if wallet already claimed
      const { data: existing } = await supabase
        .from("game_gtd")
        .select("id")
        .eq("wallet_address", walletLower)
        .maybeSingle();

      if (existing) {
        return json({ error: "This wallet has already claimed a GTD spot" }, 409);
      }

      // Check if slots available
      const { count } = await supabase
        .from("game_gtd")
        .select("*", { count: "exact", head: true });

      if ((count || 0) >= MAX_SLOTS) {
        return json({ error: "All GTD spots have been claimed" }, 410);
      }

      // Insert
      const { data, error } = await supabase
        .from("game_gtd")
        .insert({
          twitter_handle: twitter.trim(),
          wallet_address: walletLower,
          score,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return json({ error: "This wallet has already claimed a GTD spot" }, 409);
        }
        throw error;
      }

      const remaining = MAX_SLOTS - ((count || 0) + 1);
      return json({ success: true, id: data.id, remaining }, 201);
    }

    // GET /leaderboard — top scores
    if (req.method === "GET" && path === "leaderboard") {
      const { data, error } = await supabase
        .from("game_gtd")
        .select("twitter_handle, score, created_at")
        .order("score", { ascending: false })
        .limit(20);

      if (error) throw error;
      return json({ entries: data || [] });
    }

    // GET /export?admin=<wallet> — CSV download (admin only)
    if (req.method === "GET" && path === "export") {
      const adminWallet = url.searchParams.get("admin")?.toLowerCase();
      const ADMIN_ADDRESS = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";
      if (adminWallet !== ADMIN_ADDRESS) {
        return json({ error: "Unauthorized" }, 403);
      }

      const { data, error } = await supabase
        .from("game_gtd")
        .select("twitter_handle, wallet_address, score, created_at")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = data || [];
      const csvLines = ["Twitter Handle,Wallet Address,Score,Claimed At"];
      for (const r of rows) {
        csvLines.push(`${r.twitter_handle},${r.wallet_address},${r.score},${r.created_at}`);
      }
      const csv = csvLines.join("\n");

      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=gtd-claims.csv",
        },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("game-gtd error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
