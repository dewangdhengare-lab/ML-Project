import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
}) => {
  const normalized = status.toLowerCase();

  let colorClasses = 'bg-gray-800 text-gray-300 border-gray-700';
  let dotColor = 'bg-gray-400';
  let isPulsing = false;

  switch (normalized) {
    case 'queued':
    case 'uploading':
      colorClasses = 'bg-gray-800/80 text-gray-300 border-gray-700/80';
      dotColor = 'bg-gray-400';
      break;
    case 'preparing':
    case 'validating':
      colorClasses = 'bg-blue-950/60 text-blue-400 border-blue-800/60';
      dotColor = 'bg-blue-400';
      isPulsing = true;
      break;
    case 'training':
      colorClasses = 'bg-indigo-950/70 text-indigo-300 border-indigo-700/70';
      dotColor = 'bg-indigo-400';
      isPulsing = true;
      break;
    case 'completed':
    case 'ready':
      colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      dotColor = 'bg-emerald-400';
      break;
    case 'failed':
    case 'error':
      colorClasses = 'bg-red-950/60 text-red-400 border-red-800/60';
      dotColor = 'bg-red-400';
      break;
    case 'cancelled':
      colorClasses = 'bg-amber-950/60 text-amber-400 border-amber-800/60';
      dotColor = 'bg-amber-400';
      break;
    default:
      colorClasses = 'bg-gray-800 text-gray-300 border-gray-700';
      dotColor = 'bg-gray-400';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide uppercase ${sizeClasses} ${colorClasses}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {isPulsing && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span>{status}</span>
    </span>
  );
};

export default StatusBadge;
