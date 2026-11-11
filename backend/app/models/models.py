from datetime import datetime
from typing import Any, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="uploading")  # uploading, validating, ready, error
    total_videos: Mapped[int] = mapped_column(Integer, default=0)
    total_classes: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    classes: Mapped[list["DatasetClass"]] = relationship(
        "DatasetClass", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin"
    )
    videos: Mapped[list["DatasetVideo"]] = relationship(
        "DatasetVideo", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin"
    )
    validation_reports: Mapped[list["ValidationReport"]] = relationship(
        "ValidationReport", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin"
    )
    training_jobs: Mapped[list["TrainingJob"]] = relationship(
        "TrainingJob", back_populates="dataset", cascade="all, delete-orphan", lazy="selectin"
    )


class DatasetClass(Base):
    __tablename__ = "dataset_classes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    video_count: Mapped[int] = mapped_column(Integer, default=0)
    class_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="classes")


class DatasetVideo(Base):
    __tablename__ = "dataset_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    class_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    filepath: Mapped[str] = mapped_column(String(1000), nullable=False)
    duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    frame_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="videos")


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="queued"
    )  # queued, preparing, training, validating, completed, failed, cancelled
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    current_epoch: Mapped[int] = mapped_column(Integer, default=0)
    total_epochs: Mapped[int] = mapped_column(Integer, nullable=False)
    train_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    val_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    val_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    best_val_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    learning_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    device: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="training_jobs")
    metrics: Mapped[list["TrainingMetric"]] = relationship(
        "TrainingMetric",
        back_populates="job",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="TrainingMetric.epoch",
    )


class TrainingMetric(Base):
    __tablename__ = "training_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("training_jobs.id", ondelete="CASCADE"), nullable=False
    )
    epoch: Mapped[int] = mapped_column(Integer, nullable=False)
    train_loss: Mapped[float] = mapped_column(Float, nullable=False)
    val_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    val_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    learning_rate: Mapped[float] = mapped_column(Float, nullable=False)
    epoch_time: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    job: Mapped["TrainingJob"] = relationship("TrainingJob", back_populates="metrics")


class MLModel(Base):
    __tablename__ = "ml_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("training_jobs.id"), nullable=True)
    dataset_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("datasets.id"), nullable=True)
    architecture: Mapped[str] = mapped_column(String(100), default="r3d_18")
    num_classes: Mapped[int] = mapped_column(Integer, nullable=False)
    classes: Mapped[list[str]] = mapped_column(JSON, default=list)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    model_path: Mapped[str] = mapped_column(String(500), nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="model", cascade="all, delete-orphan", lazy="selectin"
    )


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model_id: Mapped[int] = mapped_column(Integer, ForeignKey("ml_models.id"), nullable=False)
    video_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    video_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    predicted_class: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    all_predictions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    processing_time: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    model: Mapped["MLModel"] = relationship("MLModel", back_populates="analyses")


class ValidationReport(Base):
    __tablename__ = "validation_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    total_videos: Mapped[int] = mapped_column(Integer, default=0)
    valid_videos: Mapped[int] = mapped_column(Integer, default=0)
    invalid_videos: Mapped[int] = mapped_column(Integer, default=0)
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    errors: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommendations: Mapped[list[str]] = mapped_column(JSON, default=list)
    class_distribution: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="validation_reports")
