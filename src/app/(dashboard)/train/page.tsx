import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TrainPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Entrenar</h1>

            {/* Quick Start */}
            <Card className="border-primary/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Entrenamiento rápido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Empieza una sesión libre o selecciona una rutina.
                    </p>
                    <Button asChild className="w-full" size="lg">
                        <Link href="/train/session/new">▶ Empezar sesión libre</Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Navigation Cards */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/train/exercises">
                    <Card className="cursor-pointer hover:bg-accent transition-colors">
                        <CardContent className="pt-6 text-center">
                            <span className="text-3xl">📚</span>
                            <p className="text-sm font-medium mt-2">Ejercicios</p>
                            <p className="text-xs text-muted-foreground">Biblioteca</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/train/routines">
                    <Card className="cursor-pointer hover:bg-accent transition-colors">
                        <CardContent className="pt-6 text-center">
                            <span className="text-3xl">📋</span>
                            <p className="text-sm font-medium mt-2">Rutinas</p>
                            <p className="text-xs text-muted-foreground">Mis planes</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/train/history">
                    <Card className="cursor-pointer hover:bg-accent transition-colors">
                        <CardContent className="pt-6 text-center">
                            <span className="text-3xl">📖</span>
                            <p className="text-sm font-medium mt-2">Historial</p>
                            <p className="text-xs text-muted-foreground">Sesiones</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/train/programs">
                    <Card className="cursor-pointer hover:bg-accent transition-colors">
                        <CardContent className="pt-6 text-center">
                            <span className="text-3xl">🗓️</span>
                            <p className="text-sm font-medium mt-2">Programas</p>
                            <p className="text-xs text-muted-foreground">Periodización</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
