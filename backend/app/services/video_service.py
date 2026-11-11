import hashlib
import os
from pathlib import Path
from typing import Any, Optional
import cv2


def compute_file_hash(filepath: str | Path, algorithm: str = "sha256") -> str:
    """Computes a cryptographic hash of a file or image directory for duplicate detection."""
    p = Path(filepath)
    if not p.exists():
        raise FileNotFoundError(f"File or directory not found: {filepath}")

    hasher = hashlib.new(algorithm)
    if p.is_dir():
        for f in sorted(p.iterdir()):
            if f.is_file():
                hasher.update(f.name.encode())
                hasher.update(str(f.stat().st_size).encode())
        return hasher.hexdigest()

    with open(p, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_video_metadata(filepath: str | Path) -> dict[str, Any]:
    """
    Extracts video metadata using OpenCV.
    Returns a dictionary containing width, height, fps, frame_count, duration, file_size,
    is_valid, and any error_message.
    """
    p = Path(filepath)
    file_size = 0

    # If it is a directory of image frames
    if p.is_dir():
        img_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        frame_files = [f for f in p.iterdir() if f.is_file() and f.suffix.lower() in img_exts]
        if not frame_files:
            return {
                "is_valid": False,
                "width": None,
                "height": None,
                "fps": None,
                "frame_count": 0,
                "duration": 0,
                "file_size": 0,
                "error_message": "Directory contains no valid image frames.",
            }

        total_size = sum(f.stat().st_size for f in frame_files)
        # Read the first frame with OpenCV to check dimensions
        first_frame = cv2.imread(str(frame_files[0]))
        if first_frame is None:
            return {
                "is_valid": False,
                "width": None,
                "height": None,
                "fps": None,
                "frame_count": len(frame_files),
                "duration": 0,
                "file_size": total_size,
                "error_message": "Could not decode first image frame in folder.",
            }

        h, w = first_frame.shape[:2]
        fps = 30.0
        frame_count = len(frame_files)
        duration = round(frame_count / fps, 3)

        return {
            "is_valid": True,
            "width": w,
            "height": h,
            "fps": fps,
            "frame_count": frame_count,
            "duration": duration,
            "file_size": total_size,
            "error_message": None,
        }

    if p.exists():
        file_size = p.stat().st_size

    if not p.is_file() or file_size == 0:
        return {
            "is_valid": False,
            "width": None,
            "height": None,
            "fps": None,
            "frame_count": None,
            "duration": None,
            "file_size": file_size,
            "error_message": "File does not exist or has 0 bytes.",
        }

    cap = cv2.VideoCapture(str(p))
    try:
        if not cap.isOpened():
            return {
                "is_valid": False,
                "width": None,
                "height": None,
                "fps": None,
                "frame_count": None,
                "duration": None,
                "file_size": file_size,
                "error_message": "OpenCV was unable to open the video container.",
            }

        # Try to read the first frame to confirm decodability
        ret, frame = cap.read()
        if not ret or frame is None:
            return {
                "is_valid": False,
                "width": None,
                "height": None,
                "fps": None,
                "frame_count": None,
                "duration": None,
                "file_size": file_size,
                "error_message": "Video stream could not be decoded (failed to read first frame).",
            }

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Handle edge cases for frame count or fps from container headers
        if fps <= 0.0 or fps > 240.0:
            fps = 30.0  # fallback assumption

        # If container reports 0 or negative frame count, estimate or count
        if frame_count <= 0:
            frame_count = 1  # at least the 1 frame read

        duration = round(frame_count / fps, 3) if fps > 0 else 0.0

        return {
            "is_valid": True,
            "width": width,
            "height": height,
            "fps": round(fps, 2),
            "frame_count": frame_count,
            "duration": duration,
            "file_size": file_size,
            "error_message": None,
        }
    except Exception as exc:
        return {
            "is_valid": False,
            "width": None,
            "height": None,
            "fps": None,
            "frame_count": None,
            "duration": None,
            "file_size": file_size,
            "error_message": f"Unexpected error reading video: {str(exc)}",
        }
    finally:
        cap.release()


def validate_video_file(filepath: str | Path) -> tuple[bool, Optional[str], Optional[dict[str, Any]]]:
    """
    Validates a video file by checking if it can be opened and decoded.
    Returns (is_valid, error_message, metadata_dict).
    """
    meta = get_video_metadata(filepath)
    if not meta.get("is_valid", False):
        return False, meta.get("error_message", "Invalid video file"), meta
    return True, None, meta
