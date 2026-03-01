import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

interface PhotosPageProps {
  searchParams: Promise<{
    angle?: string;
  }>;
}

const DEFAULT_USER_ID = "default-user";

const ANGLE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "front", label: "Frontal" },
  { value: "side", label: "Lateral" },
  { value: "back", label: "Espalda" },
];

const ANGLE_LABELS: Record<string, string> = {
  front: "Frontal",
  side: "Lateral",
  back: "Espalda",
};

export const dynamic = "force-dynamic";

export default async function PhotosPage({ searchParams }: PhotosPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedAngle =
    resolvedSearchParams.angle === "front" ||
    resolvedSearchParams.angle === "side" ||
    resolvedSearchParams.angle === "back"
      ? resolvedSearchParams.angle
      : "all";

  const photos = await prisma.progressPhoto.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      ...(selectedAngle !== "all" ? { angle: selectedAngle } : {}),
    },
    orderBy: { date: "desc" },
  });

  const groupedPhotos = new Map<string, typeof photos>();
  for (const photo of photos) {
    const dateKey = photo.date.toISOString().slice(0, 10);
    if (!groupedPhotos.has(dateKey)) groupedPhotos.set(dateKey, []);
    groupedPhotos.get(dateKey)?.push(photo);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Fotos de progreso</h1>
        <Button asChild size="sm">
          <Link href="/progress/photos/add">📸 Añadir foto</Link>
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ANGLE_OPTIONS.map((option) => (
          <Button
            asChild
            key={option.value}
            size="xs"
            variant={selectedAngle === option.value ? "default" : "outline"}
          >
            <Link href={option.value === "all" ? "/progress/photos" : `/progress/photos?angle=${option.value}`}>
              {option.label}
            </Link>
          </Button>
        ))}
      </div>

      {photos.length >= 2 ? (
        <Button asChild className="w-full" variant="secondary">
          <Link
            href={
              selectedAngle === "all"
                ? "/progress/photos/compare?angle=front"
                : `/progress/photos/compare?angle=${selectedAngle}`
            }
          >
            Comparar fotos
          </Link>
        </Button>
      ) : null}

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p className="text-3xl">📷</p>
            <p className="text-sm mt-2">Todavía no hay fotos de progreso.</p>
          </CardContent>
        </Card>
      ) : (
        [...groupedPhotos.entries()].map(([dateKey, datePhotos]) => (
          <div key={dateKey} className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {new Date(dateKey).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {datePhotos.map((photo) => (
                <Card key={photo.id} className="overflow-hidden p-0">
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={photo.imageUrl}
                      alt={`Foto de progreso ${photo.angle}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <CardContent className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{ANGLE_LABELS[photo.angle] ?? photo.angle}</Badge>
                    </div>
                    {photo.notes ? (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{photo.notes}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
