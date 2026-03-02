import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
      <div className="py-6 text-center text-muted-foreground">
        <p className="mb-3 text-4xl">👤</p>
        <p className="text-sm">Configuración y logros estarán disponibles próximamente.</p>
      </div>

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
