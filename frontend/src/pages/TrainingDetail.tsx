import React, { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Brain,
  ArrowLeft,
  StopCircle,
  Box,
  Clock,
  Cpu,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { getTrainingJob, cancelTrainingJob } from '../services/api';
import { TrainingJobDetail } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import MetricsChart from '../components/MetricsChart';
import LoadingSpinner from '../components/LoadingSpinner';
import { usePolling } from '../hooks/usePolling';

export const TrainingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<TrainingJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart view tab: 'all' | 'loss' | 'accuracy' | 'lr'
  const [activeChartTab, setActiveChartTab] = useState<'loss' | 'accuracy' | 'lr'>('loss');

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTrainingJob(Number(id));
      setJob(data);
      setError(null);
    } catch (err: any) {
      if (!job) {
        setError(err.message || 'Failed to fetch job details');
      }
    } finally {
      setLoading(false);
    }
  }, [id, job]);

  // Determine whether to keep polling
  const isJobActive =
    job === null ||
    job.status === 'queued' ||
    job.status === 'preparing' ||
    job.status === 'training' ||
    job.status === 'validating';

  // Use the usePolling hook with 3s interval
  usePolling(fetchJob, 3000, isJobActive, true);

  const handleCancel = async () => {
    if (!job) return;
    try {
      setIsCancelling(true);
      await cancelTrainingJob(job.id);
      setShowCancelDialog(false);
      fetchJob();
    } catch (err: any) {
      alert(`Cancel error: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const calculateElapsedTime = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return 'Queued (awaiting worker)';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diffSec = Math.floor((end - start) / 1000);
    if (diffSec < 0) return '0s';

    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (loading && !job) {
    return <LoadingSpinner text="Connecting to training session stream..." />;
  }

  if (error && !job) {
    return (
      <div className="bg-red-950/40 border border-red-800 rounded-xl p-8 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-red-200">Job Not Found</h3>
        <p className="mt-1 text-sm text-red-400">{error}</p>
        <Link
          to="/training"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-750 text-white rounded-lg text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Training List
        </Link>
      </div>
    );
  }

  if (!job) return null;

  const progressPct =
    job.total_epochs > 0
      ? Math.min(100, Math.round((job.current_epoch / job.total_epochs) * 100))
      : 0;

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/training"
            className="text-xs text-gray-400 hover:text-indigo-400 inline-flex items-center gap-1 mb-2 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Training Runs
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-100">{job.name}</h2>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1 font-mono">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Device: {job.device || 'GPU / Auto'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Elapsed: {calculateElapsedTime(job.started_at, job.completed_at)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              Started: {job.started_at ? new Date(job.started_at).toLocaleTimeString() : 'Pending'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isJobActive && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-semibold transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Cancel Job
            </button>
          )}

          {job.status === 'completed' && (
            <Link
              to="/models"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Box className="w-4 h-4" />
              View in Models
            </Link>
          )}
        </div>
      </div>

      {/* Real-time Status Card (Active, Completed or Failed) */}
      {isJobActive && (
        <div className="bg-gradient-to-r from-indigo-950/40 via-gray-900 to-indigo-950/30 border border-indigo-800/50 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
              </span>
              <span className="font-semibold text-indigo-300 uppercase tracking-wider">
                Live Epoch Iteration in Progress
              </span>
            </div>
            <span className="font-mono text-gray-300 font-semibold">
              Epoch {job.current_epoch} of {job.total_epochs} ({progressPct}%)
            </span>
          </div>

          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500 ease-out glow-indigo"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <span className="text-gray-400 text-[11px] block font-sans">Current Train Loss</span>
              <span className="text-indigo-300 font-bold">
                {job.train_loss !== null ? job.train_loss.toFixed(4) : 'Computing...'}
              </span>
            </div>
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <span className="text-gray-400 text-[11px] block font-sans">Validation Loss</span>
              <span className="text-amber-400 font-bold">
                {job.val_loss !== null ? job.val_loss.toFixed(4) : 'Computing...'}
              </span>
            </div>
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <span className="text-gray-400 text-[11px] block font-sans">Validation Accuracy</span>
              <span className="text-emerald-400 font-bold">
                {job.val_accuracy !== null
                  ? `${(job.val_accuracy > 1 ? job.val_accuracy : job.val_accuracy * 100).toFixed(2)}%`
                  : 'Pending'}
              </span>
            </div>
            <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
              <span className="text-gray-400 text-[11px] block font-sans">Learning Rate</span>
              <span className="text-purple-300 font-bold">
                {job.learning_rate !== null ? job.learning_rate.toExponential(3) : '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Completed Success Banner */}
      {job.status === 'completed' && (
        <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-700/60 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-200">
                Model Training Completed Successfully!
              </h3>
              <p className="text-xs text-emerald-400/80 mt-0.5">
                Best Validation Accuracy:{' '}
                <strong className="text-emerald-300 font-mono text-sm">
                  {job.best_val_accuracy !== null
                    ? `${(job.best_val_accuracy > 1 ? job.best_val_accuracy : job.best_val_accuracy * 100).toFixed(2)}%`
                    : 'N/A'}
                </strong>
                {job.model_path && ` • Checkpoint saved to: ${job.model_path}`}
              </p>
            </div>
          </div>

          <Link
            to="/models"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            Open Registry
          </Link>
        </div>
      )}

      {/* Failed Banner */}
      {job.status === 'failed' && (
        <div className="bg-red-950/30 border border-red-800 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-red-200">Training Job Failed</h3>
            <p className="text-xs text-red-300 font-mono whitespace-pre-wrap leading-relaxed">
              {job.error_message || 'An error terminated the training pipeline.'}
            </p>
          </div>
        </div>
      )}

      {/* Interactive Metric Charts */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Training & Validation Curves
            </h3>
          </div>

          <div className="flex items-center gap-2 bg-gray-850 p-1 rounded-lg border border-gray-750 text-xs font-medium">
            <button
              onClick={() => setActiveChartTab('loss')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeChartTab === 'loss'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Loss Curves
            </button>
            <button
              onClick={() => setActiveChartTab('accuracy')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeChartTab === 'accuracy'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Accuracy Curve
            </button>
            <button
              onClick={() => setActiveChartTab('lr')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeChartTab === 'lr'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Learning Rate
            </button>
          </div>
        </div>

        <MetricsChart metrics={job.metrics || []} chartType={activeChartTab} height={320} />
      </div>

      {/* Epoch Metrics History Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">
            Epoch Metrics History ({job.metrics?.length || 0} epochs logged)
          </h3>
        </div>

        <div className="overflow-x-auto max-h-72">
          {job.metrics && job.metrics.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-850 text-gray-400 font-medium sticky top-0 border-b border-gray-800">
                <tr>
                  <th className="py-2.5 px-4">Epoch</th>
                  <th className="py-2.5 px-4">Train Loss</th>
                  <th className="py-2.5 px-4">Val Loss</th>
                  <th className="py-2.5 px-4">Val Accuracy</th>
                  <th className="py-2.5 px-4">Learning Rate</th>
                  <th className="py-2.5 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-mono">
                {job.metrics.map((m) => (
                  <tr key={m.epoch} className="hover:bg-gray-850/40 transition-colors">
                    <td className="py-2.5 px-4 text-gray-100 font-medium">#{m.epoch}</td>
                    <td className="py-2.5 px-4 text-indigo-400">{m.train_loss.toFixed(4)}</td>
                    <td className="py-2.5 px-4 text-amber-400">
                      {m.val_loss !== null ? m.val_loss.toFixed(4) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-emerald-400 font-bold">
                      {m.val_accuracy !== null
                        ? `${(m.val_accuracy > 1 ? m.val_accuracy : m.val_accuracy * 100).toFixed(2)}%`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-purple-400">
                      {m.learning_rate.toExponential(4)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 font-sans">
                      {m.epoch_time ? `${m.epoch_time.toFixed(1)}s` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-xs text-gray-400">
              No epoch metrics logged yet. Metrics will appear once epoch 1 completes.
            </div>
          )}
        </div>
      </div>

      {/* Hyperparameters Config Summary */}
      {job.config && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-3">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Configured Hyperparameters
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Architecture</span>
              <span className="text-gray-200 font-mono font-medium">
                {job.config.architecture}
              </span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Epochs</span>
              <span className="text-gray-200 font-mono font-medium">{job.config.epochs}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Batch Size</span>
              <span className="text-gray-200 font-mono font-medium">{job.config.batch_size}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Learning Rate</span>
              <span className="text-gray-200 font-mono font-medium">{job.config.learning_rate}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Optimizer</span>
              <span className="text-gray-200 font-mono font-medium uppercase">{job.config.optimizer}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Scheduler</span>
              <span className="text-gray-200 font-mono font-medium uppercase">{job.config.scheduler}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Clip Frames</span>
              <span className="text-gray-200 font-mono font-medium">{job.config.clip_length}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Resolution</span>
              <span className="text-gray-200 font-mono font-medium">{job.config.resolution}x{job.config.resolution}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Splits (T/V/T)</span>
              <span className="text-gray-200 font-mono font-medium">
                {job.config.train_split}/{job.config.val_split}/{job.config.test_split}
              </span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Fine-Tuning</span>
              <span className="text-gray-200 font-mono font-medium">{job.config.fine_tune_strategy}</span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Mixed Precision</span>
              <span className="text-gray-200 font-mono font-medium">
                {job.config.use_mixed_precision ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="bg-gray-850 p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-400 block text-[11px]">Early Stopping</span>
              <span className="text-gray-200 font-mono font-medium">
                {job.config.early_stopping ? `Patience ${job.config.early_stopping_patience}` : 'Off'}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <span className="text-gray-400 block text-xs mb-1">Target Action Classes:</span>
            <div className="flex flex-wrap gap-1.5">
              {job.config.classes?.map((c, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-indigo-300 text-xs"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="Cancel Training Run"
        message={`Are you sure you want to cancel the job "${job.name}"? Progress will halt immediately.`}
        confirmText="Yes, Stop Training"
        variant="warning"
        isLoading={isCancelling}
      />
    </div>
  );
};

export default TrainingDetail;
