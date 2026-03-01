"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateVolume, countEffectiveSets } from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface SessionHistorySet {
  id: string;
  exerciseId: string;
  reps: number;
  weight: number;
  rir: number | null;
}

interface SessionHistoryItem {
  id: string;
  date: string;
  durationMin: number | null;
  overallRPE: number | null;
  routineName: string | null;
  workoutSets: SessionHistorySet[];
}

interface SessionHistoryProps {
  sessions: SessionHistoryItem[];
}

const RANGE_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SessionHistory({ sessions }: SessionHistoryProps) {
  const [daysFilter, setDaysFilter] = useState(30);
  const filterDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - daysFilter);
    return date;
  }, [daysFilter]);

  const filteredSessions = useMemo(
    () => sessions.filter((session) => new Date(session.date) >= filterDate),
    [sessions, filterDate]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
          <p className="text-xs text-muted-foreground">
            {filteredSessions.length} sesiones completadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="xs"
              variant={daysFilter === option.value ? "default" : "outline"}
              onClick={() => setDaysFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <p className="text-3xl">📖</p>
              <p className="mt-2 text-sm">No hay sesiones para este rango.</p>
              <p className="text-xs mt-1">
                Registra entrenos y aparecerán aquí automáticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSessions.map((session) => {
            const totalSets = session.workoutSets.length;
            const effectiveSets = countEffectiveSets(session.workoutSets);
            const volume = calculateVolume(session.workoutSets);

            return (
              <Link key={session.id} href={`/train/history/${session.id}`}>
                <Card className="transition-colors hover:bg-accent/40 cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">
                        {session.routineName ?? "Sesión libre"}
                      </CardTitle>
                      <Badge variant="outline">{formatDate(session.date)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className={cn("rounded-md border border-border/80 py-2")}>
                        <p className="font-mono text-base font-semibold">{totalSets}</p>
                        <p className="text-[10px] text-muted-foreground">Series</p>
                      </div>
                      <div className={cn("rounded-md border border-border/80 py-2")}>
                        <p className="font-mono text-base font-semibold text-primary">
                          {effectiveSets}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Efectivas</p>
                      </div>
                      <div className={cn("rounded-md border border-border/80 py-2")}>
                        <p className="font-mono text-base font-semibold">
                          {Math.round(volume).toLocaleString("es-ES")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Vol (kg)</p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Duración:{" "}
                        {session.durationMin !== null ? `${session.durationMin} min` : "—"}
                      </span>
                      <span>RPE: {session.overallRPE !== null ? session.overallRPE : "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
