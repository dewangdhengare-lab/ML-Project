import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Trash2,
  Video,
  Calendar,
  Layers,
  HardDrive,
  Award,
  AlertCircle,
  ExternalLink,
  Tag,
  ArrowRight,
  UploadCloud,
  X,
} from 'lucide-react';
import { getModels, deleteModel, importModel } from '../services/api';
import { MLModel } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export const Models: React.FC = () => {
  const navigate = useNavigate();
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import Model modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState('');
  const [importAcc, setImportAcc] = useState('');
  const [importClasses, setImportClasses] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Delete state
  const [modelToDelete, setModelToDelete] = useState<MLModel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getModels();
      setModels(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch registered models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!modelToDelete) return;
    try {
      setIsDeleting(true);
      await deleteModel(modelToDelete.id);
      setModelToDelete(null);
      fetchModels();
    } catch (err: any) {
      alert(`Delete model error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
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
            <Box className="w-6 h-6 text-indigo-400" />
            Trained Model Registry
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Production-ready PyTorch 3D checkpoint weights ready for video inference.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setImportError(null);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            Import (.pth) Checkpoint
          </button>

          <Link
            to="/training/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            Train New Model
          </Link>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingSpinner text="Loading model checkpoints..." />
      ) : error ? (
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-6 text-center max-w-md mx-auto my-8">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={fetchModels}
            className="mt-3 px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      ) : models.length === 0 ? (
        <EmptyState
          icon={Box}
          title="No Models Registered Yet"
          description="You haven't completed any training jobs yet. Start a 3D ResNet training job to generate high-accuracy action recognition models."
          actionLabel="Start Training Run"
          linkTo="/training/new"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {models.map((model) => {
            const accuracyDisplay =
              model.accuracy !== null && model.accuracy !== undefined
                ? (model.accuracy > 1 ? model.accuracy : model.accuracy * 100).toFixed(1)
                : null;

            return (
              <div
                key={model.id}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700/80 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="truncate">
                      <h3 className="font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors truncate" title={model.name}>
                        {model.name}
                      </h3>
                      <span className="text-[11px] font-mono text-gray-400">
                        Backbone: {model.architecture}
                      </span>
                    </div>

                    {accuracyDisplay && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                        <Award className="w-3.5 h-3.5" />
                        {accuracyDisplay}%
                      </span>
                    )}
                  </div>

                  {/* Classes tags */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Tag className="w-3 h-3 text-indigo-400" />
                        Action Classes ({model.num_classes})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {model.classes && model.classes.length > 0 ? (
                        model.classes.map((c, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-gray-850 border border-gray-800 text-gray-300 text-[11px]"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">No classes listed</span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-800/80 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-mono">{formatFileSize(model.file_size)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formatDate(model.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer CTA & Delete */}
                <div className="mt-5 pt-3 border-t border-gray-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setModelToDelete(model)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Delete model checkpoint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => navigate(`/analysis?modelId=${model.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold border border-indigo-500/30 transition-all"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Inference Analysis
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import Model Modal Dialog */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-400" />
                Import External Model Checkpoint (.pth)
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importError && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300">
                {importError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!importFile) {
                  setImportError('Please select a PyTorch .pth or .pt file.');
                  return;
                }
                if (!importName.trim()) {
                  setImportError('Please enter a display name for the model.');
                  return;
                }

                try {
                  setIsImporting(true);
                  setImportError(null);
                  await importModel(
                    importFile,
                    importName.trim(),
                    importAcc ? parseFloat(importAcc) : undefined,
                    importClasses.trim() || undefined
                  );
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportName('');
                  setImportAcc('');
                  setImportClasses('');
                  fetchModels();
                } catch (err: any) {
                  setImportError(err.message || 'Failed to import model');
                } finally {
                  setIsImporting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Model Weights File (.pth / .pt) <span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept=".pth,.pt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setImportFile(f);
                      if (!importName) {
                        setImportName(f.name.replace(/\.[^/.]+$/, ''));
                      }
                    }
                  }}
                  className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-indigo-300 hover:file:bg-gray-750 cursor-pointer"
                  disabled={isImporting}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  e.g. Models trained on Kaggle GPU, Colab, or local checkpoints.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Model Display Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="e.g. R3D-18 Kaggle 224x224 (6 Classes)"
                  className="w-full bg-gray-850 border border-gray-750 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                  disabled={isImporting}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Validation Accuracy (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={importAcc}
                    onChange={(e) => setImportAcc(e.target.value)}
                    placeholder="e.g. 88.5"
                    className="w-full bg-gray-850 border border-gray-750 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                    disabled={isImporting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Classes (comma separated)
                  </label>
                  <input
                    type="text"
                    value={importClasses}
                    onChange={(e) => setImportClasses(e.target.value)}
                    placeholder="running, walking, cooking"
                    className="w-full bg-gray-850 border border-gray-750 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                    disabled={isImporting}
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    (Auto-detected if saved in checkpoint)
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  disabled={isImporting}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Uploading & Registering...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      Register Model
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
        isOpen={Boolean(modelToDelete)}
        onClose={() => setModelToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Model Checkpoint"
        message={`Are you sure you want to delete the model "${modelToDelete?.name}"? Its saved checkpoint weights will be permanently erased.`}
        confirmText="Yes, Delete Model"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default Models;
