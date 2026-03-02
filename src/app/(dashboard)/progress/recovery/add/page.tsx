"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ManualRecoveryPayload {
  userId: string;
  subjectiveEnergy: number;
  stressLevel?: number;
  sleepHours?: number;
}

interface SyncServiceWorkerRegistration extends ServiceWorkerRegistration {
  sync: {
    register: (tag: string) => Promise<void>;
  };
}

const QUEUE_STORAGE_KEY = "gymfit.recovery.queue.v1";

function getQueue(): ManualRecoveryPayload[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ManualRecoveryPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: ManualRecoveryPayload[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

async function flushQueue(): Promise<boolean> {
  const queue = getQueue();
  if (queue.length === 0) return true;

  const pending = [...queue];
  const remaining: ManualRecoveryPayload[] = [];

  for (const payload of pending) {
    try {
      const response = await fetch("/api/recovery/manual", {
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

function toNumberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

export default function AddRecoveryPage() {
  const router = useRouter();
  const [subjectiveEnergy, setSubjectiveEnergy] = useState<number>(7);
  const [stressLevel, setStressLevel] = useState<number>(5);
  const [sleepHours, setSleepHours] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    setIsOffline(offline);

    async function onOnline() {
      setIsOffline(false);
      const wasFlushed = await flushQueue();
      if (wasFlushed) setQueuedMessage("Se enviaron los registros pendientes.");
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

  const energyScale = useMemo(() => Array.from({ length: 10 }, (_, index) => index + 1), []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasError(null);
    setQueuedMessage(null);
    setIsSubmitting(true);

    const payload: ManualRecoveryPayload = {
      userId: "default-user",
      subjectiveEnergy,
      stressLevel,
      sleepHours: toNumberOrUndefined(sleepHours),
    };

    try {
      if (isOffline) {
        const queue = getQueue();
        queue.push(payload);
        saveQueue(queue);

        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready.catch(() => null);
          const hasSync = registration && "sync" in registration;
          if (hasSync) {
            const syncRegistration = registration as SyncServiceWorkerRegistration;
            await syncRegistration.sync.register("sync-recovery-manual");
          }
        }

        setQueuedMessage("Sin conexión: se guardó en cola y se enviará al volver online.");
        return;
      }

      const response = await fetch("/api/recovery/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No se pudo guardar el snapshot manual");
      }

      router.push("/progress/recovery");
      router.refresh();
    } catch (error) {
      setHasError(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Registro manual de recuperación</h1>

      {isOffline ? (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6 text-sm">
            Estás sin conexión. El registro se encolará y se enviará automáticamente.
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Energía subjetiva (1-10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {energyScale.map((value) => (
                <Button
                  key={`energy-${value}`}
                  type="button"
                  size="sm"
                  variant={subjectiveEnergy === value ? "default" : "outline"}
                  onClick={() => setSubjectiveEnergy(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estrés percibido (1-10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {energyScale.map((value) => (
                <Button
                  key={`stress-${value}`}
                  type="button"
                  size="sm"
                  variant={stressLevel === value ? "default" : "outline"}
                  onClick={() => setStressLevel(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Horas de sueño (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              max="24"
              step="0.1"
              value={sleepHours}
              onChange={(event) => setSleepHours(event.target.value)}
              placeholder="Ej: 7.5"
            />
          </CardContent>
        </Card>

        {hasError ? <p className="text-sm text-red-500">{hasError}</p> : null}
        {queuedMessage ? <p className="text-sm text-emerald-500">{queuedMessage}</p> : null}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar recuperación"}
        </Button>
      </form>
    </div>
  );
}
