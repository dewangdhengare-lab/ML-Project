from fastapi import APIRouter

from .analysis import router as analysis_router
from .dashboard import router as dashboard_router
from .datasets import router as datasets_router
from .models_api import router as models_router
from .system import router as system_router
from .training import router as training_router

api_router = APIRouter()

api_router.include_router(dashboard_router)
api_router.include_router(datasets_router)
api_router.include_router(training_router)
api_router.include_router(models_router)
api_router.include_router(analysis_router)
api_router.include_router(system_router)

__all__ = [
    "api_router",
    "dashboard_router",
    "datasets_router",
    "training_router",
    "models_router",
    "analysis_router",
    "system_router",
]
