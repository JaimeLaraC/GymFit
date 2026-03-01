"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WeeklyVolumeChartDatum {
  week: string;
  volume: number;
  effectiveSets: number;
  totalSets: number;
}

interface WeeklyVolumeChartProps {
  data: WeeklyVolumeChartDatum[];
}

export function WeeklyVolumeChart({ data }: WeeklyVolumeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis yAxisId="volume" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis yAxisId="sets" orientation="right" hide />
        <Tooltip
          formatter={(value, name) => {
            const numericValue = Number(value ?? 0);
            if (name === "volume") return [`${Math.round(numericValue)} kg`, "Volumen"];
            if (name === "effectiveSets") return [`${numericValue}`, "Series efectivas"];
            return [`${numericValue}`, "Series totales"];
          }}
        />
        <Bar yAxisId="volume" dataKey="volume" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="sets" dataKey="effectiveSets" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
