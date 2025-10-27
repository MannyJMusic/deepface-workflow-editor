from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import asyncio

from schemas.schemas import GPUInfo, GPUType
from core.gpu_detector import gpu_detector

router = APIRouter()

@router.get("/gpus", response_model=List[GPUInfo])
async def get_gpus():
    """Get all available GPUs"""
    try:
        gpus = await gpu_detector.detect_gpus()
        return gpus
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect GPUs: {str(e)}")

@router.get("/gpus/status")
async def get_gpu_status():
    """Get current GPU status (usage, memory, etc.)"""
    try:
        gpus = await gpu_detector.update_gpu_status()
        return {
            "gpus": gpus,
            "timestamp": asyncio.get_event_loop().time()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get GPU status: {str(e)}")

@router.get("/gpus/{gpu_id}")
async def get_gpu(gpu_id: int):
    """Get specific GPU information"""
    try:
        gpu = gpu_detector.get_gpu_by_id(gpu_id)
        if not gpu:
            raise HTTPException(status_code=404, detail="GPU not found")
        return gpu
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get GPU info: {str(e)}")

@router.get("/gpus/type/{gpu_type}")
async def get_gpus_by_type(gpu_type: str):
    """Get GPUs by type (nvidia, amd, intel, cpu)"""
    try:
        if gpu_type.lower() == "nvidia":
            gpus = gpu_detector.get_nvidia_gpus()
        elif gpu_type.lower() == "amd":
            gpus = gpu_detector.get_amd_gpus()
        elif gpu_type.lower() == "intel":
            gpus = gpu_detector.get_intel_gpus()
        elif gpu_type.lower() == "cpu":
            gpus = [gpu for gpu in gpu_detector.gpus if gpu.type == GPUType.CPU]
        else:
            raise HTTPException(status_code=400, detail="Invalid GPU type")
        
        return gpus
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get GPUs by type: {str(e)}")

@router.get("/gpus/available")
async def get_available_gpus():
    """Get only available GPUs"""
    try:
        gpus = gpu_detector.get_available_gpus()
        return gpus
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available GPUs: {str(e)}")

@router.post("/gpus/{gpu_id}/reserve")
async def reserve_gpu(gpu_id: int, node_id: str):
    """Reserve a GPU for a specific node"""
    try:
        gpu = gpu_detector.get_gpu_by_id(gpu_id)
        if not gpu:
            raise HTTPException(status_code=404, detail="GPU not found")
        
        if not gpu.is_available:
            raise HTTPException(status_code=409, detail="GPU is already in use")
        
        # In a real implementation, you'd track reservations
        # For now, we'll just return success
        return {
            "gpu_id": gpu_id,
            "node_id": node_id,
            "reserved": True,
            "message": f"GPU {gpu_id} reserved for node {node_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reserve GPU: {str(e)}")

@router.post("/gpus/{gpu_id}/release")
async def release_gpu(gpu_id: int, node_id: str):
    """Release a GPU reservation"""
    try:
        gpu = gpu_detector.get_gpu_by_id(gpu_id)
        if not gpu:
            raise HTTPException(status_code=404, detail="GPU not found")
        
        # In a real implementation, you'd track and release reservations
        return {
            "gpu_id": gpu_id,
            "node_id": node_id,
            "released": True,
            "message": f"GPU {gpu_id} released from node {node_id}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to release GPU: {str(e)}")

@router.get("/gpus/system/info")
async def get_system_info():
    """Get system information"""
    try:
        import platform
        import psutil
        
        return {
            "platform": platform.platform(),
            "system": platform.system(),
            "processor": platform.processor(),
            "cpu_count": psutil.cpu_count(),
            "memory_total": psutil.virtual_memory().total // (1024 * 1024),  # MB
            "memory_available": psutil.virtual_memory().available // (1024 * 1024),  # MB
            "python_version": platform.python_version()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system info: {str(e)}")