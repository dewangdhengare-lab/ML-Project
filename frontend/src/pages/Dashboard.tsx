import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Film,
  Tags,
  Box,
  Cpu,
  PlayCircle,
  CheckCircle,
  AlertOctagon,
  Clock,
  ArrowRight,
  TrendingUp,
  Brain,
  Video,
} from 'lucide-react';
import { getDashboardStats } from '../services/api';
import { DashboardStats } from '../types';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner text="Loading dashboard metrics..." />;
  }

  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800 rounded-xl p-6 text-center max-w-lg mx-auto my-12">
        <AlertOctagon className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-red-200">Failed to Load Dashboard</h3>
        <p className="mt-1 text-sm text-red-400/80">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="No Data Available"
        description="Connect your datasets and begin training your first activity recognition model."
        actionLabel="Go to Datasets"
        linkTo="/datasets"
      />
    );
  }

  const {
    total_datasets,
    total_videos,
    total_classes,
    registered_models,
    gpu_available,
    gpu_name,
    training_jobs,
    recent_training,
    recent_analyses,
  } = stats;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* GPU & Hardware Acceleration Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          gpu_available
            ? 'bg-emerald-950/20 border-emerald-800/40'
            : 'bg-amber-950/20 border-amber-800/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              gpu_available
                ? 'bg-emerald-900/40 border-emerald-700/60 text-emerald-400'
                : 'bg-amber-900/40 border-amber-700/60 text-amber-400'
            }`}
          >
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-100">
                {gpu_available ? 'Hardware Acceleration Enabled' : 'CPU Mode Active'}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  gpu_available
                    ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
                    : 'bg-amber-900/50 text-amber-400 border border-amber-700'
                }`}
              >
                {gpu_available ? 'CUDA Ready' : 'CUDA Unavailable'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Device: {gpu_name || 'Standard Host CPU'} • Ready for 3D CNN inference and training.
            </p>
          </div>
        </div>

        <Link
          to="/training/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
        >
          <PlayCircle className="w-4 h-4" />
          Start Training
        </Link>
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Datasets"
          value={total_datasets}
          icon={Database}
          subtitle="Managed video collections"
          color="indigo"
        />
        <StatsCard
          title="Total Videos"
          value={total_videos}
          icon={Film}
          subtitle="Clips indexed for training"
          color="blue"
        />
        <StatsCard
          title="Activity Classes"
          value={total_classes}
          icon={Tags}
          subtitle="Action categories labeled"
          color="purple"
        />
        <StatsCard
          title="Trained Models"
          value={registered_models}
          icon={Box}
          subtitle="Checkpoints in registry"
          color="emerald"
        />
      </div>

      {/* Training Jobs Summary Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">
              Training Pipeline Overview
            </h2>
          </div>
          <Link
            to="/training"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
          >
            View all jobs <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-850/80 border border-gray-800 p-3.5 rounded-lg">
            <p className="text-xs text-gray-400 font-medium">Total Runs</p>
            <p className="text-2xl font-mono font-bold text-gray-100 mt-1">
              {training_jobs?.total || 0}
            </p>
          </div>
          <div className="bg-gray-850/80 border border-gray-800 p-3.5 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              Running
            </div>
            <p className="text-2xl font-mono font-bold text-indigo-300 mt-1">
              {training_jobs?.running || 0}
            </p>
          </div>
          <div className="bg-gray-850/80 border border-gray-800 p-3.5 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed
            </div>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-1">
              {training_jobs?.completed || 0}
            </p>
          </div>
          <div className="bg-gray-850/80 border border-gray-800 p-3.5 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <AlertOctagon className="w-3.5 h-3.5" />
              Failed
            </div>
            <p className="text-2xl font-mono font-bold text-red-400 mt-1">
              {training_jobs?.failed || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Training & Recent Analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Training Jobs Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-200">Recent Training Jobs</h3>
            </div>
            <Link
              to="/training"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              See all
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recent_training && recent_training.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-850/70 text-gray-400 font-medium border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">Job Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Epoch</th>
                    <th className="py-3 px-4">Val Acc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {recent_training.slice(0, 5).map((job) => (
                    <tr
                      key={job.id}
                      className="hover:bg-gray-850/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          to={`/training/${job.id}`}
                          className="font-medium text-gray-200 hover:text-indigo-400 transition-colors block truncate max-w-[150px]"
                        >
                          {job.name}
                        </Link>
                        <span className="text-[11px] text-gray-400">
                          {job.config?.architecture || 'r3d_18'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={job.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {job.current_epoch}/{job.total_epochs}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        {job.val_accuracy !== null
                          ? `${(job.val_accuracy > 1 ? job.val_accuracy : job.val_accuracy * 100).toFixed(1)}%`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">
                No training jobs recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Recent Analyses Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="p-5 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-gray-200">Recent Action Predictions</h3>
            </div>
            <Link
              to="/analysis"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Analyze video
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recent_analyses && recent_analyses.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-850/70 text-gray-400 font-medium border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">Video Clip</th>
                    <th className="py-3 px-4">Predicted Activity</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {recent_analyses.slice(0, 10).map((res) => (
                    <tr
                      key={res.id}
                      className="hover:bg-gray-850/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-gray-300 truncate max-w-[130px]">
                        {res.video_filename}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2 py-0.5 rounded text-[11px]">
                          {res.predicted_class}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        {(res.confidence > 1 ? res.confidence : res.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400">
                        {res.processing_time ? `${(res.processing_time * 1000).toFixed(0)} ms` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">
                No video analyses performed yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
