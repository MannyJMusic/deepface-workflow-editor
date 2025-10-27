import subprocess
import json
import platform
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class GPUType(Enum):
    NVIDIA = "nvidia"
    AMD = "amd"
    INTEL = "intel"
    CPU = "cpu"
    UNKNOWN = "unknown"

@dataclass
class GPUInfo:
    id: int
    name: str
    type: GPUType
    memory_total: int  # MB
    memory_used: int   # MB
    memory_free: int   # MB
    utilization: int   # Percentage
    temperature: Optional[int] = None  # Celsius
    power_usage: Optional[int] = None  # Watts
    driver_version: Optional[str] = None
    cuda_version: Optional[str] = None
    is_available: bool = True

class GPUDetector:
    """Detects and monitors GPU devices"""
    
    def __init__(self):
        self.system = platform.system().lower()
        self.gpus: List[GPUInfo] = []
    
    async def detect_gpus(self) -> List[GPUInfo]:
        """Detect all available GPUs"""
        self.gpus = []
        
        # Detect NVIDIA GPUs
        nvidia_gpus = await self._detect_nvidia_gpus()
        self.gpus.extend(nvidia_gpus)
        
        # Detect AMD GPUs
        amd_gpus = await self._detect_amd_gpus()
        self.gpus.extend(amd_gpus)
        
        # Detect Intel GPUs
        intel_gpus = await self._detect_intel_gpus()
        self.gpus.extend(intel_gpus)
        
        # Add CPU as fallback
        cpu_info = GPUInfo(
            id=len(self.gpus),
            name="CPU",
            type=GPUType.CPU,
            memory_total=self._get_system_memory(),
            memory_used=0,
            memory_free=self._get_system_memory(),
            utilization=0,
            is_available=True
        )
        self.gpus.append(cpu_info)
        
        return self.gpus
    
    async def _detect_nvidia_gpus(self) -> List[GPUInfo]:
        """Detect NVIDIA GPUs using nvidia-smi"""
        gpus = []
        
        try:
            # Check if nvidia-smi is available
            result = subprocess.run(['nvidia-smi', '--query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,driver_version', '--format=csv,noheader,nounits'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if line.strip():
                        parts = [p.strip() for p in line.split(',')]
                        if len(parts) >= 7:
                            gpu_id = int(parts[0])
                            name = parts[1]
                            memory_total = int(parts[2]) if parts[2].isdigit() else 0
                            memory_used = int(parts[3]) if parts[3].isdigit() else 0
                            utilization = int(parts[4]) if parts[4].isdigit() else 0
                            temperature = int(parts[5]) if parts[5].isdigit() else None
                            power_usage = int(float(parts[6])) if parts[6].replace('.', '').isdigit() else None
                            driver_version = parts[7] if len(parts) > 7 else None
                            
                            # Get CUDA version
                            cuda_version = await self._get_cuda_version()
                            
                            gpu_info = GPUInfo(
                                id=gpu_id,
                                name=name,
                                type=GPUType.NVIDIA,
                                memory_total=memory_total,
                                memory_used=memory_used,
                                memory_free=memory_total - memory_used,
                                utilization=utilization,
                                temperature=temperature,
                                power_usage=power_usage,
                                driver_version=driver_version,
                                cuda_version=cuda_version,
                                is_available=True
                            )
                            gpus.append(gpu_info)
                            
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            # nvidia-smi not available or failed
            pass
        
        return gpus
    
    async def _detect_amd_gpus(self) -> List[GPUInfo]:
        """Detect AMD GPUs using rocm-smi or other tools"""
        gpus = []
        
        try:
            # Try rocm-smi first (ROCm)
            result = subprocess.run(['rocm-smi', '--showid', '--showmemuse', '--showtemp', '--showpower'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                # Parse rocm-smi output (simplified)
                lines = result.stdout.strip().split('\n')
                gpu_id = 0
                for line in lines:
                    if 'GPU' in line and 'Memory' in line:
                        # Extract basic info (simplified parsing)
                        gpu_info = GPUInfo(
                            id=gpu_id,
                            name=f"AMD GPU {gpu_id}",
                            type=GPUType.AMD,
                            memory_total=8192,  # Default, would need proper parsing
                            memory_used=0,
                            memory_free=8192,
                            utilization=0,
                            is_available=True
                        )
                        gpus.append(gpu_info)
                        gpu_id += 1
                        
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            # rocm-smi not available or failed
            pass
        
        return gpus
    
    async def _detect_intel_gpus(self) -> List[GPUInfo]:
        """Detect Intel GPUs"""
        gpus = []
        
        try:
            # Check for Intel GPU info (simplified)
            if self.system == "linux":
                # Check /sys/class/drm for Intel GPUs
                result = subprocess.run(['ls', '/sys/class/drm'], capture_output=True, text=True)
                if result.returncode == 0:
                    drm_devices = result.stdout.strip().split('\n')
                    intel_gpus_found = [d for d in drm_devices if 'card' in d and 'render' not in d]
                    
                    for i, device in enumerate(intel_gpus_found):
                        gpu_info = GPUInfo(
                            id=i,
                            name=f"Intel GPU {i}",
                            type=GPUType.INTEL,
                            memory_total=4096,  # Default
                            memory_used=0,
                            memory_free=4096,
                            utilization=0,
                            is_available=True
                        )
                        gpus.append(gpu_info)
                        
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            pass
        
        return gpus
    
    async def _get_cuda_version(self) -> Optional[str]:
        """Get CUDA version"""
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=driver_version', '--format=csv,noheader'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return result.stdout.strip()
        except:
            pass
        return None
    
    def _get_system_memory(self) -> int:
        """Get system memory in MB"""
        try:
            if self.system == "linux":
                with open('/proc/meminfo', 'r') as f:
                    for line in f:
                        if line.startswith('MemTotal:'):
                            return int(line.split()[1]) // 1024  # Convert KB to MB
            elif self.system == "darwin":  # macOS
                result = subprocess.run(['sysctl', 'hw.memsize'], capture_output=True, text=True)
                if result.returncode == 0:
                    mem_bytes = int(result.stdout.split()[1])
                    return mem_bytes // (1024 * 1024)  # Convert bytes to MB
        except:
            pass
        return 8192  # Default fallback
    
    async def update_gpu_status(self) -> List[GPUInfo]:
        """Update GPU status (memory usage, utilization, etc.)"""
        for gpu in self.gpus:
            if gpu.type == GPUType.NVIDIA:
                await self._update_nvidia_status(gpu)
            elif gpu.type == GPUType.AMD:
                await self._update_amd_status(gpu)
            elif gpu.type == GPUType.INTEL:
                await self._update_intel_status(gpu)
        
        return self.gpus
    
    async def _update_nvidia_status(self, gpu: GPUInfo):
        """Update NVIDIA GPU status"""
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=memory.used,utilization.gpu,temperature.gpu,power.draw', '--format=csv,noheader,nounits', f'--id={gpu.id}'], 
                                  capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                parts = [p.strip() for p in result.stdout.strip().split(',')]
                if len(parts) >= 4:
                    gpu.memory_used = int(parts[0]) if parts[0].isdigit() else gpu.memory_used
                    gpu.utilization = int(parts[1]) if parts[1].isdigit() else gpu.utilization
                    gpu.temperature = int(parts[2]) if parts[2].isdigit() else gpu.temperature
                    gpu.power_usage = int(float(parts[3])) if parts[3].replace('.', '').isdigit() else gpu.power_usage
                    gpu.memory_free = gpu.memory_total - gpu.memory_used
                    
        except:
            pass
    
    async def _update_amd_status(self, gpu: GPUInfo):
        """Update AMD GPU status"""
        # Simplified - would need proper rocm-smi parsing
        pass
    
    async def _update_intel_status(self, gpu: GPUInfo):
        """Update Intel GPU status"""
        # Simplified - would need proper Intel GPU monitoring
        pass
    
    def get_gpu_by_id(self, gpu_id: int) -> Optional[GPUInfo]:
        """Get GPU info by ID"""
        for gpu in self.gpus:
            if gpu.id == gpu_id:
                return gpu
        return None
    
    def get_available_gpus(self) -> List[GPUInfo]:
        """Get list of available GPUs"""
        return [gpu for gpu in self.gpus if gpu.is_available]
    
    def get_nvidia_gpus(self) -> List[GPUInfo]:
        """Get list of NVIDIA GPUs"""
        return [gpu for gpu in self.gpus if gpu.type == GPUType.NVIDIA and gpu.is_available]
    
    def get_amd_gpus(self) -> List[GPUInfo]:
        """Get list of AMD GPUs"""
        return [gpu for gpu in self.gpus if gpu.type == GPUType.AMD and gpu.is_available]
    
    def get_intel_gpus(self) -> List[GPUInfo]:
        """Get list of Intel GPUs"""
        return [gpu for gpu in self.gpus if gpu.type == GPUType.INTEL and gpu.is_available]

# Global GPU detector instance
gpu_detector = GPUDetector()
