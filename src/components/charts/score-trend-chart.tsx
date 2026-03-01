"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ScoreTrendChartProps {
  data: {
    week: string;
    score: number;
  }[];
}

function getDotColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, "Score"]} />
        <ReferenceLine y={70} stroke="#a3a3a3" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#22c55e"
          strokeWidth={2}
          dot={(dotProps) => {
            const color = getDotColor(Number(dotProps.payload?.score ?? 0));
            return (
              <circle
                cx={dotProps.cx}
                cy={dotProps.cy}
                r={3}
                fill={color}
                stroke={color}
              />
            );
          }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
