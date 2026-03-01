import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  score: {
    total: number;
    performance: number;
    volume: number;
    consistency: number;
    recovery: number;
    trend: "up" | "stable" | "down";
  };
}

interface ScoreBreakdown {
  label: string;
  value: number;
}

function getScoreColorClass(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getBarColorClass(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getTrendLabel(trend: ScoreCardProps["score"]["trend"]): string {
  if (trend === "up") return "↗ Mejora";
  if (trend === "down") return "↘ Baja";
  return "→ Estable";
}

export function ScoreCard({ score }: ScoreCardProps) {
  const breakdowns: ScoreBreakdown[] = [
    { label: "Rendimiento", value: score.performance },
    { label: "Volumen", value: score.volume },
    { label: "Consistencia", value: score.consistency },
    { label: "Recuperación", value: score.recovery },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Score Global</CardTitle>
          <Badge variant="outline">{getTrendLabel(score.trend)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <span className={cn("font-mono text-5xl font-bold", getScoreColorClass(score.total))}>
            {score.total}
          </span>
          <span className="text-sm text-muted-foreground pb-1">/ 100</span>
        </div>

        <div className="space-y-2.5">
          {breakdowns.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono">{item.value}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={cn("h-2 rounded-full transition-all", getBarColorClass(item.value))}
                  style={{ width: `${Math.max(0, Math.min(item.value, 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
