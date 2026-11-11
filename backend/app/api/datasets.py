from datetime import datetime
import os
from pathlib import Path
import shutil
import time
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Dataset, DatasetClass, DatasetVideo, ValidationReport
from app.schemas.schemas import (
    ClassRemapRequest,
    DatasetDetailResponse,
    DatasetResponse,
    MessageResponse,
)
from app.services.dataset_service import (
    delete_dataset_files,
    extract_zip_safely,
    validate_dataset,
)

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.get("", response_model=list[DatasetResponse])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """Lists all datasets with summary counts."""
    stmt = select(Dataset).order_by(Dataset.created_at.desc())
    result = await db.execute(stmt)
    datasets = result.scalars().all()
    return list(datasets)


@router.post("/upload-zip", response_model=DatasetDetailResponse, status_code=status.HTTP_201_CREATED)
async def upload_zip_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Uploads a ZIP archive containing video files structured in class folders.
    Extracts safely, scans all video files, runs OpenCV validation, and stores metadata.
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a .zip archive.",
        )

    unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
    temp_zip_path = settings.UPLOADS_DIR / f"upload_{unique_id}.zip"
    dataset_storage_path = settings.DATASETS_DIR / f"dataset_{unique_id}"

    # Stream upload file to disk in chunks to avoid memory spikes
    try:
        with open(temp_zip_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(chunk)

        # Extract ZIP safely
        extract_zip_safely(
            file_path=temp_zip_path,
            dest_path=dataset_storage_path,
            max_files=settings.MAX_ZIP_FILES,
            max_total_size=settings.MAX_UPLOAD_SIZE,
        )
    except Exception as exc:
        if temp_zip_path.exists():
            temp_zip_path.unlink(missing_ok=True)
        if dataset_storage_path.exists():
            shutil.rmtree(dataset_storage_path, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Archive extraction failed: {str(exc)}",
        )
    finally:
        # Cleanup temporary uploaded zip
        if temp_zip_path.exists():
            temp_zip_path.unlink(missing_ok=True)

    # Create dataset record
    dataset = Dataset(
        name=name.strip(),
        description=description.strip() if description else None,
        status="validating",
        storage_path=str(dataset_storage_path.resolve()),
        total_videos=0,
        total_classes=0,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # Validate dataset videos and generate report
    try:
        await validate_dataset(db, dataset.id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset validation failed: {str(exc)}",
        )

    # Return full dataset details
    stmt = (
        select(Dataset)
        .where(Dataset.id == dataset.id)
        .options(
            selectinload(Dataset.classes),
            selectinload(Dataset.videos),
            selectinload(Dataset.validation_reports),
        )
    )
    res = await db.execute(stmt)
    full_dataset = res.scalar_one()
    return full_dataset


@router.post("/upload-videos", response_model=DatasetDetailResponse, status_code=status.HTTP_201_CREATED)
async def upload_multiple_videos(
    files: list[UploadFile] = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    labels: str = Form(..., description="Comma-separated class names corresponding to files or unique categories"),
    db: AsyncSession = Depends(get_db),
):
    """
    Accepts individual video files and categorizes them into activity classes.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one video file must be uploaded.",
        )

    label_list = [l.strip().replace(" ", "_") for l in labels.split(",") if l.strip()]
    if not label_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one valid class label must be specified.",
        )

    unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
    dataset_storage_path = settings.DATASETS_DIR / f"dataset_{unique_id}"
    dataset_storage_path.mkdir(parents=True, exist_ok=True)

    try:
        for idx, file in enumerate(files):
            ext = Path(file.filename).suffix.lower()
            if ext not in settings.SUPPORTED_VIDEO_EXTENSIONS:
                continue

            # Determine class: 1-to-1 if same length, otherwise look for label prefix or default to first
            if len(label_list) == len(files):
                assigned_class = label_list[idx]
            else:
                assigned_class = None
                for lbl in label_list:
                    if file.filename.lower().startswith(lbl.lower()):
                        assigned_class = lbl
                        break
                if not assigned_class:
                    assigned_class = label_list[idx % len(label_list)]

            class_dir = dataset_storage_path / assigned_class
            class_dir.mkdir(parents=True, exist_ok=True)

            target_file = class_dir / Path(file.filename).name
            with open(target_file, "wb") as buffer:
                while chunk := await file.read(1024 * 1024):
                    buffer.write(chunk)

    except Exception as exc:
        if dataset_storage_path.exists():
            shutil.rmtree(dataset_storage_path, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed saving uploaded video files: {str(exc)}",
        )

    # Create dataset record
    dataset = Dataset(
        name=name.strip(),
        description=description.strip() if description else None,
        status="validating",
        storage_path=str(dataset_storage_path.resolve()),
        total_videos=0,
        total_classes=0,
    )
    db.add(dataset)
    await db.commit()
    await db.refresh(dataset)

    # Validate
    await validate_dataset(db, dataset.id)

    # Return full details
    stmt = (
        select(Dataset)
        .where(Dataset.id == dataset.id)
        .options(
            selectinload(Dataset.classes),
            selectinload(Dataset.videos),
            selectinload(Dataset.validation_reports),
        )
    )
    res = await db.execute(stmt)
    full_dataset = res.scalar_one()
    return full_dataset


@router.get("/{dataset_id}", response_model=DatasetDetailResponse)
async def get_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves full dataset information, classes, videos, and validation reports."""
    stmt = (
        select(Dataset)
        .where(Dataset.id == dataset_id)
        .options(
            selectinload(Dataset.classes),
            selectinload(Dataset.videos),
            selectinload(Dataset.validation_reports),
        )
    )
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset #{dataset_id} not found.",
        )
    return dataset


@router.delete("/{dataset_id}", response_model=MessageResponse)
async def delete_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    """Deletes a dataset, cascading all related records, and deletes files from disk."""
    stmt = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset #{dataset_id} not found.",
        )

    storage_path = dataset.storage_path
    
    # Explicitly remove or decouple associated training jobs and models to prevent integrity issues
    from app.models.models import TrainingJob, MLModel
    from sqlalchemy import delete
    
    await db.execute(delete(TrainingJob).where(TrainingJob.dataset_id == dataset_id))
    await db.execute(delete(MLModel).where(MLModel.dataset_id == dataset_id))
    
    await db.delete(dataset)
    await db.commit()

    delete_dataset_files(storage_path)

    return MessageResponse(
        message=f"Dataset #{dataset_id} ('{dataset.name}') and its files were permanently deleted."
    )


