"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface QuickMealItem {
  label: string;
  proteinG: number;
  fatG: number;
  carbsG: number;
  calories: number;
}

interface ManualMealPayload {
  userId: string;
  description: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  notes?: string;
}

interface SyncServiceWorkerRegistration extends ServiceWorkerRegistration {
  sync: {
    register: (tag: string) => Promise<void>;
  };
}

const QUEUE_STORAGE_KEY = "gymfit.manual-meals.queue.v1";

const QUICK_MEALS: Record<string, QuickMealItem> = {
  chicken: { label: "🍗 Pollo (150g)", proteinG: 46, fatG: 5, carbsG: 0, calories: 231 },
  rice: { label: "🍚 Arroz (200g)", proteinG: 5, fatG: 0.5, carbsG: 56, calories: 260 },
  eggs: { label: "🥚 Huevos ×3", proteinG: 18, fatG: 15, carbsG: 1.5, calories: 210 },
  whey: { label: "🥤 Whey (30g)", proteinG: 24, fatG: 1, carbsG: 3, calories: 120 },
  avocado: { label: "🥑 Aguacate (100g)", proteinG: 2, fatG: 15, carbsG: 9, calories: 160 },
  banana: { label: "🍌 Plátano", proteinG: 1, fatG: 0, carbsG: 27, calories: 105 },
};

function toNumberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function getQueue(): ManualMealPayload[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ManualMealPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: ManualMealPayload[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

async function flushQueue(): Promise<boolean> {
  const queue = getQueue();
  if (queue.length === 0) return true;

  const remaining: ManualMealPayload[] = [];
  for (const payload of queue) {
    try {
      const response = await fetch("/api/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) remaining.push(payload);
    } catch {
      remaining.push(payload);
    }
  }

  saveQueue(remaining);
  return remaining.length === 0;
}

export default function AddManualPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [fiberG, setFiberG] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  const quickMealKeys = useMemo(() => Object.keys(QUICK_MEALS), []);

  useEffect(() => {
    setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);

    async function onOnline() {
      setIsOffline(false);
      const flushed = await flushQueue();
      if (flushed) setQueuedMessage("Se enviaron las comidas pendientes.");
    }

    function onOffline() {
      setIsOffline(true);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void onOnline();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function applyQuickMeal(key: string) {
    const selected = QUICK_MEALS[key];
    if (!selected) return;

    setDescription(selected.label);
    setCalories(selected.calories.toString());
    setProteinG(selected.proteinG.toString());
    setCarbsG(selected.carbsG.toString());
    setFatG(selected.fatG.toString());
    setQueuedMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasError(null);
    setQueuedMessage(null);
    setIsSubmitting(true);

    const payload: ManualMealPayload = {
      userId: "default-user",
      description: description.trim(),
      calories: toNumberOrUndefined(calories),
      proteinG: toNumberOrUndefined(proteinG),
      carbsG: toNumberOrUndefined(carbsG),
      fatG: toNumberOrUndefined(fatG),
      fiberG: toNumberOrUndefined(fiberG),
      notes: notes.trim() || undefined,
    };

    try {
      if (!payload.description) throw new Error("La descripción es obligatoria");

      if (isOffline) {
        const queue = getQueue();
        queue.push(payload);
        saveQueue(queue);

        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready.catch(() => null);
          const hasSync = registration && "sync" in registration;
          if (hasSync) {
            const syncRegistration = registration as SyncServiceWorkerRegistration;
            await syncRegistration.sync.register("sync-manual-meals");
          }
        }

        setQueuedMessage("Sin conexión: la comida se guardó en cola y se enviará automáticamente.");
        return;
      }

      const response = await fetch("/api/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo registrar la comida");
      }

      router.push("/nutrition");
      router.refresh();
    } catch (error) {
      setHasError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Registrar comida manual</h1>

      {isOffline ? (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6 text-sm">
            Estás sin conexión. Guardaremos la comida y la enviaremos automáticamente.
          </CardContent>
        </Card>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comidas rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickMealKeys.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyQuickMeal(key)}
              >
                {QUICK_MEALS[key].label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              required
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
                placeholder="Calorías"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={proteinG}
                onChange={(event) => setProteinG(event.target.value)}
                placeholder="Proteína (g)"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={carbsG}
                onChange={(event) => setCarbsG(event.target.value)}
                placeholder="Carbos (g)"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={fatG}
                onChange={(event) => setFatG(event.target.value)}
                placeholder="Grasa (g)"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={fiberG}
                onChange={(event) => setFiberG(event.target.value)}
                placeholder="Fibra (g)"
              />
            </div>
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notas opcionales"
            />
          </CardContent>
        </Card>

        {hasError ? <p className="text-sm text-red-500">{hasError}</p> : null}
        {queuedMessage ? <p className="text-sm text-emerald-500">{queuedMessage}</p> : null}

        <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Guardando..." : "Guardar comida"}
        </Button>
      </form>
    </div>
  );
}
