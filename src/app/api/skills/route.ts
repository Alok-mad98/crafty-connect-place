import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { privyServer } from "@/lib/privy";

// GET /api/skills — List all active skills
export async function GET() {
  try {
    const skills = await prisma.skill.findMany({
      where: { active: true },
      include: {
        creator: {
          select: { walletAddress: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      skills: skills.map((s: typeof skills[number]) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: s.price.toString(),
        ipfsCid: s.ipfsCid,
        modelTags: s.modelTags,
        onchainId: s.onchainId,
        verified: s.verified,
        creator: s.creator,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch skills:", error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}

// POST /api/skills — Create a new skill (authenticated)
export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    let privyId: string;
    if (token) {
      const verifiedClaims = await privyServer.verifyAuthToken(token);
      privyId = verifiedClaims.userId;
    } else {
      // Try cookie-based auth
      const cookieHeader = req.headers.get("cookie");
      if (!cookieHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      privyId = "anonymous"; // Fallback
    }

    const body = await req.json();
    const { title, description, price, ipfsCid, modelTags, onchainId, txHash } = body;

    if (!title || !description || !price || !ipfsCid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { privyId },
      update: {},
      create: { privyId },
    });

    // Create skill
    const skill = await prisma.skill.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        ipfsCid,
        modelTags: modelTags || [],
        creatorId: user.id,
        onchainId: onchainId != null ? parseInt(onchainId) : null,
        txHash,
        verified: false,
      },
    });

    // Trigger async verification
    try {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: skill.id }),
      });
    } catch {
      // Non-blocking — verification happens async
    }

    return NextResponse.json({ skill: { ...skill, price: skill.price.toString() } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create skill:", error);
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
  }
}
