import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Brain,
  Plus,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Percent,
  Layers,
  Cpu,
  StopCircle,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { getTrainingJobs, cancelTrainingJob } from '../services/api';
import { TrainingJob } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export const Training: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Cancel dialog state
  const [jobToCancel, setJobToCancel] = useState<TrainingJob | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTrainingJobs();
      setJobs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch training jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCancelConfirm = async () => {
    if (!jobToCancel) return;
    try {
      setIsCancelling(true);
      await cancelTrainingJob(jobToCancel.id);
      setJobToCancel(null);
      fetchJobs();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const calculateElapsedTime = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return 'Not started';
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diffSec = Math.floor((end - start) / 1000);
    if (diffSec < 0) return '0s';

    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const filteredJobs = jobs.filter((j) => {
    if (statusFilter === 'all') return true;
    return j.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-400" />
            Training Pipeline Runs
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            PyTorch 3D ResNet training tasks with real-time gradient descent monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-850 border border-gray-750 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="training">Training (Active)</option>
            <option value="queued">Queued</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Link
            to="/training/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Training Job
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner text="Loading training runs..." />
      ) : error ? (
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-6 text-center max-w-md mx-auto my-8">
          <AlertOctagon className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={fetchJobs}
            className="mt-3 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No Training Jobs"
          description={
            statusFilter === 'all'
              ? "You haven't initiated any model training runs yet. Configure hyperparameters and start your first 3D CNN model training."
              : `No training runs matching status "${statusFilter}".`
          }
          actionLabel="Configure New Job"
          linkTo="/training/new"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => {
            const isRunning =
              job.status === 'training' ||
              job.status === 'preparing' ||
              job.status === 'validating';
            const progressPct =
              job.total_epochs > 0
                ? Math.min(100, Math.round((job.current_epoch / job.total_epochs) * 100))
                : 0;

            return (
              <div
                key={job.id}
                onClick={() => navigate(`/training/${job.id}`)}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {job.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {job.dataset_name ? `Dataset: ${job.dataset_name}` : `Dataset #${job.dataset_id}`}
                      </p>
                    </div>
                    <StatusBadge status={job.status} size="sm" />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
                      <span>Epoch {job.current_epoch} / {job.total_epochs}</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          job.status === 'completed'
                            ? 'bg-emerald-500'
                            : job.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-indigo-600'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics snapshot */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-800/80 text-xs">
                    <div>
                      <span className="text-gray-400 text-[11px] block">Validation Acc</span>
                      <span className="text-emerald-400 font-mono font-bold text-sm">
                        {job.best_val_accuracy !== null
                          ? `${(job.best_val_accuracy > 1 ? job.best_val_accuracy : job.best_val_accuracy * 100).toFixed(1)}%`
                          : job.val_accuracy !== null
                          ? `${(job.val_accuracy > 1 ? job.val_accuracy : job.val_accuracy * 100).toFixed(1)}%`
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Train Loss</span>
                      <span className="text-gray-200 font-mono font-medium text-sm">
                        {job.train_loss !== null ? job.train_loss.toFixed(4) : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer with runtime info & actions */}
                <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{calculateElapsedTime(job.started_at, job.completed_at)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isRunning && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setJobToCancel(job);
                        }}
                        className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded border border-amber-800/50 transition-colors flex items-center gap-1"
                        title="Cancel training"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    )}
                    <span className="p-1 text-gray-400 group-hover:text-indigo-400 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(jobToCancel)}
        onClose={() => setJobToCancel(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Training Run"
        message={`Are you sure you want to cancel the job "${jobToCancel?.name}"? The current model weights will be stopped at epoch ${jobToCancel?.current_epoch}.`}
        confirmText="Yes, Stop Training"
        variant="warning"
        isLoading={isCancelling}
      />
    </div>
  );
};

export default Training;
