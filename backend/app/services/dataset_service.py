import os
import shutil
import zipfile
from pathlib import Path
from typing import Any, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import Dataset, DatasetClass, DatasetVideo, ValidationReport
from app.services.video_service import get_video_metadata, compute_file_hash


def extract_zip_safely(
    file_path: Path,
    dest_path: Path,
    max_files: int = settings.MAX_ZIP_FILES,
    max_total_size: int = settings.MAX_UPLOAD_SIZE,
) -> Path:
    """
    Safely extracts a ZIP archive to dest_path with security checks against:
    - Path traversal attacks (using '..' or absolute paths)
    - Zip bombs (exceeding max file count or uncompressed size)
    - macOS hidden files (__MACOSX, .DS_Store)
    """
    dest_path = dest_path.resolve()
    dest_path.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(file_path, "r") as zf:
        infolist = zf.infolist()

        if len(infolist) > max_files:
            raise ValueError(f"ZIP archive contains {len(infolist)} files, exceeding limit of {max_files}.")

        total_uncompressed_size = sum(info.file_size for info in infolist)
        if total_uncompressed_size > max_total_size:
            raise ValueError(
                f"Uncompressed archive size ({total_uncompressed_size / 1e9:.2f} GB) "
                f"exceeds limit ({max_total_size / 1e9:.2f} GB)."
            )

        for member in infolist:
            filename = member.filename

            # Skip macOS metadata or hidden files
            if "__MACOSX" in filename or filename.endswith(".DS_Store") or Path(filename).name.startswith("._"):
                continue

            # Check for path traversal attempts
            target_path = (dest_path / filename).resolve()
            if not str(target_path).startswith(str(dest_path)):
                raise ValueError(f"Security violation: ZIP entry '{filename}' attempts path traversal.")

            if member.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)

    # Unwrap single root directory if all contents were placed inside one top folder
    child_items = [p for p in dest_path.iterdir() if p.name not in {"__MACOSX", ".DS_Store"}]
    if len(child_items) == 1 and child_items[0].is_dir():
        single_dir = child_items[0]
        temp_dir = dest_path.parent / f"_temp_{dest_path.name}"
        shutil.move(str(single_dir), str(temp_dir))
        for item in temp_dir.iterdir():
            shutil.move(str(item), str(dest_path / item.name))
        shutil.rmtree(str(temp_dir), ignore_errors=True)

    return dest_path


def organize_dataset(dataset_path: Path) -> dict[str, list[Path]]:
    """
    Detects folder structure and categorizes video files into classes.
    Supports:
    1. Direct class folders: dataset_dir/running/video1.mp4
    2. Flat folder with prefix names: dataset_dir/running_01.mp4 -> class 'running'
    3. Nested subfolders: dataset_dir/.../class_name/video.mp4
    Returns: {class_name: [list of video Paths]}
    """
    dataset_path = Path(dataset_path)
    class_videos: dict[str, list[Path]] = {}

    # Find all supported video files recursively
    video_files: list[Path] = []
    for ext in settings.SUPPORTED_VIDEO_EXTENSIONS:
        video_files.extend(dataset_path.rglob(f"*{ext}"))
        video_files.extend(dataset_path.rglob(f"*{ext.upper()}"))

    # Also detect subdirectories containing sequential frame images
    img_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    image_dirs: list[Path] = []
    for sub in dataset_path.rglob("*"):
        if sub.is_dir():
            has_images = any(f.suffix.lower() in img_exts for f in sub.iterdir() if f.is_file())
            # Ensure it is a leaf frame folder (does not contain other subfolders)
            has_subdirs = any(f.is_dir() for f in sub.iterdir())
            if has_images and not has_subdirs:
                image_dirs.append(sub)

    # Combine video files and image-sequence folders
    all_samples = sorted(list(set(video_files + image_dirs)))

    for sample in all_samples:
        # Determine class name
        rel_path = sample.relative_to(dataset_path)
        parts = rel_path.parts

        if len(parts) > 1:
            # If sample is a directory of frames, class is parts[-2]
            # E.g. in 'boxing/clip_01' (folder) -> class is 'boxing'
            # If sample is a video file, class is parts[-2]
            class_candidate = parts[-2]
            if class_candidate.lower() in {"videos", "train", "val", "test", "dataset", "data", "frames"} and len(parts) > 2:
                class_name = parts[-3]
            else:
                class_name = class_candidate
        else:
            stem = sample.stem
            if "_" in stem:
                class_name = stem.split("_")[0]
            elif "-" in stem:
                class_name = stem.split("-")[0]
            else:
                class_name = "default"

        # Sanitize class name
        class_name = class_name.strip().replace(" ", "_")
        if class_name not in class_videos:
            class_videos[class_name] = []
        class_videos[class_name].append(sample)

    return class_videos


