import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  BADGE_DEFINITIONS,
  calculateRanking,
  calculateStreak,
} from "@/lib/gamification";

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

interface BadgeAchievementMeta {
  id: string;
  icon: string | null;
}

function getBadgeAchievementMeta(value: unknown): BadgeAchievementMeta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const recordValue = value as Record<string, unknown>;
  const id = typeof recordValue.id === "string" ? recordValue.id : null;
  if (!id) return null;

  return {
    id,
    icon: typeof recordValue.icon === "string" ? recordValue.icon : null,
  };
}

function formatChange(value: number, suffix = ""): string {
  const formattedValue = value > 0 ? `+${value}` : `${value}`;
  return `${formattedValue}${suffix}`;
}

function getChangeClassName(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-muted-foreground";
}

export default async function AchievementsPage() {
  const [achievements, streak, ranking] = await Promise.all([
    prisma.achievement.findMany({
      where: {
        userId: DEFAULT_USER_ID,
      },
      orderBy: {
        unlockedAt: "desc",
      },
    }),
    calculateStreak(DEFAULT_USER_ID),
    calculateRanking(DEFAULT_USER_ID),
  ]);

  const badgeAchievements = achievements.filter(
    (achievement) => achievement.type === "badge"
  );
  const prAchievements = achievements.filter((achievement) => achievement.type === "pr");

  const unlockedBadgesById = new Map<
    string,
    {
      unlockedAt: Date;
      icon: string | null;
    }
  >();

  const unlockedBadgesByName = new Map(
    badgeAchievements.map((achievement) => [achievement.name, achievement])
  );

  for (const achievement of badgeAchievements) {
    const badgeMeta = getBadgeAchievementMeta(achievement.value);
    if (!badgeMeta) continue;

    unlockedBadgesById.set(badgeMeta.id, {
      unlockedAt: achievement.unlockedAt,
      icon: badgeMeta.icon,
    });
  }

  const totalBadges = BADGE_DEFINITIONS.length;
  const unlockedBadges = badgeAchievements.length;
  const hasAllBadges = unlockedBadges === totalBadges;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logros</h1>
          <p className="text-sm text-muted-foreground">
            {unlockedBadges}/{totalBadges} badges desbloqueados
          </p>
        </div>
        {hasAllBadges ? <Badge>Completado</Badge> : <Badge variant="outline">En progreso</Badge>}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Racha actual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-border/80 px-3 py-2">
              <p className="text-xl font-bold font-mono">🔥 {streak.currentDays}</p>
              <p className="text-xs text-muted-foreground">Días actuales</p>
            </div>
            <div className="rounded-lg border border-border/80 px-3 py-2">
              <p className="text-xl font-bold font-mono">🏆 {streak.longestDays}</p>
              <p className="text-xs text-muted-foreground">Récord personal</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ranking personal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-5 text-[11px] font-medium text-muted-foreground">
            <span>Periodo</span>
            <span>Score</span>
            <span>Volumen</span>
            <span>Fuerza</span>
            <span>Sesiones</span>
          </div>
          {ranking.map((comparison) => (
            <div
              key={comparison.period}
              className="grid grid-cols-5 rounded-md border border-border/80 px-2 py-2 text-xs"
            >
              <span>{comparison.period}</span>
              <span className={getChangeClassName(comparison.scoreChange)}>
                {formatChange(comparison.scoreChange)}
              </span>
              <span className={getChangeClassName(comparison.volumeChange)}>
                {formatChange(comparison.volumeChange, "%")}
              </span>
              <span className={getChangeClassName(comparison.strengthChange)}>
                {formatChange(comparison.strengthChange, "%")}
              </span>
              <span className={getChangeClassName(comparison.sessionsChange)}>
                {formatChange(comparison.sessionsChange)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BADGE_DEFINITIONS.map((badgeDefinition) => {
              const unlockedById = unlockedBadgesById.get(badgeDefinition.id);
              const unlockedByName = unlockedBadgesByName.get(badgeDefinition.name);

              const unlockedBadge = unlockedById
                ? {
                    unlockedAt: unlockedById.unlockedAt,
                    icon: unlockedById.icon,
                  }
                : unlockedByName
                  ? {
                      unlockedAt: unlockedByName.unlockedAt,
                      icon: badgeDefinition.icon,
                    }
                  : null;

              const badgeIcon = unlockedBadge?.icon ?? badgeDefinition.icon;

              return (
                <article
                  key={badgeDefinition.id}
                  className={`rounded-lg border px-3 py-3 text-center ${
                    unlockedBadge
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/70 bg-muted/30 opacity-75"
                  }`}
                >
                  <p className="text-xl">{unlockedBadge ? badgeIcon : "🔒"}</p>
                  <p className="mt-2 text-sm font-medium">{badgeDefinition.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {unlockedBadge
                      ? unlockedBadge.unlockedAt.toLocaleDateString("es-ES")
                      : "???"}
                  </p>
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historial de PRs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {prAchievements.length > 0 ? (
            prAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border/80 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{achievement.name}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description ?? "Sin detalle"}</p>
                </div>
                <Badge variant="outline">
                  {achievement.unlockedAt.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay PRs registrados.</p>
          )}
        </CardContent>
      </Card>

      <Link href="/profile" className="inline-flex text-sm text-primary hover:underline">
        ← Volver al perfil
      </Link>
    </div>
  );
}
