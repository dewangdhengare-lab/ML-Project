from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# General & Helper Schemas
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    message: str
    status: str = "success"


class PredictionDetail(BaseModel):
    class_name: str
    confidence: float


# ---------------------------------------------------------------------------
# Dataset Schemas
# ---------------------------------------------------------------------------

class DatasetClassResponse(BaseModel):
    id: int
    dataset_id: int
    name: str
    video_count: int
    class_index: int

    model_config = ConfigDict(from_attributes=True)


class DatasetVideoResponse(BaseModel):
    id: int
    dataset_id: int
    class_name: Optional[str] = None
    filename: str
    filepath: str
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    frame_count: Optional[int] = None
    file_size: int
    is_valid: bool
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ValidationReportResponse(BaseModel):
    id: int
    dataset_id: int
    total_videos: int
    valid_videos: int
    invalid_videos: int
    warnings: list[str] = []
    errors: list[str] = []
    recommendations: list[str] = []
    class_distribution: dict[str, int] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DatasetResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    status: str
    total_videos: int
    total_classes: int
    storage_path: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetDetailResponse(DatasetResponse):
    classes: list[DatasetClassResponse] = []
    videos: list[DatasetVideoResponse] = []
    validation_reports: list[ValidationReportResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ClassRemapRequest(BaseModel):
    mapping: dict[str, str] = Field(..., description="Mapping from old class names to new class names")


# ---------------------------------------------------------------------------
# Training Schemas
# ---------------------------------------------------------------------------

class TrainingMetricResponse(BaseModel):
    id: int
    job_id: int
    epoch: int
    train_loss: float
    val_loss: Optional[float] = None
    val_accuracy: Optional[float] = None
    learning_rate: float
    epoch_time: float

    model_config = ConfigDict(from_attributes=True)


class TrainingJobCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    dataset_id: int
    classes: Optional[list[str]] = None
    epochs: int = Field(default=15, ge=1, le=200)
    batch_size: int = Field(default=8, ge=1, le=128)
    learning_rate: float = Field(default=1e-4, gt=0)
    weight_decay: Optional[float] = Field(default=1e-4, ge=0)
    optimizer: str = Field(default="adam", description="adam, adamw, or sgd")
    scheduler: str = Field(default="cosine", description="cosine, step, plateau, or none")
    fine_tune_strategy: str = Field(default="partial", description="head_only, partial, or full")
    architecture: str = Field(default="r3d_18")
    clip_length: Optional[int] = Field(default=16, ge=4, le=64)
    num_frames: Optional[int] = Field(default=16, ge=4, le=64)
    resolution: int = Field(default=112, ge=56, le=256)
    patience: Optional[int] = Field(default=5, ge=1, le=50)
    early_stopping: Optional[bool] = True
    early_stopping_patience: Optional[int] = Field(default=5, ge=1, le=50)
    amp: Optional[bool] = Field(default=True, description="Enable automatic mixed precision")
    use_mixed_precision: Optional[bool] = True
    train_split: Optional[float] = None
    val_split: Optional[float] = None
    test_split: Optional[float] = None
    seed: Optional[int] = 42

    model_config = ConfigDict(extra="allow")


class TrainingJobResponse(BaseModel):
    id: int
    name: str
    dataset_id: int
    status: str
    config: dict[str, Any] = {}
    current_epoch: int
    total_epochs: int
    train_loss: Optional[float] = None
    val_loss: Optional[float] = None
    val_accuracy: Optional[float] = None
    best_val_accuracy: Optional[float] = None
    learning_rate: Optional[float] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    device: Optional[str] = None
    model_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrainingJobDetailResponse(TrainingJobResponse):
    metrics: list[TrainingMetricResponse] = []
    dataset: Optional[DatasetResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# ML Model Schemas
# ---------------------------------------------------------------------------

class ModelResponse(BaseModel):
    id: int
    name: str
    job_id: Optional[int] = None
    dataset_id: Optional[int] = None
    architecture: str
    num_classes: int
    classes: list[str] = []
    accuracy: Optional[float] = None
    model_path: str
    config: dict[str, Any] = {}
    file_size: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelDetailResponse(ModelResponse):
    pass


# ---------------------------------------------------------------------------
# Analysis / Inference Schemas
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    id: int
    model_id: int
    video_filename: str
    video_path: str
    predicted_class: str
    confidence: float
    all_predictions: list[dict[str, Any]] = []
    processing_time: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnalysisHistoryResponse(BaseModel):
    analyses: list[AnalysisResponse] = []
    total: int


class EnsembleModelResult(BaseModel):
    """Result from a single model within the ensemble."""
    model_id: int
    model_name: str
    architecture: str
    accuracy: Optional[float] = None
    predicted_class: str
    confidence: float
    all_predictions: list[dict[str, Any]] = []


class EnsembleAnalysisResponse(BaseModel):
    """Combined result from running all models on a single video."""
    id: Optional[int] = None
    video_filename: str
    # Overall best prediction (highest confidence across all models)
    predicted_class: str
    confidence: float
    source_model_id: int
    source_model_name: str
    # Per-model breakdown
    model_results: list[EnsembleModelResult] = []
    # Combined ranked predictions across all models (deduplicated by taking max confidence per class)
    combined_predictions: list[dict[str, Any]] = []
    total_models_used: int
    processing_time: float


# ---------------------------------------------------------------------------
# Dashboard & System Schemas
# ---------------------------------------------------------------------------

class DashboardStatsResponse(BaseModel):
    total_datasets: int
    total_videos: int
    total_classes: int
    training_jobs: dict[str, int]
    registered_models: int
    recent_analyses: list[AnalysisResponse] = []
    recent_training: list[TrainingJobResponse] = []
    gpu_available: bool
    gpu_name: Optional[str] = None


class GPUInfoResponse(BaseModel):
    cuda_available: bool
    gpu_count: int
    gpu_name: Optional[str] = None
    memory_allocated: Optional[float] = None
    memory_reserved: Optional[float] = None
    total_memory: Optional[float] = None
    cuda_version: Optional[str] = None
    pytorch_version: str
    device: str
