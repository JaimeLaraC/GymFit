"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface NutritionAnalysis {
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  confidence: "high" | "medium" | "low";
  notes: string | null;
}

interface AnalyzeResponse {
  meal?: {
    id: string;
  };
  analysis?: NutritionAnalysis;
  error?: string;
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export default function AddPhotoPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<NutritionAnalysis | null>(null);
  const [mealId, setMealId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [fiberG, setFiberG] = useState("");
  const [notes, setNotes] = useState("");

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisResult(null);
    setMealId(null);
    setHasError(null);
  }

  async function analyzePhoto() {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setHasError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("userId", "default-user");

    try {
      const response = await fetch("/api/nutrition/analyze", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok) throw new Error(data.error ?? "No se pudo analizar la foto");

      setMealId(data.meal?.id ?? null);

      if (data.analysis) {
        setAnalysisResult(data.analysis);
        setDescription(data.analysis.description ?? "");
        setCalories(data.analysis.calories?.toString() ?? "");
        setProteinG(data.analysis.proteinG?.toString() ?? "");
        setCarbsG(data.analysis.carbsG?.toString() ?? "");
        setFatG(data.analysis.fatG?.toString() ?? "");
        setFiberG(data.analysis.fiberG?.toString() ?? "");
        setNotes(data.analysis.notes ?? "");
      }

      if (data.error) setHasError(data.error);
    } catch (error) {
      setHasError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function confirmMeal() {
    if (!mealId) return;

    setIsAnalyzing(true);
    setHasError(null);

    try {
      const response = await fetch(`/api/nutrition/meals/${mealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || "Comida analizada",
          calories: toNumberOrNull(calories),
          proteinG: toNumberOrNull(proteinG),
          carbsG: toNumberOrNull(carbsG),
          fatG: toNumberOrNull(fatG),
          fiberG: toNumberOrNull(fiberG),
          notes: notes.trim() || null,
          verified: true,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo confirmar la comida");
      }

      router.push("/nutrition");
      router.refresh();
    } catch (error) {
      setHasError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Analizar comida con foto</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Captura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept="image/*" capture="environment" onChange={handleFileChange} />

          {previewUrl ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border/80">
              <Image src={previewUrl} alt="Vista previa de comida" fill className="object-cover" />
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={!selectedFile || isAnalyzing}
            onClick={() => {
              void analyzePhoto();
            }}
          >
            {isAnalyzing ? "Analizando..." : "Analizar con IA"}
          </Button>
        </CardContent>
      </Card>

      {analysisResult ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resultado editable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Confianza</p>
              <Badge variant={analysisResult.confidence === "high" ? "default" : "secondary"}>
                {analysisResult.confidence}
              </Badge>
            </div>

            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Descripción"
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={calories}
                onChange={(event) => setCalories(event.target.value)}
                placeholder="kcal"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={proteinG}
                onChange={(event) => setProteinG(event.target.value)}
                placeholder="proteína (g)"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={carbsG}
                onChange={(event) => setCarbsG(event.target.value)}
                placeholder="carbos (g)"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={fatG}
                onChange={(event) => setFatG(event.target.value)}
                placeholder="grasa (g)"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={fiberG}
                onChange={(event) => setFiberG(event.target.value)}
                placeholder="fibra (g)"
              />
            </div>

            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notas opcionales"
            />

            <Button
              type="button"
              className="w-full"
              disabled={!mealId || isAnalyzing}
              onClick={() => {
                void confirmMeal();
              }}
            >
              Confirmar comida
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {hasError ? <p className="text-sm text-orange-500">{hasError}</p> : null}
    </div>
  );
}
