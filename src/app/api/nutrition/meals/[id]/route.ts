import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateMealSchema = z.object({
  description: z.string().trim().min(1).optional(),
  calories: z.number().positive().nullable().optional(),
  proteinG: z.number().min(0).nullable().optional(),
  carbsG: z.number().min(0).nullable().optional(),
  fatG: z.number().min(0).nullable().optional(),
  fiberG: z.number().min(0).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  verified: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateMealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const meal = await prisma.meal.update({
    where: { id },
    data: {
      ...parsed.data,
      verified: parsed.data.verified ?? true,
    },
  });

  return NextResponse.json(meal);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.meal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