@router.post("/{dataset_id}/validate", response_model=DatasetDetailResponse)
async def revalidate_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    """Re-runs full validation and video decodability checks for a dataset."""
    stmt = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset #{dataset_id} not found.",
        )

    await validate_dataset(db, dataset_id)

    stmt = (
        select(Dataset)
        .where(Dataset.id == dataset_id)
        .options(
            selectinload(Dataset.classes),
            selectinload(Dataset.videos),
            selectinload(Dataset.validation_reports),
        )
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.post("/{dataset_id}/remap-classes", response_model=DatasetDetailResponse)
async def remap_classes(
    dataset_id: int,
    request: ClassRemapRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Renames class folders on disk according to provided mapping,
    then automatically re-validates the dataset.
    """
    stmt = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset #{dataset_id} not found.",
        )

    storage_path = Path(dataset.storage_path)
    if not storage_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset storage directory does not exist on disk.",
        )

    # Rename directories
    for old_name, new_name in request.mapping.items():
        clean_old = old_name.strip()
        clean_new = new_name.strip().replace(" ", "_")
        if clean_old == clean_new:
            continue

        # Look for matching folders
        for class_dir in storage_path.rglob(clean_old):
            if class_dir.is_dir():
                target_new_dir = class_dir.parent / clean_new
                if target_new_dir.exists():
                    # Move files inside
                    for f in class_dir.iterdir():
                        shutil.move(str(f), str(target_new_dir / f.name))
                    shutil.rmtree(str(class_dir), ignore_errors=True)
                else:
                    class_dir.rename(target_new_dir)

    # Re-validate
    await validate_dataset(db, dataset_id)

    stmt = (
        select(Dataset)
        .where(Dataset.id == dataset_id)
        .options(
            selectinload(Dataset.classes),
            selectinload(Dataset.videos),
            selectinload(Dataset.validation_reports),
        )
    )
    res = await db.execute(stmt)
    return res.scalar_one()
