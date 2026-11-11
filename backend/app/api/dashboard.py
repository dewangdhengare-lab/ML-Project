from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import torch

from app.core.database import get_db
from app.models.models import (
    Analysis,
    Dataset,
    DatasetClass,
    DatasetVideo,
    MLModel,
    TrainingJob,
)
from app.schemas.schemas import DashboardStatsResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns platform-wide summary statistics:
    - Dataset, video, and class counts
    - Model registry count
    - Training job status breakdown
    - Recent analysis predictions
    - Recent training jobs
    - Hardware acceleration info
    """
    # Total datasets
    dataset_count_res = await db.execute(select(func.count(Dataset.id)))
    total_datasets = dataset_count_res.scalar() or 0

    # Total videos (valid videos)
    video_count_res = await db.execute(
        select(func.count(DatasetVideo.id)).where(DatasetVideo.is_valid.is_(True))
    )
    total_videos = video_count_res.scalar() or 0

    # Total classes
    class_count_res = await db.execute(select(func.count(DatasetClass.id)))
    total_classes = class_count_res.scalar() or 0

    # Total ML models
    model_count_res = await db.execute(select(func.count(MLModel.id)))
    registered_models = model_count_res.scalar() or 0

    # Training jobs status breakdown
    jobs_res = await db.execute(select(TrainingJob.status, func.count(TrainingJob.id)).group_by(TrainingJob.status))
    status_counts = dict(jobs_res.all())

    training_jobs_summary = {
        "total": sum(status_counts.values()),
        "completed": status_counts.get("completed", 0),
        "running": status_counts.get("training", 0) + status_counts.get("preparing", 0) + status_counts.get("validating", 0),
        "failed": status_counts.get("failed", 0),
        "queued": status_counts.get("queued", 0),
        "cancelled": status_counts.get("cancelled", 0),
    }

    # Recent 10 analyses
    recent_analyses_res = await db.execute(
        select(Analysis).order_by(Analysis.created_at.desc()).limit(10)
    )
    recent_analyses = recent_analyses_res.scalars().all()

    # Recent 5 training jobs
    recent_training_res = await db.execute(
        select(TrainingJob).order_by(TrainingJob.created_at.desc()).limit(5)
    )
    recent_training = recent_training_res.scalars().all()

    # Hardware detection
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None

    return DashboardStatsResponse(
        total_datasets=total_datasets,
        total_videos=total_videos,
        total_classes=total_classes,
        training_jobs=training_jobs_summary,
        registered_models=registered_models,
        recent_analyses=list(recent_analyses),
        recent_training=list(recent_training),
        gpu_available=gpu_available,
        gpu_name=gpu_name,
    )
