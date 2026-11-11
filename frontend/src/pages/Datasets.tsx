import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Film,
  Upload,
  AlertCircle,
  FileArchive,
  FileVideo,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  getDatasets,
  uploadDatasetZip,
  uploadDatasetVideos,
  deleteDataset,
} from '../services/api';
import { Dataset } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import FileUpload from '../components/FileUpload';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export const Datasets: React.FC = () => {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal / section state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'zip' | 'videos'>('zip');
  const [datasetName, setDatasetName] = useState('');
  const [datasetDescription, setDatasetDescription] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoLabels, setVideoLabels] = useState<string[]>([]);
  const [commonLabel, setCommonLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete dialog state
  const [datasetToDelete, setDatasetToDelete] = useState<Dataset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDatasets();
      setDatasets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleZipFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setZipFile(files[0]);
      if (!datasetName) {
        // Auto-fill dataset name from filename minus extension
        const nameWithoutExt = files[0].name.replace(/\.[^/.]+$/, '');
        setDatasetName(nameWithoutExt);
      }
    } else {
      setZipFile(null);
    }
  };

  const handleVideoFilesSelected = (files: File[]) => {
    setVideoFiles(files);
    // Initialize or adjust videoLabels array
    setVideoLabels((prev) => {
      const next = [...prev];
      while (next.length < files.length) {
        next.push(commonLabel || '');
      }
      return next.slice(0, files.length);
    });
  };

  const applyCommonLabelToAll = () => {
    if (!commonLabel) return;
    setVideoLabels(videoFiles.map(() => commonLabel));
  };

  const handleLabelChange = (index: number, val: string) => {
    const updated = [...videoLabels];
    updated[index] = val;
    setVideoLabels(updated);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasetName.trim()) {
      setUploadError('Please provide a name for the dataset.');
      return;
    }

    try {
      setIsSubmitting(true);
      setUploadError(null);
      setUploadProgress(0);

      if (uploadMode === 'zip') {
        if (!zipFile) {
          setUploadError('Please select a .zip archive file.');
          setIsSubmitting(false);
          return;
        }
        await uploadDatasetZip(
          zipFile,
          datasetName.trim(),
          datasetDescription.trim(),
          (pct) => setUploadProgress(pct)
        );
      } else {
        if (videoFiles.length === 0) {
          setUploadError('Please select at least one video file.');
          setIsSubmitting(false);
          return;
        }
        const hasEmptyLabel = videoLabels.some((l) => !l || !l.trim());
        if (hasEmptyLabel) {
          setUploadError('Please specify an activity class label for every selected video.');
          setIsSubmitting(false);
          return;
        }
        await uploadDatasetVideos(
          videoFiles,
          datasetName.trim(),
          datasetDescription.trim(),
          videoLabels.map((l) => l.trim()),
          (pct) => setUploadProgress(pct)
        );
      }

      // Close modal & reset
      setShowUploadModal(false);
      resetUploadForm();
      fetchDatasets();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const resetUploadForm = () => {
    setDatasetName('');
    setDatasetDescription('');
    setZipFile(null);
    setVideoFiles([]);
    setVideoLabels([]);
    setCommonLabel('');
    setUploadError(null);
    setUploadProgress(null);
  };

  const handleDeleteConfirm = async () => {
    if (!datasetToDelete) return;
    try {
      setIsDeleting(true);
      await deleteDataset(datasetToDelete.id);
      setDatasetToDelete(null);
      fetchDatasets();
    } catch (err: any) {
      alert(`Failed to delete dataset: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            Activity Datasets
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Store video collections organized by action categories for 3D CNN model training.
          </p>
        </div>

        <button
          onClick={() => {
            resetUploadForm();
            setShowUploadModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Upload Dataset
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner text="Loading datasets..." />
      ) : error ? (
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-6 text-center max-w-md mx-auto my-8">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={fetchDatasets}
            className="mt-3 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      ) : datasets.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No Datasets Found"
          description="You haven't uploaded any video activity datasets yet. Upload a ZIP archive or select individual videos to get started."
          actionLabel="Upload First Dataset"
          onAction={() => {
            resetUploadForm();
            setShowUploadModal(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {datasets.map((dataset) => (
            <div
              key={dataset.id}
              onClick={() => navigate(`/datasets/${dataset.id}`)}
              className="bg-gray-900 border border-gray-800 hover:border-gray-700/80 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {dataset.name}
                  </h3>
                  <StatusBadge status={dataset.status} size="sm" />
                </div>

                <p className="text-xs text-gray-400 mt-2 line-clamp-2 min-h-[32px]">
                  {dataset.description || 'No description provided.'}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-800/80 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-indigo-400" />
                    <span>
                      <strong className="text-gray-200 font-mono">{dataset.total_videos}</strong> videos
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>
                      <strong className="text-gray-200 font-mono">{dataset.total_classes}</strong> classes
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(dataset.created_at)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDatasetToDelete(dataset);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Delete dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="p-1.5 text-gray-400 group-hover:text-indigo-400 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dataset Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-850/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-950/80 border border-indigo-800/50 text-indigo-400 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">Upload Dataset</h3>
                  <p className="text-xs text-gray-400">Add videos organized by activity action labels</p>
                </div>
              </div>
              <button
                onClick={() => !isSubmitting && setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Method Tabs */}
            <div className="px-6 pt-4 flex gap-2 border-b border-gray-800">
              <button
                type="button"
                onClick={() => setUploadMode('zip')}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  uploadMode === 'zip'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileArchive className="w-4 h-4" />
                ZIP Archive Upload
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('videos')}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  uploadMode === 'videos'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileVideo className="w-4 h-4" />
                Individual Videos
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Dataset Name */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Dataset Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., UCF101-Subset or Gym-Activities"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-gray-850 border border-gray-700/80 rounded-lg px-3.5 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Description <span className="text-gray-500">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about the video dataset resolution, camera angles, or domain..."
                  value={datasetDescription}
                  onChange={(e) => setDatasetDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-gray-850 border border-gray-700/80 rounded-lg px-3.5 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Upload Mode 1: ZIP Archive */}
              {uploadMode === 'zip' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-300">
                    ZIP Archive (.zip) <span className="text-red-400">*</span>
                  </label>
                  <p className="text-xs text-gray-400">
                    Archive should contain folders named by activity label (e.g., <code className="text-indigo-400">running/01.mp4</code>, <code className="text-indigo-400">walking/02.mp4</code>).
                  </p>
                  <FileUpload
                    onFilesSelected={handleZipFilesSelected}
                    accept=".zip,application/zip"
                    multiple={false}
                    label="Drop dataset .zip file here, or click to browse"
                    uploadProgress={uploadProgress}
                    disabled={isSubmitting}
                  />
                </div>
              ) : (
                /* Upload Mode 2: Multiple Video Files */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Video Files (.mp4, .avi, .mov, .mkv) <span className="text-red-400">*</span>
                    </label>
                    <FileUpload
                      onFilesSelected={handleVideoFilesSelected}
                      accept="video/*,.mp4,.avi,.mov,.mkv"
                      multiple={true}
                      label="Select or drop video clips"
                      uploadProgress={uploadProgress}
                      disabled={isSubmitting}
                    />
                  </div>

                  {videoFiles.length > 0 && (
                    <div className="bg-gray-850/60 border border-gray-800 rounded-lg p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-gray-300">
                          Assign Activity Labels ({videoFiles.length} files)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Common class label"
                            value={commonLabel}
                            onChange={(e) => setCommonLabel(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={applyCommonLabelToAll}
                            className="px-2.5 py-1 bg-gray-750 hover:bg-gray-700 text-gray-200 rounded text-xs transition-colors"
                          >
                            Apply to all
                          </button>
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {videoFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 p-2 bg-gray-900/90 border border-gray-800 rounded text-xs"
                          >
                            <span className="truncate text-gray-300 max-w-[200px]" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-[11px]">Class:</span>
                              <input
                                type="text"
                                required
                                placeholder="e.g., waving"
                                value={videoLabels[idx] || ''}
                                onChange={(e) => handleLabelChange(idx, e.target.value)}
                                className="bg-gray-850 border border-gray-700 rounded px-2 py-0.5 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 w-32"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Uploading & Extracting...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Dataset
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(datasetToDelete)}
        onClose={() => setDatasetToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Dataset"
        message={`Are you sure you want to delete dataset "${datasetToDelete?.name}"? All associated videos, frames, and extracted metadata will be permanently removed.`}
        confirmText="Delete Dataset"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Datasets;
