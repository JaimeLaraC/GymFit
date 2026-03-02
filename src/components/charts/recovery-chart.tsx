"use client";

import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RecoveryChartProps {
  data: {
    date: string;
    hrv: number | null;
    restingHr: number | null;
    sleep: number | null;
  }[];
}

export function RecoveryChart({ data }: RecoveryChartProps) {
  const chartData = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          formatter={(value, name) => {
            const metricName =
              name === "hrv" ? "HRV (ms)" : name === "restingHr" ? "FC reposo" : "Sueño (h)";
            if (value === null || value === undefined) return ["—", metricName];
            if (name === "sleep") return [`${Number(value).toFixed(1)} h`, metricName];
            return [Number(value).toFixed(1), metricName];
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="hrv"
          name="hrv"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="restingHr"
          name="restingHr"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="sleep"
          name="sleep"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
