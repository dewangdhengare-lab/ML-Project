import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface ClassDistributionChartProps {
  distribution: Record<string, number>;
  height?: number;
}

export const ClassDistributionChart: React.FC<ClassDistributionChartProps> = ({
  distribution,
  height = 280,
}) => {
  const data = Object.entries(distribution || {}).map(([name, count]) => ({
    name,
    count,
  }));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-gray-800 rounded-xl bg-gray-900/40 text-sm text-gray-500"
        style={{ height }}
      >
        No class distribution data available.
      </div>
    );
  }

  // Soft palette for bars
  const colors = [
    '#6366f1', // indigo-500
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#8b5cf6', // purple-500
    '#06b6d4', // cyan-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#14b8a6', // teal-500
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 p-2.5 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-gray-200">{item.name}</p>
          <p className="text-indigo-400 mt-1">
            <span className="font-mono font-medium">{item.count}</span> video{item.count === 1 ? '' : 's'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
            interval={0}
            angle={-25}
            textAnchor="end"
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ClassDistributionChart;
