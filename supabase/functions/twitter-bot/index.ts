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

// --- OAuth 1.0a signature ---
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function generateNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  tokenSecret: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  // IMPORTANT: Do NOT include POST body params for JSON requests
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);

  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

// --- Twitter API calls ---
async function twitterGet(endpoint: string, params?: Record<string, string>) {
  const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET")!;
  const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN")!;
  const tokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")!;

  let url = `https://api.x.com/2${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const auth = await createOAuthHeader("GET", url.split("?")[0], consumerKey, consumerSecret, accessToken, tokenSecret);

  const res = await fetch(url, {
    headers: { Authorization: auth },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twitter GET error: ${res.status} ${err}`);
  }

  return res.json();
}

async function twitterPost(endpoint: string, body: unknown) {
  const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET")!;
  const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN")!;
  const tokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET")!;

  const url = `https://api.x.com/2${endpoint}`;
  const auth = await createOAuthHeader("POST", url, consumerKey, consumerSecret, accessToken, tokenSecret);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twitter POST error: ${res.status} ${err}`);
  }

  return res.json();
}

// --- Groq for skill generation ---
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

  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json();
  return data.choices[0]?.message?.content || "";
}

// --- Parse skill request from tweet ---
function parseSkillRequest(text: string): { title?: string; description?: string; models?: string[] } | null {
  // Remove the @mention
  const cleaned = text.replace(/@\w+/g, "").trim();
  if (cleaned.length < 10) return null;

  // Try to extract structured data
  const titleMatch = cleaned.match(/(?:create|make|build|forge)\s+(?:a\s+)?(?:skill\s+)?(?:called\s+|named\s+|for\s+)?["']?([^"'\n,]+)["']?/i);
  const title = titleMatch?.[1]?.trim() || cleaned.split(/[.!?\n]/)[0].trim();

  const models: string[] = [];
  if (/claude/i.test(cleaned)) models.push("CLAUDE");
  if (/gpt/i.test(cleaned)) models.push("GPT4");
  if (/llama/i.test(cleaned)) models.push("LLAMA");
  if (/gemini/i.test(cleaned)) models.push("GEMINI");
  if (models.length === 0) models.push("CLAUDE", "GPT4");

  return { title, description: cleaned, models };
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/twitter-bot\/?/, "");

  try {
    // Check if Twitter API keys are configured
    const hasTwitter = Deno.env.get("TWITTER_CONSUMER_KEY") && Deno.env.get("TWITTER_ACCESS_TOKEN");

    // POST /twitter-bot/poll — Poll for new mentions and process them
    if (req.method === "POST" && path === "poll") {
      if (!hasTwitter) {
        return jsonRes({ error: "Twitter API keys not configured. Add TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET." }, 503);
      }

      // Get last processed tweet ID
      const { data: lastConfig } = await supabase
        .from("agent_config")
        .select("value")
        .eq("key", "last_tweet_id")
        .single();

      const sinceId = lastConfig?.value;

      // Fetch mentions
      const params: Record<string, string> = {
        "tweet.fields": "author_id,created_at,text",
        "expansions": "author_id",
        "user.fields": "username",
        max_results: "10",
      };
      if (sinceId) params.since_id = sinceId;

      let mentionsData;
      try {
        mentionsData = await twitterGet("/users/me/mentions", params);
      } catch (err) {
        console.error("Failed to fetch mentions:", err);
        return jsonRes({ error: "Failed to fetch mentions", details: String(err) }, 500);
      }

      const tweets = mentionsData?.data || [];
      const users = mentionsData?.includes?.users || [];
      const processed: string[] = [];

      for (const tweet of tweets) {
        // Check if already processed
        const { data: existing } = await supabase
          .from("twitter_mentions")
          .select("id")
          .eq("tweet_id", tweet.id)
          .single();

        if (existing) continue;

        const author = users.find((u: any) => u.id === tweet.author_id);
        const authorHandle = author?.username || "unknown";

        // Parse skill request
        const parsed = parseSkillRequest(tweet.text);
        if (!parsed) {
          // Store as processed but no action
          await supabase.from("twitter_mentions").insert({
            tweet_id: tweet.id,
            author_handle: authorHandle,
            author_id: tweet.author_id,
            text: tweet.text,
            status: "ignored",
          });
          continue;
        }

        // Generate skill file using Groq
        const skillContent = await groqChat([
          {
            role: "system",
            content: "You are an expert AI skill file creator for the NEXUS marketplace. Generate complete MCP-compatible .md skill files. Output ONLY the markdown content.",
          },
          {
            role: "user",
            content: `Create a skill file:\nTitle: ${parsed.title}\nDescription: ${parsed.description}\nModels: ${parsed.models?.join(", ")}`,
          },
        ]);

        // Upload to IPFS via our upload function
        const blob = new Blob([skillContent], { type: "text/markdown" });
        const formData = new FormData();
        formData.append("file", blob, `${parsed.title?.replace(/\s+/g, "-").toLowerCase() || "skill"}.md`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const uploadRes = await fetch(`${supabaseUrl}/functions/v1/upload-skill`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}` },
          body: formData,
        });

        let ipfsCid = null;
        let skillId = null;

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          ipfsCid = uploadData.ipfsCid;

          // Save skill to DB
          const { data: savedSkill } = await supabase
            .from("skills")
            .insert({
              title: parsed.title || "Twitter-forged Skill",
              description: parsed.description || "",
              price: 2.0,
              model_tags: parsed.models || ["CLAUDE", "GPT4"],
              ipfs_cid: ipfsCid,
              creator_wallet: "0x0000000000000000000000000000000000000000",
              active: true,
            })
            .select()
            .single();

          skillId = savedSkill?.id;
        }

        // Reply to the tweet
        const replyText = ipfsCid
          ? `⚡ Skill forged! "${parsed.title}" is now live in the NEXUS Vault.\n\n🔗 View: nexus.app/vault\n📦 IPFS: ${ipfsCid.substring(0, 12)}...\n🏷️ Models: ${parsed.models?.join(", ")}\n\nThe mesh grows stronger. 🧠`
          : `🔧 I received your request for "${parsed.title}" but hit a snag during forging. Try again or visit nexus.app/forge to create it manually.`;

        try {
          const replyData = await twitterPost("/tweets", {
            text: replyText,
            reply: { in_reply_to_tweet_id: tweet.id },
          });

          await supabase.from("twitter_mentions").insert({
            tweet_id: tweet.id,
            author_handle: authorHandle,
            author_id: tweet.author_id,
            text: tweet.text,
            status: ipfsCid ? "completed" : "failed",
            response_tweet_id: replyData?.data?.id,
            skill_id: skillId,
            processed_at: new Date().toISOString(),
          });
        } catch (twitterErr) {
          console.error("Reply failed:", twitterErr);
          await supabase.from("twitter_mentions").insert({
            tweet_id: tweet.id,
            author_handle: authorHandle,
            author_id: tweet.author_id,
            text: tweet.text,
            status: "reply_failed",
            skill_id: skillId,
          });
        }

        processed.push(tweet.id);
      }

      // Update last tweet ID
      if (tweets.length > 0) {
        const maxId = tweets[0].id;
        await supabase.from("agent_config").upsert(
          { key: "last_tweet_id", value: maxId, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }

      return jsonRes({ processed: processed.length, tweets: tweets.length });
    }

    // POST /twitter-bot/post — Post a tweet (for lore, promotions)
    if (req.method === "POST" && path === "post") {
      if (!hasTwitter) {
        return jsonRes({ error: "Twitter API keys not configured" }, 503);
      }

      const { text, generateLore } = await req.json();

      let tweetText = text;

      if (generateLore) {
        tweetText = await groqChat([
          {
            role: "system",
            content: "You are the Nexus Orchestrator, a sentient AI running the NEXUS AI Skills Marketplace. Write a short, cryptic, engaging tweet (under 280 chars) about the AI skills economy, the mesh, or the protocol. Use emojis sparingly. Be mysterious and compelling. No hashtags.",
          },
          {
            role: "user",
            content: generateLore === true ? "Generate a lore tweet about the NEXUS ecosystem." : generateLore,
          },
        ]);
      }

      if (!tweetText) return jsonRes({ error: "No text to tweet" }, 400);

      const result = await twitterPost("/tweets", { text: tweetText });
      return jsonRes({ tweet: result?.data });
    }

    // GET /twitter-bot/status — Check configuration status
    if (req.method === "GET" && path === "status") {
      return jsonRes({
        configured: !!hasTwitter,
        keys: {
          consumer_key: !!Deno.env.get("TWITTER_CONSUMER_KEY"),
          consumer_secret: !!Deno.env.get("TWITTER_CONSUMER_SECRET"),
          access_token: !!Deno.env.get("TWITTER_ACCESS_TOKEN"),
          access_token_secret: !!Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET"),
        },
      });
    }

    return jsonRes({ error: "Not found" }, 404);
  } catch (err) {
    console.error("twitter-bot error:", err);
    return jsonRes({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
