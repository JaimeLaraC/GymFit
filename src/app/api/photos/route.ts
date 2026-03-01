import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_USER_ID = "default-user";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "uploads", "progress");

interface AllowedAngle {
  value: "front" | "side" | "back";
}

function normalizeAngle(value: string | null): AllowedAngle["value"] | null {
  if (!value) return null;
  if (value === "front" || value === "side" || value === "back") return value;
  return null;
}

function inferExtension(fileName: string, mimeType: string): string {
  const originalExtension = path.extname(fileName).toLowerCase();
  if (originalExtension) return originalExtension;

  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/heic") return ".heic";
  return ".jpg";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? DEFAULT_USER_ID;
    const angle = normalizeAngle(searchParams.get("angle"));

    const photos = await prisma.progressPhoto.findMany({
      where: {
        userId,
        ...(angle ? { angle } : {}),
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(photos);
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Error interno al obtener fotos de progreso" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = String(formData.get("userId") ?? DEFAULT_USER_ID);
    const angle = normalizeAngle(String(formData.get("angle") ?? ""));
    const notesValue = formData.get("notes");
    const notes =
      notesValue !== null && String(notesValue).trim().length > 0
        ? String(notesValue).trim()
        : null;
    const file = formData.get("file");

    if (!angle) {
      return NextResponse.json(
        { error: "El ángulo debe ser front, side o back" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes adjuntar una imagen" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen válida" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "La imagen supera el tamaño máximo de 10MB" },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIRECTORY, { recursive: true });

    const extension = inferExtension(file.name, file.type);
    const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${extension}`;
    const filePath = path.join(UPLOAD_DIRECTORY, filename);
    const relativeUrl = `/uploads/progress/${filename}`;

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const photo = await prisma.progressPhoto.create({
      data: {
        userId,
        angle,
        imageUrl: relativeUrl,
        notes,
        date: new Date(),
      },
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("Error uploading progress photo:", error);
    return NextResponse.json(
      { error: "Error interno al subir foto de progreso" },
      { status: 500 }
    );
  }
}
