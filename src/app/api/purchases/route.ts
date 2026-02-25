import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { privyServer } from "@/lib/privy";

// GET /api/purchases?skillId=xxx — Check if user has purchased a skill
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ purchased: false });
    }

    const verifiedClaims = await privyServer.verifyAuthToken(token);
    const user = await prisma.user.findUnique({
      where: { privyId: verifiedClaims.userId },
    });

    if (!user) {
      return NextResponse.json({ purchased: false });
    }

    const skillId = req.nextUrl.searchParams.get("skillId");
    if (!skillId) {
      // Return all purchases for user
      const purchases = await prisma.purchase.findMany({
        where: { buyerId: user.id },
        include: { skill: true },
      });
      return NextResponse.json({ purchases });
    }

    const purchase = await prisma.purchase.findUnique({
      where: {
        buyerId_skillId: { buyerId: user.id, skillId },
      },
    });

    return NextResponse.json({ purchased: !!purchase });
  } catch {
    return NextResponse.json({ purchased: false });
  }
}

// POST /api/purchases — Record a purchase
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let privyId: string;
    try {
      const verifiedClaims = await privyServer.verifyAuthToken(token);
      privyId = verifiedClaims.userId;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { skillId, txHash } = await req.json();

    if (!skillId || !txHash) {
      return NextResponse.json(
        { error: "skillId and txHash required" },
        { status: 400 }
      );
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { privyId },
      update: {},
      create: { privyId },
    });

    // Check skill exists
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Check for existing purchase
    const existing = await prisma.purchase.findUnique({
      where: {
        buyerId_skillId: { buyerId: user.id, skillId },
      },
    });

    if (existing) {
      return NextResponse.json({ purchase: existing, message: "Already purchased" });
    }

    // Record purchase
    const purchase = await prisma.purchase.create({
      data: {
        buyerId: user.id,
        skillId,
        txHash,
      },
    });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    console.error("Purchase recording failed:", error);
    return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
  }
}
