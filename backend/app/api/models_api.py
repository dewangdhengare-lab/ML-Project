import time
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import torch

from app.core.config import settings
from app.core.database import get_db
from app.ml.inference import unload_model
from app.models.models import MLModel
from app.schemas.schemas import MessageResponse, ModelDetailResponse, ModelResponse

router = APIRouter(prefix="/models", tags=["Models"])


@router.post("/import", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def import_model(
    file: UploadFile = File(...),
    name: str = Form(...),
    accuracy: Optional[float] = Form(None),
    classes_str: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Imports an externally trained PyTorch checkpoint (.pth or .pt), e.g., trained on Kaggle GPU.
    Inspects checkpoint metadata (classes, architecture, config) and registers it in the platform registry.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in [".pth", ".pt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid model file format '{ext}'. Must be a PyTorch checkpoint (.pth or .pt).",
        )

    unique_suffix = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    clean_filename = Path(file.filename).name
    save_path = settings.MODELS_DIR / f"{unique_suffix}_{clean_filename}"

    try:
        with open(save_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    except Exception as exc:
        if save_path.exists():
            save_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save model checkpoint: {str(exc)}",
        )

    # Inspect checkpoint
    try:
        ckpt = torch.load(str(save_path), map_location="cpu")
    except Exception as exc:
        if save_path.exists():
            save_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read PyTorch checkpoint file: {str(exc)}",
        )

    parsed_classes = []
    architecture = "r3d_18"
    ckpt_config = {}
    model_accuracy = accuracy

    if isinstance(ckpt, dict):
        if "classes" in ckpt and isinstance(ckpt["classes"], list):
            parsed_classes = ckpt["classes"]
        if "architecture" in ckpt:
            architecture = str(ckpt["architecture"])
        if "config" in ckpt and isinstance(ckpt["config"], dict):
            ckpt_config = ckpt["config"]
        if model_accuracy is None and "accuracy" in ckpt:
            try:
                model_accuracy = float(ckpt["accuracy"])
            except Exception:
                pass

    # If classes provided via form
    if classes_str and not parsed_classes:
        parsed_classes = [c.strip() for c in classes_str.split(",") if c.strip()]

    if not parsed_classes:
        # Default placeholder classes
        parsed_classes = ["class_0", "class_1"]

    # File size
    file_size = save_path.stat().st_size if save_path.exists() else 0

    ml_model = MLModel(
        name=name.strip(),
        architecture=architecture,
        num_classes=len(parsed_classes),
        classes=parsed_classes,
        accuracy=model_accuracy,
        model_path=str(save_path.resolve()),
        config=ckpt_config,
        file_size=file_size,
    )
    db.add(ml_model)
    await db.commit()
    await db.refresh(ml_model)

    return ml_model


@router.get("", response_model=list[ModelResponse])
async def list_models(db: AsyncSession = Depends(get_db)):
    """Lists all registered trained models."""
    stmt = select(MLModel).order_by(MLModel.created_at.desc())
    result = await db.execute(stmt)
    models = result.scalars().all()
    return list(models)


@router.get("/{model_id}", response_model=ModelDetailResponse)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieves metadata and configuration for a specific trained model."""
    stmt = select(MLModel).where(MLModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model #{model_id} not found.",
        )
    return model


@router.delete("/{model_id}", response_model=MessageResponse)
async def delete_model(model_id: int, db: AsyncSession = Depends(get_db)):
    """Deletes a model record from database and its checkpoint file from disk."""
    stmt = select(MLModel).where(MLModel.id == model_id)
    result = await db.execute(stmt)
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model #{model_id} not found.",
        )

    # Unload from GPU/memory cache
    unload_model(model_id)

    # Delete checkpoint file
    p = Path(model.model_path)
    if p.exists() and p.is_file():
        try:
            p.unlink(missing_ok=True)
        except Exception:
            pass

    await db.delete(model)
    await db.commit()

    return MessageResponse(
        message=f"Model #{model_id} ('{model.name}') and its weights file were deleted."
    )
