import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BADGE_DEFINITIONS } from "@/lib/gamification";
import { prisma } from "@/lib/prisma";

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const unlockedBadges = await prisma.achievement.count({
    where: {
      userId: DEFAULT_USER_ID,
      type: "badge",
    },
  });

  const totalBadges = BADGE_DEFINITIONS.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>

      <Link href="/profile/achievements">
        <Card className="cursor-pointer transition-colors hover:bg-accent">
          <CardContent className="pt-6">
            <p className="text-lg font-semibold">🏆 Logros</p>
            <p className="text-sm text-muted-foreground">
              {unlockedBadges}/{totalBadges} badges desbloqueados
            </p>
          </CardContent>
        </Card>
      </Link>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Button asChild className="w-full">
            <Link href="/nutrition">🍽️ Ir a nutrición</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/nutrition/trends">📈 Ver tendencias nutricionales</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
