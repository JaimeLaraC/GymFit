"use client";

import {
  Bar,
  BarChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MacroTrendChartProps {
  data: {
    date: string;
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  }[];
  calorieTarget: number;
}

export function MacroTrendChart({ data, calorieTarget }: MacroTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="protein" name="Proteína" stackId="macros" fill="#22c55e" />
        <Bar dataKey="carbs" name="Carbos" stackId="macros" fill="#3b82f6" />
        <Bar dataKey="fat" name="Grasa" stackId="macros" fill="#eab308" />
        <ReferenceLine
          y={calorieTarget}
          stroke="#ef4444"
          strokeDasharray="5 5"
          label={{ value: "Objetivo kcal", position: "top", fill: "#ef4444", fontSize: 10 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
