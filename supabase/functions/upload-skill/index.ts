import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jwt = Deno.env.get("PINATA_JWT");
    const gateway =
      Deno.env.get("NEXT_PUBLIC_PINATA_GATEWAY") ||
      "blue-obvious-jackal-985.mypinata.cloud";

    if (!jwt) {
      console.error("PINATA_JWT is missing");
      return new Response(
        JSON.stringify({ error: "IPFS not configured: missing PINATA_JWT" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".md")) {
      return new Response(
        JSON.stringify({ error: "Only .md files accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "File too large (max 20MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to Pinata using their REST API directly (no npm SDK needed in Deno)
    const pinataForm = new FormData();
    pinataForm.append("file", file);

    const pinataRes = await fetch(
      "https://uploads.pinata.cloud/v3/files",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: pinataForm,
      }
    );

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error("Pinata upload failed:", pinataRes.status, errText);
      return new Response(
        JSON.stringify({ error: "IPFS upload failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pinataData = await pinataRes.json();
    const cid = pinataData?.data?.cid;

    if (!cid) {
      console.error("No CID in Pinata response:", JSON.stringify(pinataData));
      return new Response(
        JSON.stringify({ error: "No CID returned from IPFS", details: JSON.stringify(pinataData) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ipfsCid: cid, name: file.name, size: file.size }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    const details = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: "Upload failed", details }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
