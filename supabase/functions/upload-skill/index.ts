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

// AWS4 Signature V4 helpers
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string
) {
  const parsedUrl = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = await sha256(body);
  headers["host"] = parsedUrl.host;

  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k] || headers[Object.keys(headers).find(h => h.toLowerCase() === k)!]}\n`).join("");

  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    parsedUrl.search.slice(1),
    canonicalHeaders,
    signedHeaders,
    headers["x-amz-content-sha256"],
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmac(signingKey, stringToSign);
  const signature = [...new Uint8Array(signatureBytes)].map(b => b.toString(16).padStart(2, "0")).join("");

  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
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

    // Upload to Filebase using AWS4-HMAC-SHA256 signed request
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const objectKey = `skills/${Date.now()}-${file.name}`;
    const host = `s3.filebase.com`;
    const url = `https://${host}/${bucket}/${objectKey}`;
    const region = "us-east-1";
    const service = "s3";

    const headers: Record<string, string> = {
      "Content-Type": "text/markdown",
    };

    const signedHeaders = await signRequest(
      "PUT", url, headers, fileBytes, accessKey, secretKey, region, service
    );

    const putRes = await fetch(url, {
      method: "PUT",
      headers: signedHeaders,
      body: fileBytes,
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("Filebase upload failed:", putRes.status, errText);
      return jsonRes({ error: "IPFS upload failed", details: errText }, 500);
    }

    const cid = putRes.headers.get("x-amz-meta-cid");
    if (!cid) {
      console.error("No CID in Filebase response. Headers:", JSON.stringify([...putRes.headers.entries()]));
      return jsonRes({ error: "No CID returned from IPFS" }, 500);
    }

    return jsonRes({ ipfsCid: cid, name: file.name, size: file.size });
  } catch (error) {
    console.error("Upload error:", error);
    const details = error instanceof Error ? error.message : String(error);
    return jsonRes({ error: "Upload failed", details }, 500);
  }
});
