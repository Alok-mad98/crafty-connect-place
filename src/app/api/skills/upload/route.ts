import { NextRequest, NextResponse } from "next/server";
import { pinata } from "@/lib/pinata";

// POST /api/skills/upload — Upload .md file to IPFS
export async function POST(req: NextRequest) {
  try {
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

    const result = await pinata.upload.public.file(file);

    return NextResponse.json({
      ipfsCid: result.cid,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("IPFS upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
