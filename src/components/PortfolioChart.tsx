import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PortfolioSnapshot } from "../types";

interface Props {
  snapshots: PortfolioSnapshot[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function formatEur(value: number): string {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function PortfolioChart({ snapshots }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data to chart yet.
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: formatDate(s.date),
    portfolioValue: Math.round(s.globalPortfolioValue * 100) / 100,
    acquisitionCost: Math.round(s.totalAcquisitionCost * 100) / 100,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => formatEur(v)}
            width={100}
          />
          <Tooltip
            formatter={(value) => typeof value === "number" ? formatEur(value) : String(value)}
            labelStyle={{ fontWeight: "bold" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="portfolioValue"
            stroke="#6366f1"
            strokeWidth={2}
            name="Portfolio Value"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="acquisitionCost"
            stroke="#f59e0b"
            strokeWidth={2}
            name="Acquisition Cost"
            dot={false}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
