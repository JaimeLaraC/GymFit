import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function HomePage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">GymFit</h1>
                    <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString("es-ES", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                        })}
                    </p>
                </div>
            </div>

            {/* Score Card (placeholder) */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Score Global
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold font-mono text-primary">
                            --
                        </span>
                        <span className="text-sm text-muted-foreground">/ 100</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Empieza a entrenar para calcular tu score
                    </p>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Próxima sesión</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        No tienes rutinas configuradas aún.
                    </p>
                    <div className="flex gap-2">
                        <Button asChild size="sm">
                            <Link href="/train">🏋️ Entrenar</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/train/exercises">📚 Ver ejercicios</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Weekly Summary (placeholder) */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resumen semanal</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold font-mono">0</p>
                            <p className="text-xs text-muted-foreground">Sesiones</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold font-mono">0</p>
                            <p className="text-xs text-muted-foreground">Series</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold font-mono">0</p>
                            <p className="text-xs text-muted-foreground">Vol. (kg)</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
