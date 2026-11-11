import random
import re
from pathlib import Path
from typing import Optional
import cv2
import numpy as np
import torch


# Kinetics-400 / Torchvision Video ResNet standard normalization
KINETICS_MEAN = [0.43216, 0.394666, 0.37645]
KINETICS_STD = [0.22803, 0.22145, 0.216989]


def _resize_short_edge_and_center_crop(
    frame: np.ndarray, target_h: int, target_w: int
) -> np.ndarray:
    """
    Resize the shorter edge of the frame to match the target size, preserving
    aspect ratio, then center-crop to (target_h, target_w).

    This prevents high-resolution wide-angle footage from being squashed
    into a tiny square, which would shrink people to unrecognizable blobs.

    Example: A 1920x1080 frame with target 112x112:
      1) shorter edge is 1080 -> scale to 112, width becomes ~192
      2) center-crop 112x112 from the 192x112 image -> person stays properly sized
    """
    h, w = frame.shape[:2]

    # If already exact target size, return as-is
    if h == target_h and w == target_w:
        return frame

    # Determine which edge is shorter and compute scale factor
    if h <= w:
        # Height is shorter -> resize height to target_h
        scale = target_h / h
        new_h = target_h
        new_w = max(int(round(w * scale)), target_w)
    else:
        # Width is shorter -> resize width to target_w
        scale = target_w / w
        new_w = target_w
        new_h = max(int(round(h * scale)), target_h)

    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    # Center crop to (target_h, target_w)
    y_offset = (new_h - target_h) // 2
    x_offset = (new_w - target_w) // 2
    cropped = resized[y_offset : y_offset + target_h, x_offset : x_offset + target_w]

    return cropped


def sample_frames_from_image_sequence(
    folder_path: str | Path,
    num_frames: int = 16,
    resolution: tuple[int, int] = (112, 112),
) -> Optional[torch.Tensor]:
    """
    Uniformly samples N frames from a directory of ordered image frames (e.g. .jpg, .png),
    converts BGR to RGB, resizes using aspect-ratio-preserving center-crop to target
    resolution (H, W), scales to [0, 1], and returns a torch.FloatTensor shaped [C, T, H, W].
    """
    folder = Path(folder_path)
    if not folder.is_dir():
        return None

    # Supported image extensions
    img_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    frame_files = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in img_exts]

    if not frame_files:
        return None

    # Sort numerically/alphabetically
    frame_files.sort(key=lambda x: [int(c) if c.isdigit() else c.lower() for c in re.split(r"(\d+)", x.name)])

    total_frames = len(frame_files)
    indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)

    processed_frames: list[np.ndarray] = []
    target_w, target_h = resolution[1], resolution[0]

    for idx in indices:
        img_path = str(frame_files[idx])
        img = cv2.imread(img_path)
        if img is None:
            if processed_frames:
                processed_frames.append(processed_frames[-1].copy())
            else:
                processed_frames.append(np.zeros((target_h, target_w, 3), dtype=np.uint8))
            continue

        rgb_frame = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        # Use aspect-ratio-preserving resize + center crop instead of squash-resize
        cropped_frame = _resize_short_edge_and_center_crop(rgb_frame, target_h, target_w)
        processed_frames.append(cropped_frame)

    if not processed_frames:
        return None

    while len(processed_frames) < num_frames:
        processed_frames.append(processed_frames[-1].copy())

    video_arr = np.stack(processed_frames, axis=0).astype(np.float32) / 255.0
    tensor = torch.from_numpy(video_arr).permute(3, 0, 1, 2)
    return tensor


