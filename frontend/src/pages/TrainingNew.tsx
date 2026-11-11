import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Brain,
  Cpu,
  ArrowLeft,
  Play,
  Settings,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Database,
  Layers,
} from 'lucide-react';
import {
  getDatasets,
  getDataset,
  getGPUInfo,
  createTrainingJob,
} from '../services/api';
import { Dataset, DatasetDetail, GPUInfo, TrainingConfig } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

export const TrainingNew: React.FC = () => {
  const navigate = useNavigate();

  const [loadingInit, setLoadingInit] = useState(true);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);

  // Form Fields
  const [jobName, setJobName] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | ''>('');
  const [selectedDatasetDetail, setSelectedDatasetDetail] = useState<DatasetDetail | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [architecture, setArchitecture] = useState('r3d_18');

  // Hyperparameters
  const [epochs, setEpochs] = useState<number>(30);
  const [batchSize, setBatchSize] = useState<number>(2);
  const [learningRate, setLearningRate] = useState<number>(0.001);
  const [weightDecay, setWeightDecay] = useState<number>(0.0001);
  const [optimizer, setOptimizer] = useState<'adam' | 'sgd'>('adam');
  const [scheduler, setScheduler] = useState<'step' | 'cosine'>('step');
  const [clipLength, setClipLength] = useState<number>(16);
  const [resolution, setResolution] = useState<number>(112);

  // Splits
  const [trainSplit, setTrainSplit] = useState<number>(70);
  const [valSplit, setValSplit] = useState<number>(15);
  const [testSplit, setTestSplit] = useState<number>(15);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState<number>(42);
  const [earlyStopping, setEarlyStopping] = useState(true);
  const [earlyStoppingPatience, setEarlyStoppingPatience] = useState<number>(5);
  const [fineTuneStrategy, setFineTuneStrategy] = useState<'head_only' | 'partial' | 'full'>('head_only');
  const [useMixedPrecision, setUseMixedPrecision] = useState(true);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const initData = async () => {
      try {
        setLoadingInit(true);
        const [dsList, gpu] = await Promise.all([
          getDatasets().catch(() => [] as Dataset[]),
          getGPUInfo().catch(() => null),
        ]);
        const readyDatasets = dsList.filter((d) => d.status === 'ready');
        setDatasets(readyDatasets);
        setGpuInfo(gpu);

        if (readyDatasets.length > 0) {
          handleDatasetChange(readyDatasets[0].id);
        }
      } catch (err: any) {
        setFormError('Failed to initialize training form requirements.');
      } finally {
        setLoadingInit(false);
      }
    };
    initData();
  }, []);

  const handleDatasetChange = async (dsId: number) => {
    setSelectedDatasetId(dsId);
    try {
      const detail = await getDataset(dsId);
      setSelectedDatasetDetail(detail);
      const classNames = detail.classes.map((c) => c.name);
      setSelectedClasses(classNames); // default select all classes

      if (!jobName) {
        setJobName(`HAR-${detail.name}-${architecture}`);
      }
    } catch (err) {
      console.error('Failed to load dataset classes:', err);
    }
  };

  const handleToggleClass = (className: string) => {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedDatasetDetail) {
      setSelectedClasses(selectedDatasetDetail.classes.map((c) => c.name));
    }
  };

  const handleDeselectAllClasses = () => {
    setSelectedClasses([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Form validations
    if (!jobName.trim()) {
      setFormError('Job name is required.');
      return;
    }

    if (!selectedDatasetId) {
      setFormError('Please select a training dataset.');
      return;
    }

    if (selectedClasses.length < 2) {
      setFormError('Action recognition requires at least 2 classes selected for classification.');
      return;
    }

    const totalSplit = Number(trainSplit) + Number(valSplit) + Number(testSplit);
    if (totalSplit !== 100) {
      setFormError(`Dataset splits must sum to exactly 100% (currently ${totalSplit}%).`);
      return;
    }

    if (epochs <= 0 || batchSize <= 0 || learningRate <= 0) {
      setFormError('Epochs, batch size, and learning rate must be positive values.');
      return;
    }

    const config: TrainingConfig = {
      name: jobName.trim(),
      dataset_id: Number(selectedDatasetId),
      classes: selectedClasses,
      architecture,
      epochs: Number(epochs),
      batch_size: Number(batchSize),
      learning_rate: Number(learningRate),
      weight_decay: Number(weightDecay),
      optimizer,
      scheduler,
      clip_length: Number(clipLength),
      resolution: Number(resolution),
      train_split: Number(trainSplit),
      val_split: Number(valSplit),
      test_split: Number(testSplit),
      seed: Number(seed),
      early_stopping: earlyStopping,
      early_stopping_patience: Number(earlyStoppingPatience),
      fine_tune_strategy: fineTuneStrategy,
      use_mixed_precision: useMixedPrecision,
    };

    try {
      setIsSubmitting(true);
      const newJob = await createTrainingJob(config);
      navigate(`/training/${newJob.id}`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to trigger training run.');
      setIsSubmitting(false);
    }
  };

  if (loadingInit) {
    return <LoadingSpinner text="Checking GPU environment & datasets..." />;
  }

  const formatMemory = (mb: number | null | undefined) => {
    if (!mb) return 'N/A';
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Top back button */}
      <Link
        to="/training"
        className="text-xs text-gray-400 hover:text-indigo-400 inline-flex items-center gap-1 font-medium"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Training Runs
      </Link>

      {/* GPU Device Overview Banner */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg border ${
              gpuInfo?.cuda_available
                ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-400'
                : 'bg-amber-950/50 border-amber-800/60 text-amber-400'
            }`}
          >
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-200">
                {gpuInfo?.cuda_available ? gpuInfo.gpu_name : 'PyTorch CPU Engine'}
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  gpuInfo?.cuda_available
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                {gpuInfo?.cuda_available ? 'CUDA Active' : 'No CUDA'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              PyTorch {gpuInfo?.pytorch_version || '2.x'} • VRAM:{' '}
              {formatMemory(gpuInfo?.gpu_memory_free)} free / {formatMemory(gpuInfo?.gpu_memory_total)} total
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-400 bg-gray-850 px-3 py-1.5 rounded-lg border border-gray-800">
          Default Batch Size: <span className="font-mono text-indigo-400 font-semibold">2</span> (optimizes for 4-8GB VRAM)
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* 1. General Info & Dataset */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg space-y-5">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            1. Target Dataset & Run Identity
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Run Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g., HarRun-R3D18-Action3"
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Select Dataset <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={selectedDatasetId}
                onChange={(e) => handleDatasetChange(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                {datasets.length === 0 ? (
                  <option value="">No validated datasets found</option>
                ) : (
                  datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.total_videos} videos, {d.total_classes} classes)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Model Architecture Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              3D Backbone Architecture <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-3 p-3 bg-indigo-950/30 border border-indigo-700/60 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="architecture"
                  value="r3d_18"
                  checked={architecture === 'r3d_18'}
                  onChange={(e) => setArchitecture(e.target.value)}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-semibold text-gray-100 block">r3d_18</span>
                  <span className="text-[11px] text-gray-400">ResNet3D 18-layer (Spatiotemporal)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Classes Checklist */}
          {selectedDatasetDetail && (
            <div className="pt-2 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-medium text-gray-300">
                  Select Classes to Train ({selectedClasses.length}/{selectedDatasetDetail.classes.length})
                </label>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllClasses}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllClasses}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-44 overflow-y-auto pr-1">
                {selectedDatasetDetail.classes.map((cls) => {
                  const isChecked = selectedClasses.includes(cls.name);
                  return (
                    <label
                      key={cls.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
                          : 'bg-gray-850/60 border-gray-800 text-gray-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleClass(cls.name)}
                        className="rounded border-gray-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate" title={cls.name}>
                        {cls.name}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto font-mono">
                        ({cls.video_count})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. Core Hyperparameters */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg space-y-5">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            2. Spatiotemporal & Training Hyperparameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Epochs
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Default: 30 epochs</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Batch Size
              </label>
              <input
                type="number"
                min={1}
                max={32}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-amber-400 mt-1 block">Keep low (2-4) for VRAM</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Learning Rate
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.00001"
                max="0.1"
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Default: 0.001</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Weight Decay
              </label>
              <input
                type="number"
                step="0.00001"
                min="0"
                value={weightDecay}
                onChange={(e) => setWeightDecay(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">L2 Regularization</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Optimizer
              </label>
              <select
                value={optimizer}
                onChange={(e) => setOptimizer(e.target.value as any)}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="adam">Adam (Adaptive)</option>
                <option value="sgd">SGD with Momentum</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                LR Scheduler
              </label>
              <select
                value={scheduler}
                onChange={(e) => setScheduler(e.target.value as any)}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="step">StepLR Decay</option>
                <option value="cosine">CosineAnnealingLR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Clip Length (Frames)
              </label>
              <input
                type="number"
                min={8}
                max={64}
                value={clipLength}
                onChange={(e) => setClipLength(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">16 frames standard</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Spatial Resolution
              </label>
              <input
                type="number"
                min={64}
                max={224}
                value={resolution}
                onChange={(e) => setResolution(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">112x112 default crop</span>
            </div>
          </div>
        </div>

        {/* 3. Dataset Splits */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              3. Data Partition Splits (Sum must equal 100%)
            </h3>
            <span
              className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                Number(trainSplit) + Number(valSplit) + Number(testSplit) === 100
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                  : 'bg-red-950/80 text-red-400 border border-red-800'
              }`}
            >
              Total: {Number(trainSplit) + Number(valSplit) + Number(testSplit)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Train Split (%)
              </label>
              <input
                type="number"
                min={10}
                max={90}
                value={trainSplit}
                onChange={(e) => setTrainSplit(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Validation Split (%)
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={valSplit}
                onChange={(e) => setValSplit(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Test Split (%)
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={testSplit}
                onChange={(e) => setTestSplit(Number(e.target.value))}
                className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 4. Advanced Section (Collapsible) */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-850/50 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400" />
              Advanced Training Parameters (Seed, Early Stopping, Fine-Tuning)
            </span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-6 pt-2 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Random Seed
                </label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value))}
                  className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">Deterministic reproducibility</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Fine-Tuning Strategy
                </label>
                <select
                  value={fineTuneStrategy}
                  onChange={(e) => setFineTuneStrategy(e.target.value as any)}
                  className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="head_only">Head Only (Linear Probe - Fast & Low Memory)</option>
                  <option value="partial">Partial (Backbone Layer 4 + Head)</option>
                  <option value="full">Full Network (All 3D CNN Layers)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={earlyStopping}
                    onChange={(e) => setEarlyStopping(e.target.checked)}
                    className="rounded border-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  Enable Early Stopping
                </label>
                {earlyStopping && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-400 block mb-1">Patience (Epochs)</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={earlyStoppingPatience}
                      onChange={(e) => setEarlyStoppingPatience(Number(e.target.value))}
                      className="w-full bg-gray-850 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMixedPrecision}
                    onChange={(e) => setUseMixedPrecision(e.target.checked)}
                    className="rounded border-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  Use Mixed Precision (FP16 / PyTorch AMP)
                </label>
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Reduces GPU memory footprint by ~50% and accelerates tensor operations
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold uppercase tracking-wider transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Initializing Pipeline...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Start Training Job
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TrainingNew;
