"use client";

import dynamic from "next/dynamic";

interface RecoveryChartPanelProps {
  data: {
    date: string;
    hrv: number | null;
    restingHr: number | null;
    sleep: number | null;
  }[];
}

const RecoveryChart = dynamic(
  () => import("@/components/charts/recovery-chart").then((module) => module.RecoveryChart),
  {
    ssr: false,
    loading: () => <div className="h-[250px] animate-pulse rounded-lg bg-muted" />,
  }
);

export function RecoveryChartPanel({ data }: RecoveryChartPanelProps) {
  return <RecoveryChart data={data} />;
}