def sample_frames_from_video(
    video_path: str | Path,
    num_frames: int = 16,
    resolution: tuple[int, int] = (112, 112),
) -> Optional[torch.Tensor]:
    """
    Uniformly samples N frames from either:
    1. A single video file (.mp4, .avi, etc.) using OpenCV.
    2. A directory containing sequential frame images (.jpg, .png, etc.).

    Uses aspect-ratio-preserving resize + center-crop to avoid squashing
    high-resolution / wide-angle footage.

    Returns a torch.FloatTensor shaped [C, T, H, W] in [0, 1].
    """
    p = Path(video_path)
    if p.is_dir():
        return sample_frames_from_image_sequence(p, num_frames=num_frames, resolution=resolution)

    if not p.is_file():
        return None

    cap = cv2.VideoCapture(str(p))
    if not cap.isOpened():
        return None

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Some video containers misreport frame count as 0 or negative;
        # read sequentially in that case
        if total_frames <= 0:
            frames_buffer: list[np.ndarray] = []
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    break
                frames_buffer.append(frame)
            total_frames = len(frames_buffer)
            if total_frames == 0:
                return None

            # Sample indices
            indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
            sampled_raw = [frames_buffer[i] for i in indices]
        else:
            indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
            sampled_raw = []
            current_idx = 0

            # Step through frames efficiently
            for target_idx in indices:
                # Seek if jumping forward more than 2 frames
                if target_idx > current_idx + 2:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, target_idx)
                    current_idx = target_idx

                while current_idx < target_idx:
                    cap.grab()
                    current_idx += 1

                ret, frame = cap.read()
                current_idx += 1
                if not ret or frame is None:
                    # Fallback to repeating last good frame or empty black frame
                    if sampled_raw:
                        sampled_raw.append(sampled_raw[-1].copy())
                    else:
                        sampled_raw.append(np.zeros((resolution[1], resolution[0], 3), dtype=np.uint8))
                else:
                    sampled_raw.append(frame)

        if not sampled_raw:
            return None

        # Preprocess each frame: BGR to RGB, resize + center-crop
        processed_frames: list[np.ndarray] = []
        target_w, target_h = resolution[1], resolution[0]  # cv2.resize takes (width, height)

        for frame in sampled_raw:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            # Use aspect-ratio-preserving resize + center crop instead of squash-resize
            cropped_frame = _resize_short_edge_and_center_crop(rgb_frame, target_h, target_w)
            processed_frames.append(cropped_frame)

        # Pad if for some reason we got fewer frames
        while len(processed_frames) < num_frames:
            processed_frames.append(processed_frames[-1].copy())

        # Stack to [T, H, W, C] and normalize to [0, 1]
        video_arr = np.stack(processed_frames, axis=0).astype(np.float32) / 255.0

        # Permute [T, H, W, C] -> [C, T, H, W]
        tensor = torch.from_numpy(video_arr).permute(3, 0, 1, 2)
        return tensor

    except Exception:
        return None
    finally:
        cap.release()


class VideoRandomHorizontalFlip:
    """Randomly flips video horizontally across all frames consistently."""

    def __init__(self, p: float = 0.5):
        self.p = p

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        # tensor is [C, T, H, W]
        if random.random() < self.p:
            return torch.flip(tensor, dims=[-1])
        return tensor


class VideoColorJitter:
    """Applies random brightness and contrast adjustment across all frames consistently."""

    def __init__(self, brightness: float = 0.15, contrast: float = 0.15):
        self.brightness = brightness
        self.contrast = contrast

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        # tensor is [C, T, H, W] in [0, 1]
        if self.brightness > 0:
            b_factor = 1.0 + random.uniform(-self.brightness, self.brightness)
            tensor = tensor * b_factor

        if self.contrast > 0:
            c_factor = 1.0 + random.uniform(-self.contrast, self.contrast)
            mean = tensor.mean(dim=[-2, -1], keepdim=True)
            tensor = (tensor - mean) * c_factor + mean

        return torch.clamp(tensor, 0.0, 1.0)


class VideoNormalize:
    """Normalizes video tensor [C, T, H, W] with mean and std per channel."""

    def __init__(self, mean: list[float] = KINETICS_MEAN, std: list[float] = KINETICS_STD):
        self.mean = torch.tensor(mean, dtype=torch.float32).view(3, 1, 1, 1)
        self.std = torch.tensor(std, dtype=torch.float32).view(3, 1, 1, 1)

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        # tensor: [C, T, H, W]
        device = tensor.device
        mean = self.mean.to(device)
        std = self.std.to(device)
        return (tensor - mean) / std


class VideoTransformPipeline:
    """Composes video augmentations and normalization."""

    def __init__(self, augment: bool = False):
        self.augment = augment
        self.flip = VideoRandomHorizontalFlip(p=0.5)
        self.color_jitter = VideoColorJitter(brightness=0.15, contrast=0.15)
        self.normalize = VideoNormalize()

    def __call__(self, tensor: torch.Tensor) -> torch.Tensor:
        if self.augment:
            tensor = self.flip(tensor)
            tensor = self.color_jitter(tensor)
        return self.normalize(tensor)
