import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Video,
  Play,
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  BarChart3,
  Calendar,
  AlertCircle,
  Box,
  Layers,
  ArrowRight,
} from 'lucide-react';
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
import {
  getModels,
  predictVideo,
  predictVideoEnsemble,
  getAnalysisHistory,
} from '../services/api';
import { MLModel, AnalysisResult, EnsembleAnalysisResult } from '../types';
import FileUpload from '../components/FileUpload';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export const Analysis: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialModelId = searchParams.get('modelId');

  const [models, setModels] = useState<MLModel[]>([]);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // Form State
  const [selectedModelId, setSelectedModelId] = useState<number | '' | 'ensemble'>(
    initialModelId ? Number(initialModelId) : ''
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Latest Result
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [ensembleResult, setEnsembleResult] = useState<EnsembleAnalysisResult | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoadingInit(true);
        const [modelsData, historyData] = await Promise.all([
          getModels().catch(() => [] as MLModel[]),
          getAnalysisHistory().catch(() => [] as AnalysisResult[]),
        ]);
        setModels(modelsData);
        setHistory(historyData);

        if (modelsData.length > 0 && initialModelId) {
          setSelectedModelId(Number(initialModelId));
        }
      } catch (err: any) {
        setErrorMessage('Failed to load models or history.');
      } finally {
        setLoadingInit(false);
      }
    };
    loadInitial();
  }, []);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setVideoFile(files[0]);
      setErrorMessage(null);
    } else {
      setVideoFile(null);
    }
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setErrorMessage('Please upload a video file for activity classification.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setUploadProgress(0);

      if (selectedModelId === 'ensemble') {
        const result = await predictVideoEnsemble(
          videoFile,
          (pct) => setUploadProgress(pct)
        );
        setEnsembleResult(result);
        setCurrentResult(null);
      } else {
        const result = await predictVideo(
          videoFile,
          selectedModelId ? Number(selectedModelId) : null,
          (pct) => setUploadProgress(pct)
        );
        setCurrentResult(result);
        setEnsembleResult(null);
      }

      // Refresh history
      const updatedHistory = await getAnalysisHistory().catch(() => []);
      setHistory(updatedHistory);
    } catch (err: any) {
      setErrorMessage(err.message || 'Inference analysis failed.');
    } finally {
      setIsAnalyzing(false);
      setUploadProgress(null);
    }
  };

  if (loadingInit) {
    return <LoadingSpinner text="Loading model weights and inference history..." />;
  }

  if (models.length === 0) {
    return (
      <EmptyState
        icon={Box}
        title="No Models Available for Prediction"
        description="You need at least one trained 3D ResNet model checkpoint in the registry to run activity analysis."
        actionLabel="Train Your First Model"
        linkTo="/training/new"
      />
    );
  }

  // Prepare chart data for single-model prediction probabilities
  const chartData = currentResult?.all_predictions
    ? Object.entries(currentResult.all_predictions).map(([className, score]) => ({
        class: className,
        probability: parseFloat(((score > 1 ? score : score * 100)).toFixed(2)),
      })).sort((a, b) => b.probability - a.probability)
    : [];

  const topConfidence = currentResult
    ? (currentResult.confidence > 1 ? currentResult.confidence : currentResult.confidence * 100).toFixed(1)
    : '0';

  // Prepare chart data for ensemble combined predictions
  const ensembleChartData = ensembleResult?.combined_predictions
    ? ensembleResult.combined_predictions.map((pred) => ({
        class: pred.source_model ? `${pred.class_name} (${pred.source_model})` : pred.class_name,
        probability: parseFloat(((pred.confidence > 1 ? pred.confidence : pred.confidence * 100)).toFixed(2)),
      })).sort((a, b) => b.probability - a.probability)
    : [];

  const ensembleTopConfidence = ensembleResult
    ? (ensembleResult.confidence > 1 ? ensembleResult.confidence : ensembleResult.confidence * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <Video className="w-6 h-6 text-indigo-400" />
          Video Activity Inference
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Upload any real-world video clip to classify spatiotemporal human action categories.
        </p>
      </div>

      {/* Grid: Upload & Predict Form vs Prediction Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Form (Left Column) */}
        <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            1. Select Model & Video Clip
          </h3>

          <form onSubmit={handlePredict} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Model Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Target Model Checkpoint <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ensemble') {
                    setSelectedModelId('ensemble');
                  } else if (val === '') {
                    setSelectedModelId('');
                  } else {
                    setSelectedModelId(Number(val));
                  }
                }}
                disabled={isAnalyzing}
                className="w-full bg-gray-850 border border-gray-750 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">⚡ Auto-Detect Best Trained Model (Recommended)</option>
                <option value="ensemble">🔗 Ensemble — Use All Trained Models Combined</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.architecture} • {m.num_classes} classes •{' '}
                    {(m.accuracy > 1 ? m.accuracy : m.accuracy * 100).toFixed(1)}% acc)
                  </option>
                ))}
              </select>
            </div>

            {/* Video File Upload */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Video File (.mp4, .avi, .mov) <span className="text-red-400">*</span>
              </label>
              <FileUpload
                onFilesSelected={handleFilesSelected}
                accept="video/*,.mp4,.avi,.mov"
                multiple={false}
                label="Drop video clip here, or click to browse"
                uploadProgress={uploadProgress}
                disabled={isAnalyzing}
                hint="Supports clips up to 60s for frame-sequence sampling"
              />
            </div>

            {/* Submit Inference Button */}
            <button
              type="submit"
              disabled={isAnalyzing || !videoFile}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  {selectedModelId === 'ensemble' ? 'Running Ensemble Inference...' : 'Running Neural Network Inference...'}
                </>
              ) : (
                <>
                  {selectedModelId === 'ensemble' ? (
                    <Layers className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-white" />
                  )}
                  {selectedModelId === 'ensemble' ? 'Classify with Ensemble' : 'Classify Activity'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Prediction Results Display (Right Column) */}
        <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                {ensembleResult ? (
                  <Layers className="w-4 h-4 text-amber-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                )}
                2. {ensembleResult ? 'Ensemble Classification Output' : 'Classification Output'}
              </h3>
              {currentResult && (
                <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Inference Latency: {(currentResult.processing_time * 1000).toFixed(0)} ms
                </span>
              )}
              {ensembleResult && (
                <span className="text-xs font-mono text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Ensemble Latency: {ensembleResult.processing_time.toFixed(0)} ms
                </span>
              )}
            </div>

            {/* ===== ENSEMBLE RESULTS VIEW ===== */}
            {ensembleResult ? (
              <div className="mt-5 space-y-6">
                {/* Top Prediction Banner */}
                <div className="p-5 rounded-xl bg-gradient-to-r from-amber-950/30 via-gray-850 to-indigo-950/30 border border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 block mb-1 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Top Action Category (Ensemble)
                    </span>
                    <h4 className="text-3xl font-extrabold text-gray-100 tracking-tight">
                      {ensembleResult.predicted_class}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 font-mono truncate max-w-sm">
                      Clip: {ensembleResult.video_filename}
                    </p>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      Detected by: {ensembleResult.source_model_name}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-400 block mb-0.5">Confidence</span>
                    <span className="text-3xl font-bold font-mono text-amber-400">
                      {ensembleTopConfidence}%
                    </span>
                    <p className="text-[10px] text-gray-500 mt-1 font-mono">
                      Analyzed with {ensembleResult.total_models_used} models in {ensembleResult.processing_time.toFixed(0)}ms
                    </p>
                  </div>
                </div>

                {/* Per-Model Breakdown */}
                <div className="space-y-3">
                  <h5 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Per-Model Breakdown ({ensembleResult.model_results.length} models)
                  </h5>

                  <div className="grid grid-cols-1 gap-3">
                    {ensembleResult.model_results.map((modelRes) => {
                      const modelConf = (modelRes.confidence > 1 ? modelRes.confidence : modelRes.confidence * 100).toFixed(1);
                      const top3 = modelRes.all_predictions
                        .map((p) => ({
                          class_name: p.class_name,
                          probability: p.confidence > 1 ? p.confidence : p.confidence * 100,
                        }))
                        .sort((a, b) => b.probability - a.probability)
                        .slice(0, 3);
                      const maxProb = Math.max(...top3.map((t) => t.probability), 1);

                      return (
                        <div
                          key={modelRes.model_id}
                          className="bg-gray-850/60 border border-gray-800 rounded-lg p-4 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h6 className="text-sm font-semibold text-gray-200">
                                {modelRes.model_name}
                              </h6>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-950/60 border border-indigo-800/50 text-indigo-300">
                                {modelRes.architecture}
                              </span>
                              {modelRes.accuracy !== null && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 border border-emerald-800/50 text-emerald-300">
                                  {(modelRes.accuracy > 1 ? modelRes.accuracy : modelRes.accuracy * 100).toFixed(1)}% acc
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-gray-400">Prediction: </span>
                              <span className="text-xs font-semibold text-gray-200">{modelRes.predicted_class}</span>
                              <span className="text-xs font-mono text-emerald-400 ml-1.5">{modelConf}%</span>
                            </div>
                          </div>

                          {/* Mini horizontal bar chart for top 3 classes */}
                          <div className="space-y-1.5">
                            {top3.map((entry, idx) => (
                              <div key={entry.class_name} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-24 truncate text-right" title={entry.class_name}>
                                  {entry.class_name}
                                </span>
                                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-indigo-500/70'}`}
                                    style={{ width: `${(entry.probability / maxProb) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-gray-400 w-12 text-right">
                                  {entry.probability.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Combined Probability Chart */}
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    Combined Probability Distribution
                  </h5>

                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={ensembleChartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 10 }}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="class"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 10 }}
                          width={120}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-900 border border-gray-700 p-2 rounded shadow text-xs">
                                  <p className="font-semibold text-gray-200">
                                    {payload[0].payload.class}
                                  </p>
                                  <p className="text-amber-400 font-mono mt-0.5">
                                    {payload[0].value}% probability
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                          {ensembleChartData.map((entry, index) => (
                            <Cell
                              key={`bar-${index}`}
                              fill={index === 0 ? '#f59e0b' : '#6366f1'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : currentResult ? (
              /* ===== SINGLE MODEL RESULTS VIEW ===== */
              <div className="mt-5 space-y-6">
                {/* Highlight Top Prediction */}
                <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/30 via-gray-850 to-indigo-950/30 border border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 block mb-1">
                      Top Action Category
                    </span>
                    <h4 className="text-3xl font-extrabold text-gray-100 tracking-tight">
                      {currentResult.predicted_class}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 font-mono truncate max-w-sm">
                      Clip: {currentResult.video_filename}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-400 block mb-0.5">Confidence</span>
                    <span className="text-3xl font-bold font-mono text-emerald-400">
                      {topConfidence}%
                    </span>
                  </div>
                </div>

                {/* Probability Distribution Chart */}
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                    Full Softmax Probability Distribution
                  </h5>

                  <div className="h-56 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 10 }}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="class"
                          stroke="#6b7280"
                          tick={{ fill: '#9ca3af', fontSize: 11 }}
                          width={80}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-900 border border-gray-700 p-2 rounded shadow text-xs">
                                  <p className="font-semibold text-gray-200">
                                    {payload[0].payload.class}
                                  </p>
                                  <p className="text-emerald-400 font-mono mt-0.5">
                                    {payload[0].value}% probability
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`bar-${index}`}
                              fill={index === 0 ? '#10b981' : '#6366f1'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center flex flex-col items-center justify-center text-gray-500 space-y-2">
                <Video className="w-12 h-12 text-gray-700 stroke-[1.5]" />
                <p className="text-sm font-medium text-gray-400">Ready for Video Input</p>
                <p className="text-xs text-gray-500 max-w-xs">
                  Choose a model from your registry, select a video file, and trigger classification to see real-time inference.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis History Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-200">
              Inference Log History ({history.length} records)
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          {history.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-850 text-gray-400 font-medium border-b border-gray-800">
                <tr>
                  <th className="py-3 px-4">Video Filename</th>
                  <th className="py-3 px-4">Model Applied</th>
                  <th className="py-3 px-4">Predicted Activity</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Processing Time</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-mono">
                {history.map((record) => {
                  const conf = (record.confidence > 1 ? record.confidence : record.confidence * 100).toFixed(1);
                  return (
                    <tr key={record.id} className="hover:bg-gray-850/40 transition-colors">
                      <td className="py-3 px-4 text-gray-200 truncate max-w-[180px]" title={record.video_filename}>
                        {record.video_filename}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-sans">
                        {record.model_name || `Model #${record.model_id}`}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950/70 border border-indigo-800/60 text-indigo-300">
                          {record.predicted_class}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        {conf}%
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-sans">
                        {record.processing_time ? `${(record.processing_time * 1000).toFixed(0)} ms` : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-sans text-[11px]">
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400">
              No activity predictions in history yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;
