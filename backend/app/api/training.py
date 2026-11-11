from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Dataset, TrainingJob
from app.schemas.schemas import (
    TrainingJobCreate,
    TrainingJobDetailResponse,
    TrainingJobResponse,
)
from app.worker.training_worker import training_worker

router = APIRouter(prefix="/training", tags=["Training"])


@router.post("/jobs", response_model=TrainingJobResponse, status_code=status.HTTP_201_CREATED)
async def create_training_job(
    payload: TrainingJobCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Submits a new deep learning training job.
    Configures hyperparameters and queues the job for background execution.
    """
    # Verify dataset exists and is ready
    dataset_res = await db.execute(select(Dataset).where(Dataset.id == payload.dataset_id))
    dataset = dataset_res.scalar_one_or_none()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset #{payload.dataset_id} does not exist.",
        )

    if dataset.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataset is in status '{dataset.status}'. Only 'ready' datasets can be used for training.",
        )

    if dataset.total_classes < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataset has only {dataset.total_classes} class. At least 2 classes are required.",
        )

    config_dict = payload.model_dump()

    # Normalize percentage splits if sent as 0-100 values from UI
    val_s = config_dict.get("val_split")
    if val_s is not None and val_s > 1.0:
        config_dict["val_split"] = val_s / 100.0

    test_s = config_dict.get("test_split")
    if test_s is not None and test_s > 1.0:
        config_dict["test_split"] = test_s / 100.0

    train_s = config_dict.get("train_split")
    if train_s is not None and train_s > 1.0:
        config_dict["train_split"] = train_s / 100.0

    # Ensure num_frames is set from clip_length if present
    if "clip_length" in config_dict and "num_frames" not in config_dict:
        config_dict["num_frames"] = config_dict["clip_length"]

    job = TrainingJob(
        name=payload.name.strip(),
        dataset_id=payload.dataset_id,
        status="queued",
        config=config_dict,
        current_epoch=0,
        total_epochs=payload.epochs,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Submit to background training worker
    training_worker.submit_job(job.id)

    return job


@router.get("/jobs", response_model=list[TrainingJobResponse])
async def list_training_jobs(db: AsyncSession = Depends(get_db)):
    """Lists all queued, active, and completed training jobs."""
    stmt = select(TrainingJob).order_by(TrainingJob.created_at.desc())
    result = await db.execute(stmt)
    jobs = result.scalars().all()
    return list(jobs)


@router.get("/jobs/{job_id}", response_model=TrainingJobDetailResponse)
async def get_training_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves full details and epoch-by-epoch training metrics for a job."""
    stmt = (
        select(TrainingJob)
        .where(TrainingJob.id == job_id)
        .options(
            selectinload(TrainingJob.metrics),
            selectinload(TrainingJob.dataset),
        )
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TrainingJob #{job_id} not found.",
        )
    return job


@router.post("/jobs/{job_id}/cancel", response_model=TrainingJobResponse)
async def cancel_training_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """Signals cancellation for a queued or currently executing training job."""
    stmt = select(TrainingJob).where(TrainingJob.id == job_id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"TrainingJob #{job_id} not found.",
        )

    if job.status in {"completed", "failed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is already in terminal state '{job.status}'.",
        )

    training_worker.cancel_job(job_id)

    # Reload job
    await db.refresh(job)
    return job
