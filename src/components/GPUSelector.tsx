import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';

interface GPUInfo {
  id: number;
  name: string;
  type: 'nvidia' | 'amd' | 'intel' | 'cpu' | 'unknown';
  memory_total: number;
  memory_used: number;
  memory_free: number;
  utilization: number;
  temperature?: number;
  power_usage?: number;
  driver_version?: string;
  cuda_version?: string;
  is_available: boolean;
}

interface GPUSelectorProps {
  selectedGPU: number | null;
  onGPUChange: (gpuId: number | null) => void;
  disabled?: boolean;
  className?: string;
}

export const GPUSelector: React.FC<GPUSelectorProps> = ({
  selectedGPU,
  onGPUChange,
  disabled = false,
  className = ''
}) => {
  const [gpus, setGpus] = useState<GPUInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGPUs();
  }, []);

  const loadGPUs = async () => {
    try {
      setLoading(true);
      setError(null);
      const gpuData = await apiClient.getGPUs();
      setGpus(gpuData);
    } catch (err) {
      setError('Failed to load GPU information');
      console.error('Error loading GPUs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGPUTypeIcon = (type: string) => {
    switch (type) {
      case 'nvidia':
        return '🟢'; // NVIDIA green
      case 'amd':
        return '🔴'; // AMD red
      case 'intel':
        return '🔵'; // Intel blue
      case 'cpu':
        return '⚙️'; // CPU gear
      default:
        return '❓'; // Unknown
    }
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const getGPUStatusColor = (gpu: GPUInfo) => {
    if (!gpu.is_available) return 'text-red-500';
    if (gpu.utilization > 80) return 'text-yellow-500';
    if (gpu.utilization > 50) return 'text-orange-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">Loading GPUs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-red-500 dark:text-red-400">⚠️</span>
        <span className="text-sm text-red-600 dark:text-red-400 transition-colors duration-300">{error}</span>
        <button
          onClick={loadGPUs}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors duration-300"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
        GPU Device
      </label>
      
      <select
        value={selectedGPU || ''}
        onChange={(e) => onGPUChange(e.target.value ? parseInt(e.target.value) : null)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300"
      >
        <option value="">Select GPU...</option>
        {gpus.map((gpu) => (
          <option key={gpu.id} value={gpu.id} disabled={!gpu.is_available}>
            {getGPUTypeIcon(gpu.type)} {gpu.name} 
            {!gpu.is_available && ' (Unavailable)'}
          </option>
        ))}
      </select>

      {selectedGPU && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md transition-colors duration-300">
          {(() => {
            const gpu = gpus.find(g => g.id === selectedGPU);
            if (!gpu) return null;

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-300">
                    {getGPUTypeIcon(gpu.type)} {gpu.name}
                  </span>
                  <span className={`text-sm font-medium transition-colors duration-300 ${getGPUStatusColor(gpu)}`}>
                    {gpu.utilization}% utilized
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 transition-colors duration-300">
                  <div>
                    <span className="font-medium">Memory:</span> {formatMemory(gpu.memory_free)} / {formatMemory(gpu.memory_total)} free
                  </div>
                  {gpu.temperature && (
                    <div>
                      <span className="font-medium">Temp:</span> {gpu.temperature}°C
                    </div>
                  )}
                  {gpu.power_usage && (
                    <div>
                      <span className="font-medium">Power:</span> {gpu.power_usage}W
                    </div>
                  )}
                  {gpu.driver_version && (
                    <div>
                      <span className="font-medium">Driver:</span> {gpu.driver_version}
                    </div>
                  )}
                </div>

                {/* Memory usage bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(gpu.memory_used / gpu.memory_total) * 100}%` }}
                  ></div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{gpus.length} GPU{gpus.length !== 1 ? 's' : ''} detected</span>
        <button
          onClick={loadGPUs}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};
