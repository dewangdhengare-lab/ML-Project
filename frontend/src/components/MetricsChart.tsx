import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrainingMetric } from '../types';

interface MetricsChartProps {
  metrics: TrainingMetric[];
  chartType: 'loss' | 'accuracy' | 'lr';
  height?: number;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metrics,
  chartType,
  height = 280,
}) => {
  if (!metrics || metrics.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-gray-800 rounded-xl bg-gray-900/40 text-sm text-gray-500"
        style={{ height }}
      >
        No metric data available yet.
      </div>
    );
  }

  // Format tooltip numbers nicely
  const customTooltipFormatter = (value: any, name: string) => {
    if (typeof value !== 'number') return [value, name];
    if (name.toLowerCase().includes('accuracy')) {
      return [`${(value > 1 ? value : value * 100).toFixed(2)}%`, name];
    }
    if (name.toLowerCase().includes('lr') || name.toLowerCase().includes('learning rate')) {
      return [value.toExponential(4), name];
    }
    return [value.toFixed(4), name];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-semibold text-gray-300 mb-1">Epoch {label}</p>
          {payload.map((entry: any, index: number) => {
            const [val, name] = customTooltipFormatter(entry.value, entry.name);
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {name}:
                </span>
                <span className="font-mono text-gray-200 font-medium">{val}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={metrics} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="epoch"
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={{ stroke: '#374151' }}
            domain={chartType === 'accuracy' ? [0, 'auto'] : ['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-gray-300 font-medium">{value}</span>}
          />

          {chartType === 'loss' && (
            <>
              <Line
                type="monotone"
                dataKey="train_loss"
                name="Train Loss"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="val_loss"
                name="Val Loss"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f59e0b' }}
                activeDot={{ r: 5 }}
              />
            </>
          )}

          {chartType === 'accuracy' && (
            <Line
              type="monotone"
              dataKey="val_accuracy"
              name="Val Accuracy"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981' }}
              activeDot={{ r: 6 }}
            />
          )}

          {chartType === 'lr' && (
            <Line
              type="monotone"
              dataKey="learning_rate"
              name="Learning Rate"
              stroke="#a855f7"
              strokeWidth={2}
              dot={{ r: 3, fill: '#a855f7' }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsChart;
