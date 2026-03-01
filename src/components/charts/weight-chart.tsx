"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WeightChartProps {
  data: {
    date: string;
    weight: number;
    smoothed: number;
  }[];
}

export function WeightChart({ data }: WeightChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value, name) => [
            `${Number(value ?? 0).toFixed(1)} kg`,
            name === "smoothed" ? "Peso suavizado" : "Peso",
          ]}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
        <Line
          type="monotone"
          dataKey="smoothed"
          stroke="#22c55e"
          strokeDasharray="6 4"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
