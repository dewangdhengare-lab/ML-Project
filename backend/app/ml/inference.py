from pathlib import Path
import time
from typing import Any, Optional
import torch
import torch.nn as nn

from app.ml.pipeline import create_model
from app.ml.video_transforms import (
    VideoTransformPipeline,
    sample_frames_from_video,
)

# In-memory model cache: key -> (model, classes, architecture)
_MODEL_CACHE: dict[int, tuple[nn.Module, list[str], str]] = {}


def load_model(
    model_id: int,
    model_path: str | Path,
    architecture: str = "r3d_18",
    num_classes: int = 2,
    classes: Optional[list[str]] = None,
    device: Optional[str] = None,
) -> tuple[nn.Module, list[str]]:
    """
    Loads a trained PyTorch model into memory from disk or retrieves it from cache.
    """
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    if model_id in _MODEL_CACHE:
        cached_model, cached_classes, _ = _MODEL_CACHE[model_id]
        return cached_model, cached_classes

    p = Path(model_path)
    if not p.is_file():
        raise FileNotFoundError(f"Model file not found at {model_path}")

    checkpoint = torch.load(str(p), map_location=device)

    # Extract state dict and classes from checkpoint if available
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
        loaded_classes = checkpoint.get("classes", classes or [])
        num_classes = len(loaded_classes) if loaded_classes else num_classes
    elif isinstance(checkpoint, dict):
        state_dict = checkpoint
        loaded_classes = classes or [f"class_{i}" for i in range(num_classes)]
    else:
        state_dict = checkpoint
        loaded_classes = classes or [f"class_{i}" for i in range(num_classes)]

    model = create_model(
        architecture=architecture,
        num_classes=num_classes,
        fine_tune_strategy="full",
        pretrained=False,
    )
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    _MODEL_CACHE[model_id] = (model, loaded_classes, architecture)
    return model, loaded_classes


def unload_model(model_id: int) -> None:
    """Removes a model from the memory cache."""
    if model_id in _MODEL_CACHE:
        del _MODEL_CACHE[model_id]
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def predict_video(
    model_id: int,
    model_path: str | Path,
    video_path: str | Path,
    classes: list[str],
    architecture: str = "r3d_18",
    num_frames: int = 16,
    resolution: tuple[int, int] = (112, 112),
    device: Optional[str] = None,
) -> dict[str, Any]:
    """
    Runs video inference using a cached or loaded model.
    Extracts frames, performs forward pass, and returns predicted class and confidences.
    """
    start_time = time.time()
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    model, loaded_classes = load_model(
        model_id=model_id,
        model_path=model_path,
        architecture=architecture,
        num_classes=len(classes),
        classes=classes,
        device=device,
    )

    # Extract frames
    tensor = sample_frames_from_video(
        video_path=video_path,
        num_frames=num_frames,
        resolution=resolution,
    )

    if tensor is None:
        raise ValueError(f"Failed to read or decode video at: {video_path}")

    # Transform & normalize
    pipeline = VideoTransformPipeline(augment=False)
    tensor = pipeline(tensor)

    # Add batch dimension: [1, C, T, H, W]
    batch_tensor = tensor.unsqueeze(0).to(device)

    with torch.no_grad():
        logits = model(batch_tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu().numpy()

    class_list = loaded_classes if loaded_classes else classes
    all_predictions: list[dict[str, Any]] = []

    for idx, prob in enumerate(probs):
        c_name = class_list[idx] if idx < len(class_list) else f"class_{idx}"
        all_predictions.append({
            "class_name": c_name,
            "confidence": round(float(prob), 4),
        })

    all_predictions.sort(key=lambda x: x["confidence"], reverse=True)
    top_pred = all_predictions[0]
    elapsed = round(time.time() - start_time, 4)

    return {
        "predicted_class": top_pred["class_name"],
        "confidence": top_pred["confidence"],
        "all_predictions": all_predictions,
        "processing_time": elapsed,
    }
