import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default-user";
    const type = searchParams.get("type");

    const achievements = await prisma.achievement.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: {
        unlockedAt: "desc",
      },
    });

    return NextResponse.json(achievements);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
