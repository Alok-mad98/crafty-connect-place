import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jwt = Deno.env.get("PINATA_JWT");
    if (!jwt) {
      console.error("PINATA_JWT is missing");
      return jsonRes({ error: "IPFS not configured: missing PINATA_JWT" }, 500);
    }

    // Read the raw request body and content-type
    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.arrayBuffer();

    if (!contentType.includes("multipart/form-data")) {
      return jsonRes({ error: "Expected multipart/form-data", received: contentType }, 400);
    }

    // Re-construct a Request so Deno can parse the formData
    const reconstructed = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": contentType },
      body: rawBody,
    });

    const formData = await reconstructed.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return jsonRes({ error: "No file provided" }, 400);
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".md")) {
      return jsonRes({ error: "Only .md files accepted" }, 400);
    }

    if (file.size > 20 * 1024 * 1024) {
      return jsonRes({ error: "File too large (max 20MB)" }, 400);
    }

    // Upload to Pinata v3 REST API
    const pinataForm = new FormData();
    pinataForm.append("file", file);

    const pinataRes = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm,
    });

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error("Pinata upload failed:", pinataRes.status, errText);
      return jsonRes({ error: "IPFS upload failed", details: errText }, 500);
    }

    const pinataData = await pinataRes.json();
    const cid = pinataData?.data?.cid;

    if (!cid) {
      console.error("No CID in Pinata response:", JSON.stringify(pinataData));
      return jsonRes({ error: "No CID returned from IPFS", details: JSON.stringify(pinataData) }, 500);
    }

    return jsonRes({ ipfsCid: cid, name: file.name, size: file.size });
  } catch (error) {
    console.error("Upload error:", error);
    const details = error instanceof Error ? error.message : String(error);
    return jsonRes({ error: "Upload failed", details }, 500);
  }
});
