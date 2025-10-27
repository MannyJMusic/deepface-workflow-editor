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

interface GPUMonitorProps {
  className?: string;
  refreshInterval?: number; // milliseconds
}

export const GPUMonitor: React.FC<GPUMonitorProps> = ({
  className = '',
  refreshInterval = 5000
}) => {
  const [gpus, setGpus] = useState<GPUInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    loadGPUStatus();
    const interval = setInterval(loadGPUStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const loadGPUStatus = async () => {
    try {
      setError(null);
      const response = await apiClient.getGPUStatus();
      setGpus(response.gpus);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to load GPU status');
      console.error('Error loading GPU status:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGPUTypeIcon = (type: string) => {
    switch (type) {
      case 'nvidia':
        return '🟢';
      case 'amd':
        return '🔴';
      case 'intel':
        return '🔵';
      case 'cpu':
        return '⚙️';
      default:
        return '❓';
    }
  };

  const getGPUTypeColor = (type: string) => {
    switch (type) {
      case 'nvidia':
        return 'border-green-200 bg-green-50';
      case 'amd':
        return 'border-red-200 bg-red-50';
      case 'intel':
        return 'border-blue-200 bg-blue-50';
      case 'cpu':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 80) return 'text-red-600';
    if (utilization > 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTemperatureColor = (temp?: number) => {
    if (!temp) return 'text-gray-500';
    if (temp > 80) return 'text-red-600';
    if (temp > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading && gpus.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading GPU status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">GPU Monitor</h3>
        <div className="flex items-center space-x-2">
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadGPUStatus}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <span className="text-red-500">⚠️</span>
            <span className="ml-2 text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gpus.map((gpu) => (
          <div
            key={gpu.id}
            className={`p-4 border rounded-lg ${getGPUTypeColor(gpu.type)} ${
              !gpu.is_available ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getGPUTypeIcon(gpu.type)}</span>
                <div>
                  <h4 className="font-medium text-gray-900">{gpu.name}</h4>
                  <p className="text-xs text-gray-600 capitalize">{gpu.type}</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-semibold ${getUtilizationColor(gpu.utilization)}`}>
                  {gpu.utilization}%
                </div>
                <div className="text-xs text-gray-500">Utilization</div>
              </div>
            </div>

            {/* Utilization bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Utilization</span>
                <span>{gpu.utilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    gpu.utilization > 80 ? 'bg-red-500' :
                    gpu.utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${gpu.utilization}%` }}
                ></div>
              </div>
            </div>

            {/* Memory usage bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Memory</span>
                <span>{formatMemory(gpu.memory_used)} / {formatMemory(gpu.memory_total)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(gpu.memory_used / gpu.memory_total) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Additional info */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              {gpu.temperature && (
                <div>
                  <span className="font-medium">Temp:</span>
                  <span className={`ml-1 ${getTemperatureColor(gpu.temperature)}`}>
                    {gpu.temperature}°C
                  </span>
                </div>
              )}
              {gpu.power_usage && (
                <div>
                  <span className="font-medium">Power:</span>
                  <span className="ml-1">{gpu.power_usage}W</span>
                </div>
              )}
              {gpu.driver_version && (
                <div className="col-span-2">
                  <span className="font-medium">Driver:</span>
                  <span className="ml-1">{gpu.driver_version}</span>
                </div>
              )}
              {gpu.cuda_version && (
                <div className="col-span-2">
                  <span className="font-medium">CUDA:</span>
                  <span className="ml-1">{gpu.cuda_version}</span>
                </div>
              )}
            </div>

            {!gpu.is_available && (
              <div className="mt-2 text-xs text-red-600 font-medium">
                ⚠️ GPU Unavailable
              </div>
            )}
          </div>
        ))}
      </div>

      {gpus.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <p>No GPUs detected</p>
          <p className="text-sm">Make sure GPU drivers are installed</p>
        </div>
      )}
    </div>
  );
};

export default GPUMonitor;
