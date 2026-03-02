"use client";

import dynamic from "next/dynamic";

interface MacroTrendChartPanelProps {
  data: {
    date: string;
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  }[];
  calorieTarget: number;
}

const MacroTrendChart = dynamic(
  () => import("@/components/charts/macro-trend-chart").then((module) => module.MacroTrendChart),
  {
    ssr: false,
    loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-muted" />,
  }
);

export function MacroTrendChartPanel({ data, calorieTarget }: MacroTrendChartPanelProps) {
  return <MacroTrendChart data={data} calorieTarget={calorieTarget} />;
}
