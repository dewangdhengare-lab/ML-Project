from pathlib import Path
import time
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.ml.inference import predict_video
from app.models.models import Analysis, MLModel
from app.schemas.schemas import (
    AnalysisHistoryResponse,
    AnalysisResponse,
    EnsembleAnalysisResponse,
    EnsembleModelResult,
)

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.post("/predict", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
async def analyze_video(
    file: UploadFile = File(...),
    model_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Performs Human Activity Recognition inference on an uploaded video file.
    If model_id is not specified, automatically selects the best/latest trained model.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.SUPPORTED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported video extension '{ext}'. Allowed: {settings.SUPPORTED_VIDEO_EXTENSIONS}",
        )

    # Verify or auto-select model
    if model_id is not None:
        stmt = select(MLModel).where(MLModel.id == model_id)
        result = await db.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model #{model_id} not found.",
            )
    else:
        # Automatically choose best model by accuracy, or most recently trained
        stmt = select(MLModel).order_by(MLModel.accuracy.desc().nullslast(), MLModel.created_at.desc())
        result = await db.execute(stmt)
        model = result.scalars().first()
        if not model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No trained models available for analysis. Please train a model first in the Training Center.",
            )

    # Save uploaded video
    unique_suffix = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    clean_filename = Path(file.filename).name
    save_path = settings.ANALYSES_DIR / f"{unique_suffix}_{clean_filename}"

    try:
        with open(save_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    except Exception as exc:
        if save_path.exists():
            save_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save video for inference: {str(exc)}",
        )

    # Determine frames and resolution from model config
    config = model.config or {}
    num_frames = int(config.get("num_frames", settings.DEFAULT_NUM_FRAMES))
    res = int(config.get("resolution", settings.DEFAULT_RESOLUTION))

    # Run inference
    try:
        prediction = predict_video(
            model_id=model.id,
            model_path=model.model_path,
            video_path=save_path,
            classes=model.classes,
            architecture=model.architecture,
            num_frames=num_frames,
            resolution=(res, res),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Video analysis failed: {str(exc)}",
        )

    # Record analysis in database
    analysis_record = Analysis(
        model_id=model.id,
        video_filename=clean_filename,
        video_path=str(save_path.resolve()),
        predicted_class=prediction["predicted_class"],
        confidence=prediction["confidence"],
        all_predictions=prediction["all_predictions"],
        processing_time=prediction["processing_time"],
    )
    db.add(analysis_record)
    await db.commit()
    await db.refresh(analysis_record)

    return analysis_record


@router.post("/predict-ensemble", response_model=EnsembleAnalysisResponse, status_code=status.HTTP_201_CREATED)
async def analyze_video_ensemble(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Performs ensemble inference on an uploaded video using ALL available models.
    Returns the best prediction across all models along with per-model breakdowns.
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.SUPPORTED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported video extension '{ext}'. Allowed: {settings.SUPPORTED_VIDEO_EXTENSIONS}",
        )

    # Fetch ALL models
    stmt = select(MLModel).order_by(MLModel.accuracy.desc().nullslast(), MLModel.created_at.desc())
    result = await db.execute(stmt)
    models = list(result.scalars().all())
    if not models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No trained models available for analysis. Please train a model first in the Training Center.",
        )

    # Save uploaded video once
    unique_suffix = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    clean_filename = Path(file.filename).name
    save_path = settings.ANALYSES_DIR / f"{unique_suffix}_{clean_filename}"

    try:
        with open(save_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                buffer.write(chunk)
    except Exception as exc:
        if save_path.exists():
            save_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save video for inference: {str(exc)}",
        )

    # Run inference with each model and collect results
    model_results: list[EnsembleModelResult] = []
    total_start = time.time()

    for model in models:
        config = model.config or {}
        num_frames = int(config.get("num_frames", settings.DEFAULT_NUM_FRAMES))
        res = int(config.get("resolution", settings.DEFAULT_RESOLUTION))

        try:
            prediction = predict_video(
                model_id=model.id,
                model_path=model.model_path,
                video_path=save_path,
                classes=model.classes,
                architecture=model.architecture,
                num_frames=num_frames,
                resolution=(res, res),
            )
        except Exception:
            # Skip models that fail inference
            continue

        model_results.append(
            EnsembleModelResult(
                model_id=model.id,
                model_name=model.name,
                architecture=model.architecture,
                accuracy=model.accuracy,
                predicted_class=prediction["predicted_class"],
                confidence=prediction["confidence"],
                all_predictions=prediction["all_predictions"],
            )
        )

    total_time = time.time() - total_start

    if not model_results:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="All models failed during ensemble inference.",
        )

    # Determine overall best prediction (highest confidence across all models)
    best_result = max(model_results, key=lambda r: r.confidence)

    # Build combined predictions: merge all class predictions, take max confidence per class
    class_map: dict[str, dict[str, Any]] = {}
    for mr in model_results:
        for pred in mr.all_predictions:
            class_name = pred.get("class_name", "")
            conf = pred.get("confidence", 0.0)
            if class_name not in class_map or conf > class_map[class_name]["confidence"]:
                class_map[class_name] = {
                    "class_name": class_name,
                    "confidence": conf,
                    "source_model": mr.model_name,
                }

    combined_predictions = sorted(
        list(class_map.values()),
        key=lambda x: x["confidence"],
        reverse=True,
    )

    # Save one analysis record using the best model's ID
    analysis_record = Analysis(
        model_id=best_result.model_id,
        video_filename=clean_filename,
        video_path=str(save_path.resolve()),
        predicted_class=best_result.predicted_class,
        confidence=best_result.confidence,
        all_predictions=combined_predictions,
        processing_time=total_time,
    )
    db.add(analysis_record)
    await db.commit()
    await db.refresh(analysis_record)

    return EnsembleAnalysisResponse(
        id=analysis_record.id,
        video_filename=clean_filename,
        predicted_class=best_result.predicted_class,
        confidence=best_result.confidence,
        source_model_id=best_result.model_id,
        source_model_name=best_result.model_name,
        model_results=model_results,
        combined_predictions=combined_predictions,
        total_models_used=len(model_results),
        processing_time=total_time,
    )


@router.get("/history", response_model=AnalysisHistoryResponse)
async def get_analysis_history(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Lists historical video analysis records with pagination."""
    count_stmt = select(func.count(Analysis.id))
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    stmt = (
        select(Analysis)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    return AnalysisHistoryResponse(analyses=list(records), total=total)
