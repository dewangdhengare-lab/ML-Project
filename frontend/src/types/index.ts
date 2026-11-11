export interface Dataset {
  id: number;
  name: string;
  description: string | null;
  status: 'uploading' | 'validating' | 'ready' | 'error';
  total_videos: number;
  total_classes: number;
  created_at: string;
  updated_at: string;
}

export interface DatasetClass {
  id: number;
  name: string;
  video_count: number;
  class_index: number;
}

export interface DatasetVideo {
  id: number;
  class_name: string;
  filename: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  frame_count: number | null;
  file_size: number;
  is_valid: boolean;
  error_message: string | null;
}

export interface ValidationReport {
  id: number;
  total_videos: number;
  valid_videos: number;
  invalid_videos: number;
  warnings: string[];
  errors: string[];
  recommendations: string[];
  class_distribution: Record<string, number>;
  created_at: string;
}

export interface DatasetDetail extends Dataset {
  storage_path: string;
  classes: DatasetClass[];
  videos: DatasetVideo[];
  validation_report: ValidationReport | null;
}

export interface TrainingConfig {
  name: string;
  dataset_id: number;
  classes: string[];
  architecture: string;
  epochs: number;
  batch_size: number;
  learning_rate: number;
  weight_decay: number;
  optimizer: string;
  scheduler: string;
  clip_length: number;
  resolution: number;
  train_split: number;
  val_split: number;
  test_split: number;
  seed: number;
  early_stopping: boolean;
  early_stopping_patience: number;
  fine_tune_strategy: string;
  use_mixed_precision: boolean;
}

export interface TrainingJob {
  id: number;
  name: string;
  dataset_id: number;
  dataset_name?: string;
  status: 'queued' | 'preparing' | 'training' | 'validating' | 'completed' | 'failed' | 'cancelled';
  config: TrainingConfig;
  current_epoch: number;
  total_epochs: number;
  train_loss: number | null;
  val_loss: number | null;
  val_accuracy: number | null;
  best_val_accuracy: number | null;
  learning_rate: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  device: string | null;
  created_at: string;
}

export interface TrainingMetric {
  epoch: number;
  train_loss: number;
  val_loss: number | null;
  val_accuracy: number | null;
  learning_rate: number;
  epoch_time: number;
}

export interface TrainingJobDetail extends TrainingJob {
  metrics: TrainingMetric[];
  model_path: string | null;
}

export interface MLModel {
  id: number;
  name: string;
  job_id: number;
  dataset_id: number;
  architecture: string;
  num_classes: number;
  classes: string[];
  accuracy: number;
  model_path: string;
  config: Record<string, any>;
  file_size: number;
  created_at: string;
}

export interface AnalysisResult {
  id: number;
  model_id: number;
  model_name?: string;
  video_filename: string;
  predicted_class: string;
  confidence: number;
  all_predictions: Record<string, number>;
  processing_time: number;
  created_at: string;
}

export interface EnsembleModelResult {
  model_id: number;
  model_name: string;
  architecture: string;
  accuracy: number | null;
  predicted_class: string;
  confidence: number;
  all_predictions: Array<{ class_name: string; confidence: number }>;
}

export interface EnsembleAnalysisResult {
  id: number | null;
  video_filename: string;
  predicted_class: string;
  confidence: number;
  source_model_id: number;
  source_model_name: string;
  model_results: EnsembleModelResult[];
  combined_predictions: Array<{ class_name: string; confidence: number; source_model: string }>;
  total_models_used: number;
  processing_time: number;
}

export interface DashboardStats {
  total_datasets: number;
  total_videos: number;
  total_classes: number;
  training_jobs: {
    total: number;
    completed: number;
    running: number;
    failed: number;
  };
  registered_models: number;
  recent_analyses: AnalysisResult[];
  recent_training: TrainingJob[];
  gpu_available: boolean;
  gpu_name: string | null;
}

export interface GPUInfo {
  cuda_available: boolean;
  gpu_name: string | null;
  gpu_memory_total: number | null;
  gpu_memory_used: number | null;
  gpu_memory_free: number | null;
  cuda_version: string | null;
  pytorch_version: string;
}
