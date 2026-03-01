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

interface VolumeChartDatum {
  muscle: string;
  sets: number;
  label: string;
}

interface VolumeChartProps {
  data: VolumeChartDatum[];
}

export function VolumeChart({ data }: VolumeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
        layout="vertical"
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={90}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--accent)" }}
          formatter={(value) => [`${Number(value ?? 0)} series`, "Series"]}
        />
        <Bar dataKey="sets" fill="#22c55e" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
