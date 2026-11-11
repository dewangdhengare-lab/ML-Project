import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine backend base directory
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_BASE_DIR = BACKEND_DIR / "storage"

class Settings(BaseSettings):
    APP_NAME: str = "HAR Platform"
    API_V1_STR: str = "/api"
    DEBUG: bool = False
    
    # Storage Paths
    STORAGE_DIR: Path = STORAGE_BASE_DIR
    DATASETS_DIR: Path = STORAGE_BASE_DIR / "datasets"
    MODELS_DIR: Path = STORAGE_BASE_DIR / "models"
    UPLOADS_DIR: Path = STORAGE_BASE_DIR / "uploads"
    ANALYSES_DIR: Path = STORAGE_BASE_DIR / "analyses"

    # Database Configuration
    # Uses absolute path formatted for SQLite URI to avoid cwd issues
    DATABASE_URL: str = f"sqlite+aiosqlite:///{STORAGE_BASE_DIR.as_posix()}/har_platform.db"
    SYNC_DATABASE_URL: str = f"sqlite:///{STORAGE_BASE_DIR.as_posix()}/har_platform.db"

    # File Upload & Validation Limits
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024 * 1024  # 20 GB
    MAX_ZIP_FILES: int = 100000
    SUPPORTED_VIDEO_EXTENSIONS: set[str] = {
        ".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm"
    }
    SUPPORTED_IMAGE_EXTENSIONS: set[str] = {
        ".jpg", ".jpeg", ".png", ".bmp", ".webp"
    }
    SUPPORTED_MEDIA_EXTENSIONS: set[str] = {
        ".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm",
        ".jpg", ".jpeg", ".png", ".bmp", ".webp"
    }

    # Model Defaults
    DEFAULT_ARCHITECTURE: str = "r3d_18"
    DEFAULT_NUM_FRAMES: int = 16
    DEFAULT_RESOLUTION: int = 112
    DEFAULT_BATCH_SIZE: int = 8
    DEFAULT_LEARNING_RATE: float = 1e-4
    DEFAULT_EPOCHS: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

def ensure_storage_dirs() -> None:
    """Creates all required storage directories if they do not exist."""
    directories = [
        settings.STORAGE_DIR,
        settings.DATASETS_DIR,
        settings.MODELS_DIR,
        settings.UPLOADS_DIR,
        settings.ANALYSES_DIR,
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
