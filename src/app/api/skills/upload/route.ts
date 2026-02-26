import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

// POST /api/skills/upload — Upload .md file to IPFS
export async function POST(req: NextRequest) {
  try {
    const jwt = process.env.PINATA_JWT;
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "blue-obvious-jackal-985.mypinata.cloud";

    if (!jwt) {
      console.error("PINATA_JWT is missing from environment variables");
      return NextResponse.json({ error: "IPFS not configured: missing PINATA_JWT" }, { status: 500 });
    }

    const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".md")) {
      return NextResponse.json({ error: "Only .md files accepted" }, { status: 400 });
    }

    // Max 1MB
    if (file.size > 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 1MB)" }, { status: 400 });
    }

    console.log("Uploading to IPFS:", { name: file.name, size: file.size, hasJwt: !!jwt });
    const result = await pinata.upload.public.file(file);

    return NextResponse.json({
      ipfsCid: result.cid,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("IPFS upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
