import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { privyServer } from "@/lib/privy";
import { fetchSkillFromIPFS } from "@/lib/pinata";
import { CONTRACT_ADDRESS } from "@/lib/contracts";

// GET /api/mcp/skill/[id] — MCP Resource endpoint with 402 paywall
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Find the skill
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: { creator: true },
    });

    if (!skill) {
      return NextResponse.json(
        { error: "skill_not_found", message: "No skill with this ID exists" },
        { status: 404 }
      );
    }

    // 2. Verify Privy auth token
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        {
          error: "auth_required",
          message: "Provide a Privy auth token in the Authorization header",
        },
        { status: 401 }
      );
    }

    let privyId: string;
    try {
      const verifiedClaims = await privyServer.verifyAuthToken(token);
      privyId = verifiedClaims.userId;
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Invalid or expired auth token" },
        { status: 401 }
      );
    }

    // 3. Find user
    const user = await prisma.user.findUnique({ where: { privyId } });

    if (!user) {
      return NextResponse.json(
        { error: "user_not_found", message: "User not registered" },
        { status: 401 }
      );
    }

    // 4. Check if user has purchased this skill
    const purchase = await prisma.purchase.findUnique({
      where: {
        buyerId_skillId: {
          buyerId: user.id,
          skillId: skill.id,
        },
      },
    });

    // 5a. If NOT purchased → 402 Payment Required
    if (!purchase) {
      return NextResponse.json(
        {
          error: "payment_required",
          message: "This skill requires purchase before access",
          skill: {
            id: skill.id,
            title: skill.title,
            description: skill.description,
            price: skill.price.toString(),
          },
          payment: {
            currency: "USDC",
            chain: "base",
            chainId: 8453,
            contract: CONTRACT_ADDRESS,
            usdcAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS,
            method: "buySkill(uint256)",
            args: [skill.onchainId],
            instructions: [
              `1. Approve USDC spend: approve(${CONTRACT_ADDRESS}, ${skill.price})`,
              `2. Call buySkill(${skill.onchainId}) on ${CONTRACT_ADDRESS}`,
              `3. Re-request this endpoint after purchase confirmation`,
            ],
          },
        },
        { status: 402 }
      );
    }

    // 5b. If purchased → Serve MCP resource
    const content = await fetchSkillFromIPFS(skill.ipfsCid);

    return NextResponse.json(
      {
        type: "resource",
        uri: `mcp://nexus/skills/${skill.id}`,
        name: skill.title,
        description: skill.description,
        mimeType: "text/markdown",
        content,
        metadata: {
          modelTags: skill.modelTags,
          creator: skill.creator?.walletAddress,
          purchasedAt: purchase.createdAt,
          ipfsCid: skill.ipfsCid,
        },
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-MCP-Version": "1.0",
          "Cache-Control": "private, max-age=3600",
        },
      }
    );
  } catch (error) {
    console.error("MCP endpoint error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to process MCP request" },
      { status: 500 }
    );
  }
}
