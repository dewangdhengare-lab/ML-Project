import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Layers,
  Film,
  Calendar,
  CheckCircle2,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Filter,
  FileCheck2,
  Tag,
  Lightbulb,
  Search,
} from 'lucide-react';
import {
  getDataset,
  deleteDataset,
  validateDataset,
  remapClasses,
} from '../services/api';
import { DatasetDetail as IDatasetDetail, DatasetVideo } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import ClassDistributionChart from '../components/ClassDistributionChart';
import LoadingSpinner from '../components/LoadingSpinner';

export const DatasetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dataset, setDataset] = useState<IDatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Actions state
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Class remapping state
  const [remapping, setRemapping] = useState<Record<string, string>>({});
  const [isRemapping, setIsRemapping] = useState(false);
  const [remapSuccess, setRemapSuccess] = useState<string | null>(null);

  // Video filtering state
  const [classFilter, setClassFilter] = useState<string>('all');
  const [validityFilter, setValidityFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDataset = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getDataset(parseInt(id, 10));
      setDataset(data);

      // Initialize remapping with current class names
      const initialMap: Record<string, string> = {};
      data.classes.forEach((c) => {
        initialMap[c.name] = c.name;
      });
      setRemapping(initialMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataset();
  }, [id]);

  const handleValidate = async () => {
    if (!dataset) return;
    try {
      setIsValidating(true);
      const report = await validateDataset(dataset.id);
      setDataset((prev) => (prev ? { ...prev, validation_report: report, status: 'ready' } : null));
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = async () => {
    if (!dataset) return;
    try {
      setIsDeleting(true);
      await deleteDataset(dataset.id);
      navigate('/datasets');
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataset) return;
    try {
      setIsRemapping(true);
      setRemapSuccess(null);
      await remapClasses(dataset.id, remapping);
      setRemapSuccess('Classes successfully remapped!');
      setTimeout(() => setRemapSuccess(null), 4000);
      fetchDataset();
    } catch (err: any) {
      alert(`Remap error: ${err.message}`);
    } finally {
      setIsRemapping(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return <LoadingSpinner text="Fetching dataset details and video manifests..." />;
  }

  if (error || !dataset) {
    return (
      <div className="bg-red-950/40 border border-red-800 rounded-xl p-8 text-center max-w-lg mx-auto my-12">
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-red-200">Dataset Not Found</h3>
        <p className="mt-1 text-sm text-red-400">{error || 'Could not find the requested dataset.'}</p>
        <Link
          to="/datasets"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-750 text-white rounded-lg text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Datasets
        </Link>
      </div>
    );
  }

  // Filter videos
  const filteredVideos = (dataset.videos || []).filter((v: DatasetVideo) => {
    const matchesClass = classFilter === 'all' || v.class_name === classFilter;
    const matchesValidity =
      validityFilter === 'all'
        ? true
        : validityFilter === 'valid'
        ? v.is_valid
        : !v.is_valid;
    const matchesSearch =
      !searchQuery ||
      v.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.class_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesClass && matchesValidity && matchesSearch;
  });

  const validCount = dataset.videos ? dataset.videos.filter((v) => v.is_valid).length : 0;
  const invalidCount = dataset.videos ? dataset.videos.filter((v) => !v.is_valid).length : 0;

  // Build distribution map
  const classDist: Record<string, number> = {};
  if (dataset.validation_report?.class_distribution) {
    Object.assign(classDist, dataset.validation_report.class_distribution);
  } else if (dataset.classes) {
    dataset.classes.forEach((c) => {
      classDist[c.name] = c.video_count;
    });
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/datasets"
            className="text-xs text-gray-400 hover:text-indigo-400 inline-flex items-center gap-1 mb-2 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Datasets
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-100">{dataset.name}</h2>
            <StatusBadge status={dataset.status} />
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            {dataset.description || 'No description provided.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            {isValidating ? 'Validating Videos...' : 'Run Validation'}
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-red-950/50 hover:text-red-400 text-gray-300 border border-gray-700 hover:border-red-800 rounded-lg text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase">
            <Film className="w-4 h-4 text-indigo-400" />
            Total Videos
          </div>
          <p className="text-2xl font-mono font-bold text-gray-100 mt-2">
            {dataset.total_videos}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 uppercase">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Valid Clips
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400 mt-2">
            {validCount}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-red-400 uppercase">
            <XCircle className="w-4 h-4 text-red-400" />
            Invalid Clips
          </div>
          <p className="text-2xl font-mono font-bold text-red-400 mt-2">
            {invalidCount}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-purple-400 uppercase">
            <Layers className="w-4 h-4 text-purple-400" />
            Activity Classes
          </div>
          <p className="text-2xl font-mono font-bold text-purple-300 mt-2">
            {dataset.total_classes}
          </p>
        </div>
      </div>

      {/* Class Distribution Chart Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Class Distribution
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Breakdown of clip frequencies across action categories
            </p>
          </div>
        </div>
        <ClassDistributionChart distribution={classDist} height={260} />
      </div>

      {/* Validation Report Section (if exists) */}
      {dataset.validation_report && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wider">
                Video Validation Audit Report
              </h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              Audit Date: {new Date(dataset.validation_report.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Errors */}
            <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-xs uppercase mb-2">
                <AlertTriangle className="w-4 h-4" />
                Errors ({dataset.validation_report.errors?.length || 0})
              </div>
              {dataset.validation_report.errors?.length > 0 ? (
                <ul className="text-xs text-red-300/90 space-y-1 list-disc pl-4">
                  {dataset.validation_report.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">No corrupt or unreadable files detected.</p>
              )}
            </div>

            {/* Warnings */}
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase mb-2">
                <AlertTriangle className="w-4 h-4" />
                Warnings ({dataset.validation_report.warnings?.length || 0})
              </div>
              {dataset.validation_report.warnings?.length > 0 ? (
                <ul className="text-xs text-amber-300/90 space-y-1 list-disc pl-4">
                  {dataset.validation_report.warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">Class distributions and durations are balanced.</p>
              )}
            </div>

            {/* Recommendations */}
            <div className="bg-blue-950/20 border border-blue-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs uppercase mb-2">
                <Lightbulb className="w-4 h-4" />
                Recommendations ({dataset.validation_report.recommendations?.length || 0})
              </div>
              {dataset.validation_report.recommendations?.length > 0 ? (
                <ul className="text-xs text-blue-300/90 space-y-1 list-disc pl-4">
                  {dataset.validation_report.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">Dataset is fully ready for 3D CNN training.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Class Remapping Tool */}
      {dataset.classes && dataset.classes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                Class Label Normalization & Remapping
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Rename activity classes or merge multiple labels into unified action names.
              </p>
            </div>
            {remapSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {remapSuccess}
              </span>
            )}
          </div>

          <form onSubmit={handleRemapSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {dataset.classes.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-gray-850 border border-gray-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]" title={cls.name}>
                    {cls.name}
                  </span>
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="text"
                    required
                    value={remapping[cls.name] ?? cls.name}
                    onChange={(e) =>
                      setRemapping((prev) => ({ ...prev, [cls.name]: e.target.value }))
                    }
                    className="w-32 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isRemapping}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRemapping ? 'Applying Remapping...' : 'Save Class Remapping'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Video Manifest Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        {/* Table Filters Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-200">
              Video Clips Manifest ({filteredVideos.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-850 border border-gray-750 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-44"
              />
            </div>

            {/* Class Filter */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-gray-850 border border-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Classes</option>
              {dataset.classes?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.video_count})
                </option>
              ))}
            </select>

            {/* Validity Filter */}
            <select
              value={validityFilter}
              onChange={(e) => setValidityFilter(e.target.value as any)}
              className="bg-gray-850 border border-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Validity</option>
              <option value="valid">Valid Clips Only</option>
              <option value="invalid">Invalid Clips Only</option>
            </select>
          </div>
        </div>

        {/* Video Table Content */}
        <div className="overflow-x-auto">
          {filteredVideos.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-850/80 text-gray-400 font-medium border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Resolution</th>
                  <th className="py-3 px-4">FPS</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-mono">
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-gray-850/40 transition-colors">
                    <td className="py-3 px-4 text-gray-200 font-sans font-medium truncate max-w-[200px]" title={video.filename}>
                      {video.filename}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-sans px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950/70 border border-indigo-800/60 text-indigo-300">
                        {video.class_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {formatDuration(video.duration)}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {video.width && video.height ? `${video.width}x${video.height}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {video.fps ? video.fps.toFixed(1) : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {formatFileSize(video.file_size)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {video.is_valid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Invalid
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-gray-400 text-[11px] truncate max-w-[180px]">
                      {video.error_message || 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400">
              No videos match the current filters.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Dataset"
        message={`Are you sure you want to delete "${dataset.name}"? This action cannot be undone.`}
        confirmText="Yes, Delete Dataset"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DatasetDetail;
