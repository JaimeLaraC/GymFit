"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComparePhotosClientProps {
  initialAngle?: string;
}

interface ProgressPhoto {
  id: string;
  date: string;
  angle: "front" | "side" | "back";
  imageUrl: string;
  notes: string | null;
}

const ANGLE_LABELS: Record<ProgressPhoto["angle"], string> = {
  front: "Frontal",
  side: "Lateral",
  back: "Espalda",
};

function normalizeAngle(value?: string): ProgressPhoto["angle"] {
  if (value === "side" || value === "back") return value;
  return "front";
}

export function ComparePhotosClient({ initialAngle }: ComparePhotosClientProps) {
  const selectedAngle = normalizeAngle(initialAngle);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [beforeId, setBeforeId] = useState<string>("");
  const [afterId, setAfterId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPhotos() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/photos?userId=default-user&angle=${selectedAngle}`);
        if (!response.ok) throw new Error("No se pudieron cargar las fotos");

        const body = (await response.json()) as ProgressPhoto[];
        const sortedPhotos = [...body].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setPhotos(sortedPhotos);

        if (sortedPhotos.length >= 2) {
          setBeforeId(sortedPhotos[0].id);
          setAfterId(sortedPhotos[sortedPhotos.length - 1].id);
        } else {
          setBeforeId("");
          setAfterId("");
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error inesperado");
      } finally {
        setIsLoading(false);
      }
    }

    void loadPhotos();
  }, [selectedAngle]);

  const beforePhoto = useMemo(
    () => photos.find((photo) => photo.id === beforeId) ?? null,
    [photos, beforeId]
  );
  const afterPhoto = useMemo(
    () => photos.find((photo) => photo.id === afterId) ?? null,
    [photos, afterId]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">
        Comparar fotos · {ANGLE_LABELS[selectedAngle]}
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Antes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <select
              value={beforeId}
              onChange={(event) => setBeforeId(event.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              {photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {new Date(photo.date).toLocaleDateString("es-ES")}
                </option>
              ))}
            </select>

            {beforePhoto ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border/80">
                <Image src={beforePhoto.imageUrl} alt="Foto antes" fill className="object-cover" />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Después</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <select
              value={afterId}
              onChange={(event) => setAfterId(event.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              {photos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  {new Date(photo.date).toLocaleDateString("es-ES")}
                </option>
              ))}
            </select>

            {afterPhoto ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border/80">
                <Image src={afterPhoto.imageUrl} alt="Foto después" fill className="object-cover" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando fotos...</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {!isLoading && photos.length < 2 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Necesitas al menos 2 fotos del mismo ángulo para comparar.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/progress/photos/add">Añadir foto</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
