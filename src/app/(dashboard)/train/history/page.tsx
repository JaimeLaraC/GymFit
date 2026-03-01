import { prisma } from "@/lib/prisma";
import { SessionHistory } from "./session-history";

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

const DEFAULT_USER_ID = "default-user";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const sessions = await prisma.session.findMany({
    where: { userId: DEFAULT_USER_ID, status: "completed" },
    orderBy: { date: "desc" },
    take: 50,
    include: {
      workoutSets: {
        select: {
          id: true,
          exerciseId: true,
          reps: true,
          weight: true,
          rir: true,
        },
      },
      routine: {
        select: { name: true },
      },
    },
  });

  const parsedSessions: SessionHistoryItem[] = sessions.map((session) => ({
    id: session.id,
    date: session.date.toISOString(),
    durationMin: session.durationMin,
    overallRPE: session.overallRPE,
    routineName: session.routine?.name ?? null,
    workoutSets: session.workoutSets,
  }));

  return <SessionHistory sessions={parsedSessions} />;
}
