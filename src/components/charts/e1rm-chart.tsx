"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface E1RMChartDatum {
  date: string;
  e1rm: number;
}

interface E1RMChartProps {
  data: E1RMChartDatum[];
  exerciseName: string;
}

export function E1RMChart({ data, exerciseName }: E1RMChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${Number(value ?? 0)} kg`, "e1RM"]}
          labelFormatter={(label) => `${exerciseName} · ${label}`}
        />
        <Line
          type="monotone"
          dataKey="e1rm"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
