import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function isMarkdownFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  return fileName.endsWith(".md") || mimeType.includes("markdown");
}

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

    if (!isMarkdownFile(file)) {
      return NextResponse.json({ error: "Only Markdown (.md) files are accepted" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
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
    const details = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: "IPFS upload failed", details }, { status: 500 });
  }
}

