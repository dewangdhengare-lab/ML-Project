import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'blue' | 'purple';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  color = 'indigo',
}) => {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-950/40',
      border: 'border-indigo-800/40',
      text: 'text-indigo-400',
      glow: 'group-hover:border-indigo-700/60',
    },
    emerald: {
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-800/40',
      text: 'text-emerald-400',
      glow: 'group-hover:border-emerald-700/60',
    },
    amber: {
      bg: 'bg-amber-950/40',
      border: 'border-amber-800/40',
      text: 'text-amber-400',
      glow: 'group-hover:border-amber-700/60',
    },
    red: {
      bg: 'bg-red-950/40',
      border: 'border-red-800/40',
      text: 'text-red-400',
      glow: 'group-hover:border-red-700/60',
    },
    blue: {
      bg: 'bg-blue-950/40',
      border: 'border-blue-800/40',
      text: 'text-blue-400',
      glow: 'group-hover:border-blue-700/60',
    },
    purple: {
      bg: 'bg-purple-950/40',
      border: 'border-purple-800/40',
      text: 'text-purple-400',
      glow: 'group-hover:border-purple-700/60',
    },
  }[color];

  return (
    <div className={`group bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg transition-all duration-200 hover:shadow-xl ${colorMap.glow}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
          {title}
        </span>
        <div className={`p-2.5 rounded-lg border ${colorMap.bg} ${colorMap.border} ${colorMap.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-100 font-mono">
          {value}
        </div>

        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend.isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      {subtitle && <p className="mt-1.5 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
};

export default StatsCard;
