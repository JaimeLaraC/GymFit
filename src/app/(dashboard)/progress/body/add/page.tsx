"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface BodyMetricFormState {
  weightKg: string;
  chestCm: string;
  waistCm: string;
  hipsCm: string;
  shouldersCm: string;
  leftArmCm: string;
  rightArmCm: string;
  leftThighCm: string;
  rightThighCm: string;
  calfCm: string;
  notes: string;
}

const INITIAL_STATE: BodyMetricFormState = {
  weightKg: "",
  chestCm: "",
  waistCm: "",
  hipsCm: "",
  shouldersCm: "",
  leftArmCm: "",
  rightArmCm: "",
  leftThighCm: "",
  rightThighCm: "",
  calfCm: "",
  notes: "",
};

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  return Number(value);
}

export default function AddBodyMetricPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMeasures, setShowMeasures] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof BodyMetricFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        userId: "default-user",
        weightKg: toNumberOrNull(form.weightKg),
        chestCm: toNumberOrNull(form.chestCm),
        waistCm: toNumberOrNull(form.waistCm),
        hipsCm: toNumberOrNull(form.hipsCm),
        shouldersCm: toNumberOrNull(form.shouldersCm),
        leftArmCm: toNumberOrNull(form.leftArmCm),
        rightArmCm: toNumberOrNull(form.rightArmCm),
        leftThighCm: toNumberOrNull(form.leftThighCm),
        rightThighCm: toNumberOrNull(form.rightThighCm),
        calfCm: toNumberOrNull(form.calfCm),
        notes: form.notes.trim() || null,
      };

      const response = await fetch("/api/body-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar la medición");
      }

      router.push("/progress/body");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Añadir medición</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peso corporal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Ej: 78.4"
              value={form.weightKg}
              onChange={(event) => updateField("weightKg", event.target.value)}
              className="h-12 text-lg font-mono"
            />
            <p className="text-xs text-muted-foreground">Campo principal recomendado en cada registro.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Medidas opcionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowMeasures((prev) => !prev)}
            >
              {showMeasures ? "Ocultar medidas" : "Añadir medidas corporales"}
            </Button>

            {showMeasures ? (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Pecho (cm)" value={form.chestCm} onChange={(event) => updateField("chestCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Cintura (cm)" value={form.waistCm} onChange={(event) => updateField("waistCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Cadera (cm)" value={form.hipsCm} onChange={(event) => updateField("hipsCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Hombros (cm)" value={form.shouldersCm} onChange={(event) => updateField("shouldersCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Brazo izq. (cm)" value={form.leftArmCm} onChange={(event) => updateField("leftArmCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Brazo der. (cm)" value={form.rightArmCm} onChange={(event) => updateField("rightArmCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Muslo izq. (cm)" value={form.leftThighCm} onChange={(event) => updateField("leftThighCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Muslo der. (cm)" value={form.rightThighCm} onChange={(event) => updateField("rightThighCm", event.target.value)} />
                <Input type="number" inputMode="decimal" step="0.1" placeholder="Gemelo (cm)" value={form.calfCm} onChange={(event) => updateField("calfCm", event.target.value)} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              placeholder="Contexto opcional (descanso, hidratación, etc.)"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar medición"}
        </Button>
      </form>
    </div>
  );
}
