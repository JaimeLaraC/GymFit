import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises = [
    // === PECHO ===
    { name: "Press banca", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], pattern: "push", equipment: "barbell", difficulty: "intermediate", minRepRange: 5, maxRepRange: 10, recommendedRIR: 2, cues: ["Retrae escápulas", "Arco torácico", "Agarre algo más ancho que hombros", "Baja controlado al pecho"], commonMistakes: ["Rebotar en el pecho", "Levantar el culo del banco", "Bloquear codos agresivamente"] },
    { name: "Press banca inclinado", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], pattern: "push", equipment: "barbell", difficulty: "intermediate", minRepRange: 6, maxRepRange: 12, recommendedRIR: 2, cues: ["Inclinación ~30°", "Empuja hacia el techo"], commonMistakes: ["Demasiada inclinación (>45°)", "No retraer escápulas"] },
    { name: "Press inclinado mancuernas", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], pattern: "push", equipment: "dumbbell", difficulty: "intermediate", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Rango completo abajo", "Junta las mancuernas arriba"], commonMistakes: ["Poco rango de movimiento", "Peso excesivo"] },
    { name: "Aperturas con cables", primaryMuscle: "chest", secondaryMuscles: [], pattern: "isolation", equipment: "cable", difficulty: "beginner", minRepRange: 10, maxRepRange: 15, recommendedRIR: 1, cues: ["Codos ligeramente flexionados", "Aprieta en el centro"], commonMistakes: ["Convertirlo en press", "Demasiado peso"] },
    { name: "Fondos en paralelas", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], pattern: "push", equipment: "bodyweight", difficulty: "intermediate", minRepRange: 6, maxRepRange: 12, recommendedRIR: 2, cues: ["Inclínate hacia adelante para pecho", "Baja hasta 90° de codo"], commonMistakes: ["Bajar demasiado", "No inclinarse"] },

    // === ESPALDA ===
    { name: "Dominadas", primaryMuscle: "back", secondaryMuscles: ["biceps", "forearms"], pattern: "pull", equipment: "bodyweight", difficulty: "intermediate", minRepRange: 4, maxRepRange: 10, recommendedRIR: 2, cues: ["Agarre pronado ancho", "Lleva el pecho a la barra", "Controla la bajada"], commonMistakes: ["Kipping", "No bajar del todo", "Solo subir la barbilla"] },
    { name: "Remo con barra", primaryMuscle: "back", secondaryMuscles: ["biceps", "rear_delts"], pattern: "pull", equipment: "barbell", difficulty: "intermediate", minRepRange: 6, maxRepRange: 10, recommendedRIR: 2, cues: ["Torso 45-60°", "Tira hacia el ombligo", "Aprieta escápulas arriba"], commonMistakes: ["Usar mucho impulso", "Torso demasiado vertical"] },
    { name: "Jalón al pecho", primaryMuscle: "back", secondaryMuscles: ["biceps"], pattern: "pull", equipment: "cable", difficulty: "beginner", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Pecho fuera", "Tira con los codos", "Aprieta abajo"], commonMistakes: ["Tirar con los brazos", "Inclinarse demasiado atrás"] },
    { name: "Remo con mancuerna", primaryMuscle: "back", secondaryMuscles: ["biceps", "rear_delts"], pattern: "pull", equipment: "dumbbell", difficulty: "beginner", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Apoya rodilla y mano en banco", "Tira del codo hacia la cadera"], commonMistakes: ["Rotar el torso", "Poco rango"] },
    { name: "Remo en polea baja", primaryMuscle: "back", secondaryMuscles: ["biceps", "rear_delts"], pattern: "pull", equipment: "cable", difficulty: "beginner", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Pecho al frente", "Aprieta escápulas atrás"], commonMistakes: ["Balancear el torso", "No estirar bien"] },

    // === CUÁDRICEPS ===
    { name: "Sentadilla", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings"], pattern: "squat", equipment: "barbell", difficulty: "advanced", minRepRange: 4, maxRepRange: 8, recommendedRIR: 2, cues: ["Barra en trapecios", "Rompe con caderas y rodillas a la vez", "Rodillas hacia fuera", "Profundidad: paralelo o más"], commonMistakes: ["Valgo de rodillas", "Butt wink", "Levantar talones"] },
    { name: "Prensa de piernas", primaryMuscle: "quads", secondaryMuscles: ["glutes"], pattern: "squat", equipment: "machine", difficulty: "beginner", minRepRange: 8, maxRepRange: 15, recommendedRIR: 2, cues: ["Pies a la anchura de hombros", "No bloquear rodillas arriba"], commonMistakes: ["Levantar el culo del asiento", "Poco rango"] },
    { name: "Extensión de cuádriceps", primaryMuscle: "quads", secondaryMuscles: [], pattern: "isolation", equipment: "machine", difficulty: "beginner", minRepRange: 10, maxRepRange: 15, recommendedRIR: 1, cues: ["Aprieta arriba 1 segundo", "Controla la bajada"], commonMistakes: ["Impulso", "No rango completo"] },
    { name: "Sentadilla búlgara", primaryMuscle: "quads", secondaryMuscles: ["glutes"], pattern: "squat", equipment: "dumbbell", difficulty: "intermediate", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Pie trasero en banco", "Torso vertical", "Rodilla delantera sobre el pie"], commonMistakes: ["Pie delantero demasiado cerca", "Inclinarse adelante"] },

    // === ISQUIOTIBIALES ===
    { name: "Peso muerto rumano", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "back"], pattern: "hinge", equipment: "barbell", difficulty: "intermediate", minRepRange: 6, maxRepRange: 10, recommendedRIR: 2, cues: ["Barra pegada al cuerpo", "Empuja caderas atrás", "Siente el estiramiento en isquios"], commonMistakes: ["Redondear la espalda", "Flexionar rodillas como sentadilla"] },
    { name: "Curl femoral tumbado", primaryMuscle: "hamstrings", secondaryMuscles: [], pattern: "isolation", equipment: "machine", difficulty: "beginner", minRepRange: 10, maxRepRange: 15, recommendedRIR: 1, cues: ["Caderas pegadas al pad", "Aprieta arriba"], commonMistakes: ["Levantar caderas", "Impulso"] },

    // === HOMBROS ===
    { name: "Press militar", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], pattern: "push", equipment: "barbell", difficulty: "intermediate", minRepRange: 6, maxRepRange: 10, recommendedRIR: 2, cues: ["Core apretado", "Empuja vertical", "Mete la cabeza entre los brazos arriba"], commonMistakes: ["Arquear la espalda", "Empujar hacia adelante"] },
    { name: "Elevaciones laterales", primaryMuscle: "lateral_delts", secondaryMuscles: [], pattern: "isolation", equipment: "dumbbell", difficulty: "beginner", minRepRange: 12, maxRepRange: 20, recommendedRIR: 1, cues: ["Codos ligeramente flexionados", "Sube hasta paralelo", "Meñique apunta arriba"], commonMistakes: ["Usar trapecios", "Demasiado peso", "Balancear el cuerpo"] },
    { name: "Face pull", primaryMuscle: "rear_delts", secondaryMuscles: ["traps"], pattern: "pull", equipment: "cable", difficulty: "beginner", minRepRange: 12, maxRepRange: 20, recommendedRIR: 1, cues: ["Tira hacia la frente", "Rotación externa arriba", "Codos altos"], commonMistakes: ["Peso excesivo", "Tirar solo hacia atrás"] },

    // === BÍCEPS ===
    { name: "Curl con barra", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], pattern: "pull", equipment: "barbell", difficulty: "beginner", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Codos pegados al cuerpo", "Contrae arriba"], commonMistakes: ["Balancear el cuerpo", "Codos adelantados"] },
    { name: "Curl con mancuernas", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], pattern: "pull", equipment: "dumbbell", difficulty: "beginner", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Supinación al subir", "Controla la bajada"], commonMistakes: ["Impulso", "No bajar del todo"] },
    { name: "Curl en polea", primaryMuscle: "biceps", secondaryMuscles: [], pattern: "isolation", equipment: "cable", difficulty: "beginner", minRepRange: 10, maxRepRange: 15, recommendedRIR: 1, cues: ["Tensión constante", "Aprieta arriba"], commonMistakes: ["Codos moviéndose", "Peso excesivo"] },

    // === TRÍCEPS ===
    { name: "Press francés", primaryMuscle: "triceps", secondaryMuscles: [], pattern: "push", equipment: "barbell", difficulty: "intermediate", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Baja detrás de la cabeza", "Codos apuntando al techo"], commonMistakes: ["Abrir los codos", "Bajar a la frente en vez de detrás"] },
    { name: "Extensión de tríceps en polea", primaryMuscle: "triceps", secondaryMuscles: [], pattern: "isolation", equipment: "cable", difficulty: "beginner", minRepRange: 10, maxRepRange: 15, recommendedRIR: 1, cues: ["Codos pegados al cuerpo", "Extiende completamente"], commonMistakes: ["Mover los codos", "Inclinarse sobre la polea"] },

    // === GLÚTEOS ===
    { name: "Hip thrust", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], pattern: "hinge", equipment: "barbell", difficulty: "intermediate", minRepRange: 8, maxRepRange: 12, recommendedRIR: 2, cues: ["Espalda alta en banco", "Aprieta glúteos arriba", "Mentón al pecho"], commonMistakes: ["Hiperextender la lumbar", "No apretar arriba"] },

    // === CORE ===
    { name: "Plancha", primaryMuscle: "abs", secondaryMuscles: [], pattern: "isolation", equipment: "bodyweight", difficulty: "beginner", minRepRange: 30, maxRepRange: 60, recommendedRIR: 2, cues: ["Cuerpo recto", "Aprieta core y glúteos", "No subir caderas"], commonMistakes: ["Caderas caídas", "Aguantar la respiración"] },
    { name: "Ab wheel", primaryMuscle: "abs", secondaryMuscles: [], pattern: "isolation", equipment: "bodyweight", difficulty: "advanced", minRepRange: 6, maxRepRange: 12, recommendedRIR: 2, cues: ["Core activado antes de empezar", "Extiende lo que puedas controlar"], commonMistakes: ["Colapsar la lumbar", "No controlar la vuelta"] },
];

async function main() {
    console.log("🌱 Seeding exercises...");

    // Create default user
    const user = await prisma.user.upsert({
        where: { id: "default-user" },
        update: {},
        create: {
            id: "default-user",
            name: "Jaime",
            level: "intermediate",
            goal: "hypertrophy",
        },
    });
    console.log(`👤 User: ${user.name}`);

    // Seed exercises
    for (const ex of exercises) {
        await prisma.exercise.upsert({
            where: {
                id: ex.name.toLowerCase().replace(/\s+/g, "-").replace(/[áéíóú]/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[c] || c)),
            },
            update: ex,
            create: {
                id: ex.name.toLowerCase().replace(/\s+/g, "-").replace(/[áéíóú]/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" }[c] || c)),
                ...ex,
            },
        });
    }

    console.log(`📚 Seeded ${exercises.length} exercises`);
    console.log("✅ Seed complete!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
