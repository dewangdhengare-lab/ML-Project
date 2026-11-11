from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings, ensure_storage_dirs
from app.core.database import init_db
from app.worker.training_worker import start_worker, stop_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("har_platform")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for FastAPI startup and shutdown."""
    logger.info("Initializing storage directories...")
    ensure_storage_dirs()

    logger.info("Initializing database schema...")
    await init_db()

    logger.info("Starting background training worker...")
    start_worker()

    yield

    logger.info("Shutting down background training worker...")
    stop_worker()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade AI Platform for Video Human Activity Recognition using PyTorch & 3D ResNets.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers under /api
app.include_router(api_router, prefix="/api")

# Mount storage directory for static video previews
ensure_storage_dirs()
app.mount("/storage", StaticFiles(directory=str(settings.STORAGE_DIR)), name="storage")


@app.get("/", tags=["Root"])
async def root():
    """Root status and platform discovery endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "online",
        "docs_url": "/docs",
        "api_prefix": "/api",
        "endpoints": {
            "dashboard": "/api/dashboard/stats",
            "datasets": "/api/datasets",
            "training": "/api/training/jobs",
            "models": "/api/models",
            "analysis": "/api/analysis/predict",
            "system": "/api/system/gpu-info",
        },
    }