async def validate_dataset(db: AsyncSession, dataset_id: int) -> ValidationReport:
    """
    Validates all video files in a dataset:
    - Runs OpenCV verification on every video
    - Computes hashes to detect duplicates
    - Calculates class balance
    - Checks durations and decodability
    - Updates Dataset, DatasetClass, DatasetVideo tables
    - Creates and returns a ValidationReport
    """
    stmt = select(Dataset).where(Dataset.id == dataset_id)
    result = await db.execute(stmt)
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise ValueError(f"Dataset with ID {dataset_id} not found.")

    dataset.status = "validating"
    await db.commit()

    storage_path = Path(dataset.storage_path)
    organized = organize_dataset(storage_path)

    # Clear existing classes and videos for fresh sync
    await db.execute(delete(DatasetVideo).where(DatasetVideo.dataset_id == dataset_id))
    await db.execute(delete(DatasetClass).where(DatasetClass.dataset_id == dataset_id))
    await db.commit()

    total_videos = 0
    valid_videos = 0
    invalid_videos = 0
    seen_hashes: dict[str, str] = {}  # hash -> filename
    duplicates: list[str] = []
    short_videos: list[str] = []
    warnings: list[str] = []
    errors: list[str] = []
    recommendations: list[str] = []
    class_distribution: dict[str, int] = {}

    sorted_classes = sorted(organized.keys())

    for idx, class_name in enumerate(sorted_classes):
        videos_in_class = organized[class_name]
        valid_class_count = 0

        for vid_path in videos_in_class:
            total_videos += 1
            filename = vid_path.name
            filepath_str = str(vid_path.resolve())

            # Check duplicate hash
            file_hash = None
            try:
                file_hash = compute_file_hash(vid_path)
                if file_hash in seen_hashes:
                    dup_warning = f"Duplicate video content: '{filename}' has identical hash to '{seen_hashes[file_hash]}'."
                    duplicates.append(dup_warning)
                else:
                    seen_hashes[file_hash] = filename
            except Exception as e:
                errors.append(f"Could not hash {filename}: {str(e)}")

            # Validate video with OpenCV
            meta = get_video_metadata(vid_path)
            is_valid = meta["is_valid"]
            error_msg = meta.get("error_message")

            if is_valid:
                valid_videos += 1
                valid_class_count += 1
                # Check for short duration
                duration = meta.get("duration") or 0.0
                frame_count = meta.get("frame_count") or 0
                if duration < 0.5 or frame_count < 8:
                    short_videos.append(f"Video '{filename}' ({class_name}) is very short: {duration}s, {frame_count} frames.")
            else:
                invalid_videos += 1
                errors.append(f"Corrupted video '{filename}' in class '{class_name}': {error_msg}")

            video_record = DatasetVideo(
                dataset_id=dataset_id,
                class_name=class_name,
                filename=filename,
                filepath=filepath_str,
                duration=meta.get("duration"),
                width=meta.get("width"),
                height=meta.get("height"),
                fps=meta.get("fps"),
                frame_count=meta.get("frame_count"),
                file_size=meta.get("file_size", 0),
                is_valid=is_valid,
                error_message=error_msg,
            )
            db.add(video_record)

        class_distribution[class_name] = valid_class_count

        class_record = DatasetClass(
            dataset_id=dataset_id,
            name=class_name,
            video_count=valid_class_count,
            class_index=idx,
        )
        db.add(class_record)

    # Analyze class imbalance
    if class_distribution:
        counts = list(class_distribution.values())
        min_count = min(counts)
        max_count = max(counts)
        avg_count = sum(counts) / len(counts)

        if max_count > 0 and (min_count / max_count) < 0.35 and len(counts) > 1:
            warnings.append(
                f"Significant class imbalance detected. Lowest class has {min_count} samples, "
                f"highest has {max_count} samples (ratio: {min_count/max_count:.2f})."
            )

        for c_name, c_cnt in class_distribution.items():
            if c_cnt < 5:
                warnings.append(f"Class '{c_name}' has only {c_cnt} valid videos. Minimum 10-15 recommended for deep learning.")

    if duplicates:
        warnings.extend(duplicates[:10])
        if len(duplicates) > 10:
            warnings.append(f"...and {len(duplicates) - 10} more duplicate video files.")

    if short_videos:
        warnings.extend(short_videos[:10])
        if len(short_videos) > 10:
            warnings.append(f"...and {len(short_videos) - 10} more short video files.")

    # Formulate recommendations
    if total_videos == 0:
        errors.append("No video files with supported extensions found in dataset archive.")
        recommendations.append("Ensure the dataset ZIP contains video files in supported formats (.mp4, .avi, .mov, etc.).")
    elif len(sorted_classes) < 2:
        warnings.append(f"Dataset has only {len(sorted_classes)} class. Classification requires at least 2 distinct classes.")
        recommendations.append("Add folders for at least 2 different activity classes to enable classification training.")
    else:
        recommendations.append("Classes and videos extracted successfully.")
        if any(cnt < 10 for cnt in class_distribution.values()):
            recommendations.append("Consider augmenting or gathering additional video clips for classes with fewer than 10 samples.")
        if invalid_videos > 0:
            recommendations.append(f"Remove or re-encode {invalid_videos} unreadable video files.")
        recommendations.append("Recommended fine-tuning strategy for this dataset size: 'partial' (stem frozen, head + top layers fine-tuned).")

    # Determine final dataset status
    if valid_videos > 0:
        dataset.status = "ready"
    else:
        dataset.status = "error"

    dataset.total_videos = valid_videos
    dataset.total_classes = len(sorted_classes)

    # Create validation report
    report = ValidationReport(
        dataset_id=dataset_id,
        total_videos=total_videos,
        valid_videos=valid_videos,
        invalid_videos=invalid_videos,
        warnings=warnings,
        errors=errors,
        recommendations=recommendations,
        class_distribution=class_distribution,
    )
    db.add(report)

    await db.commit()
    await db.refresh(report)
    await db.refresh(dataset)
    return report


async def get_class_distribution(dataset_id: int, db: AsyncSession) -> dict[str, int]:
    """Returns mapping of class names to video counts for a dataset."""
    stmt = select(DatasetClass).where(DatasetClass.dataset_id == dataset_id)
    result = await db.execute(stmt)
    classes = result.scalars().all()
    return {c.name: c.video_count for c in classes}


def delete_dataset_files(storage_path: str) -> None:
    """Removes dataset files and storage directory from disk."""
    p = Path(storage_path)
    if p.exists() and p.is_dir():
        shutil.rmtree(p, ignore_errors=True)
