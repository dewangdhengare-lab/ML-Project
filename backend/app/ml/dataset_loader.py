from collections import Counter
from pathlib import Path
from typing import Any, Callable, Optional
import numpy as np
from sklearn.model_selection import train_test_split
import torch
from torch.utils.data import DataLoader, Dataset

from app.ml.video_transforms import (
    VideoTransformPipeline,
    sample_frames_from_video,
)


class VideoDataset(Dataset):
    """
    PyTorch Dataset for video activity clips.
    Loads videos on the fly using OpenCV, samples uniform frames,
    and applies optional spatial/temporal augmentations and normalization.
    """

    def __init__(
        self,
        video_paths: list[str],
        labels: list[int],
        num_frames: int = 16,
        resolution: tuple[int, int] = (112, 112),
        augment: bool = False,
        transform: Optional[Callable[[torch.Tensor], torch.Tensor]] = None,
    ):
        self.video_paths = video_paths
        self.labels = labels
        self.num_frames = num_frames
        self.resolution = resolution
        self.augment = augment
        self.transform = transform or VideoTransformPipeline(augment=augment)

    def __len__(self) -> int:
        return len(self.video_paths)

    def __getitem__(self, idx: int) -> Optional[tuple[torch.Tensor, int]]:
        video_path = self.video_paths[idx]
        label = self.labels[idx]

        # Extract frames [C, T, H, W]
        tensor = sample_frames_from_video(
            video_path,
            num_frames=self.num_frames,
            resolution=self.resolution,
        )

        if tensor is None:
            return None

        # Apply augmentation and normalization
        if self.transform is not None:
            tensor = self.transform(tensor)

        return tensor, label


def video_collate_fn(batch: list[Optional[tuple[torch.Tensor, int]]]) -> tuple[Optional[torch.Tensor], Optional[torch.Tensor]]:
    """
    Filters out None items (from unreadable or corrupt videos) during batch collection.
    """
    valid_samples = [item for item in batch if item is not None]
    if not valid_samples:
        return None, None

    tensors, labels = zip(*valid_samples)
    batched_tensors = torch.stack(tensors, dim=0)  # [B, C, T, H, W]
    batched_labels = torch.tensor(labels, dtype=torch.long)  # [B]
    return batched_tensors, batched_labels


def create_data_loaders(
    dataset_path: str | Path,
    classes: list[str],
    config: dict[str, Any],
) -> tuple[DataLoader, DataLoader, Optional[DataLoader], dict[str, int]]:
    """
    Discovers video files per class, performs stratified train/val/test split,
    and creates PyTorch DataLoaders.
    """
    dataset_path = Path(dataset_path)
    class_to_idx = {name: idx for idx, name in enumerate(classes)}

    video_paths: list[str] = []
    labels: list[int] = []

    # Supported video & image formats
    video_exts = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"}
    image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    # Scan dataset for all classes
    for class_name, idx in class_to_idx.items():
        # Look in matching folders
        class_dirs = [
            d for d in dataset_path.rglob(class_name) if d.is_dir()
        ]
        class_samples: list[Path] = []
        if class_dirs:
            for c_dir in class_dirs:
                # 1. Video files directly under class folder
                for ext in video_exts:
                    class_samples.extend(c_dir.glob(f"*{ext}"))
                    class_samples.extend(c_dir.glob(f"*{ext.upper()}"))

                # 2. Subfolders of frame images (e.g. c_dir / video_001 / frame_*.jpg)
                for sub in c_dir.iterdir():
                    if sub.is_dir():
                        has_frames = any(f.suffix.lower() in image_exts for f in sub.iterdir() if f.is_file())
                        if has_frames:
                            class_samples.append(sub)

                # 3. Direct frame images in class folder if structured as single clip
                has_direct_frames = any(f.suffix.lower() in image_exts for f in c_dir.iterdir() if f.is_file())
                if has_direct_frames and not class_samples:
                    class_samples.append(c_dir)
        else:
            # Fallback: check file prefixes
            for ext in video_exts:
                class_samples.extend(dataset_path.rglob(f"{class_name}_*{ext}"))
                class_samples.extend(dataset_path.rglob(f"{class_name}-*{ext}"))

        class_samples = sorted(list(set(class_samples)))
        for s in class_samples:
            video_paths.append(str(s.resolve()))
            labels.append(idx)

    if len(video_paths) == 0:
        raise ValueError(f"No video files or image-frame sequences found in {dataset_path} for classes {classes}.")

    total_samples = len(video_paths)
    val_split = float(config.get("val_split", 0.2))
    test_split = float(config.get("test_split", 0.1))
    batch_size = int(config.get("batch_size", 8))
    num_frames = int(config.get("num_frames", 16))
    res = int(config.get("resolution", 112))
    resolution = (res, res)

    # Check minimum samples per class for stratification
    label_counts = Counter(labels)
    can_stratify = all(count >= 2 for count in label_counts.values()) and len(label_counts) > 1

    # Split: Train vs (Val + Test)
    eval_split_total = val_split + test_split
    if eval_split_total >= 0.8:
        eval_split_total = 0.3  # prevent degenerate splits

    try:
        stratify_labels = labels if can_stratify else None
        train_paths, eval_paths, train_labels, eval_labels = train_test_split(
            video_paths,
            labels,
            test_size=eval_split_total,
            random_state=42,
            stratify=stratify_labels,
        )
    except Exception:
        # Fallback without stratification
        train_paths, eval_paths, train_labels, eval_labels = train_test_split(
            video_paths,
            labels,
            test_size=eval_split_total,
            random_state=42,
            stratify=None,
        )

    # Split eval into Val and Test
    val_paths = eval_paths
    val_labels = eval_labels
    test_paths: list[str] = []
    test_labels: list[int] = []

    if test_split > 0 and len(eval_paths) >= 2:
        val_prop = val_split / eval_split_total
        eval_can_stratify = can_stratify and all(
            c >= 2 for c in Counter(eval_labels).values()
        )
        try:
            val_paths, test_paths, val_labels, test_labels = train_test_split(
                eval_paths,
                eval_labels,
                train_size=val_prop,
                random_state=42,
                stratify=eval_labels if eval_can_stratify else None,
            )
        except Exception:
            val_paths, test_paths, val_labels, test_labels = train_test_split(
                eval_paths,
                eval_labels,
                train_size=val_prop,
                random_state=42,
                stratify=None,
            )

    # Ensure train set is not empty
    if len(train_paths) == 0:
        train_paths = video_paths
        train_labels = labels

    # Build datasets
    train_dataset = VideoDataset(
        video_paths=train_paths,
        labels=train_labels,
        num_frames=num_frames,
        resolution=resolution,
        augment=True,
    )
    val_dataset = VideoDataset(
        video_paths=val_paths,
        labels=val_labels,
        num_frames=num_frames,
        resolution=resolution,
        augment=False,
    )

    test_dataset = (
        VideoDataset(
            video_paths=test_paths,
            labels=test_labels,
            num_frames=num_frames,
            resolution=resolution,
            augment=False,
        )
        if test_paths
        else None
    )

    # Windows-friendly multiprocessing num_workers
    num_workers = 0

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        collate_fn=video_collate_fn,
        drop_last=False,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        collate_fn=video_collate_fn,
        drop_last=False,
    )

    test_loader = (
        DataLoader(
            test_dataset,
            batch_size=batch_size,
            shuffle=False,
            num_workers=num_workers,
            collate_fn=video_collate_fn,
            drop_last=False,
        )
        if test_dataset
        else None
    )

    return train_loader, val_loader, test_loader, class_to_idx
