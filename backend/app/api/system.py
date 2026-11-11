from fastapi import APIRouter
import torch

from app.schemas.schemas import GPUInfoResponse

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/gpu-info", response_model=GPUInfoResponse)
async def get_gpu_info():
    """
    Returns hardware and PyTorch runtime information,
    including CUDA device capabilities and memory statistics.
    """
    cuda_available = torch.cuda.is_available()
    gpu_count = torch.cuda.device_count() if cuda_available else 0
    gpu_name = None
    memory_allocated = None
    memory_reserved = None
    total_memory = None
    cuda_version = torch.version.cuda if hasattr(torch.version, "cuda") else None

    if cuda_available and gpu_count > 0:
        gpu_name = torch.cuda.get_device_name(0)
        # Convert bytes to megabytes
        allocated_bytes = torch.cuda.memory_allocated(0)
        reserved_bytes = torch.cuda.memory_reserved(0)
        memory_allocated = round(allocated_bytes / (1024 * 1024), 2)
        memory_reserved = round(reserved_bytes / (1024 * 1024), 2)

        props = torch.cuda.get_device_properties(0)
        total_memory = round(props.total_memory / (1024 * 1024), 2)
        device = f"cuda:0 ({gpu_name})"
    else:
        device = "cpu"

    return GPUInfoResponse(
        cuda_available=cuda_available,
        gpu_count=gpu_count,
        gpu_name=gpu_name,
        memory_allocated=memory_allocated,
        memory_reserved=memory_reserved,
        total_memory=total_memory,
        cuda_version=cuda_version,
        pytorch_version=torch.__version__,
        device=device,
    )
