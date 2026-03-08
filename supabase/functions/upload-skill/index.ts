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
    const accessKey = Deno.env.get("FILEBASE_ACCESS_KEY");
    const secretKey = Deno.env.get("FILEBASE_SECRET_KEY");
    const bucket = Deno.env.get("FILEBASE_BUCKET") || "ai-skills";

    if (!accessKey || !secretKey) {
      console.error("Filebase credentials missing");
      return jsonRes({ error: "IPFS not configured: missing Filebase credentials" }, 500);
    }

    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.arrayBuffer();

    if (!contentType.includes("multipart/form-data")) {
      return jsonRes({ error: "Expected multipart/form-data", received: contentType }, 400);
    }

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

    // Upload to Filebase S3-compatible API
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const objectKey = `skills/${Date.now()}-${file.name}`;
    const host = `${bucket}.s3.filebase.com`;
    const url = `https://${host}/${objectKey}`;

    // Create AWS Signature V4 headers
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const region = "us-east-1";
    const service = "s3";

    // Simple PUT with basic auth headers (Filebase supports this)
    const authString = btoa(`${accessKey}:${secretKey}`);

    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown",
        "x-amz-date": amzDate,
        "Authorization": `Basic ${authString}`,
      },
      body: fileBytes,
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("Filebase upload failed:", putRes.status, errText);

      // Fallback: try with AWS-style auth using fetch to presigned-like endpoint
      const fallbackUrl = `https://s3.filebase.com/${bucket}/${objectKey}`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "text/markdown",
          "Authorization": `Basic ${authString}`,
        },
        body: fileBytes,
      });

      if (!fallbackRes.ok) {
        const fallbackErr = await fallbackRes.text();
        console.error("Filebase fallback upload failed:", fallbackRes.status, fallbackErr);
        return jsonRes({ error: "IPFS upload failed", details: fallbackErr }, 500);
      }

      const cid = fallbackRes.headers.get("x-amz-meta-cid");
      if (!cid) {
        console.error("No CID in Filebase fallback response headers");
        return jsonRes({ error: "No CID returned from IPFS" }, 500);
      }

      return jsonRes({ ipfsCid: cid, name: file.name, size: file.size });
    }

    const cid = putRes.headers.get("x-amz-meta-cid");
    if (!cid) {
      console.error("No CID in Filebase response headers");
      return jsonRes({ error: "No CID returned from IPFS" }, 500);
    }

    return jsonRes({ ipfsCid: cid, name: file.name, size: file.size });
  } catch (error) {
    console.error("Upload error:", error);
    const details = error instanceof Error ? error.message : String(error);
    return jsonRes({ error: "Upload failed", details }, 500);
  }
});
