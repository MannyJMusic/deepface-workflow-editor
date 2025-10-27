import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { ErrorDetailsModal, ErrorDetails } from './ErrorDetailsModal';

interface ErrorMonitorProps {
  className?: string;
  refreshInterval?: number; // milliseconds
}

export const ErrorMonitor: React.FC<ErrorMonitorProps> = ({
  className = '',
  refreshInterval = 10000
}) => {
  const [errors, setErrors] = useState<ErrorDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<ErrorDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<{
    severity?: string;
    category?: string;
    nodeId?: string;
  }>({});

  useEffect(() => {
    loadErrors();
    const interval = setInterval(loadErrors, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, filter]);

  const loadErrors = async () => {
    try {
      setError(null);
      const errorData = await apiClient.getErrors({
        severity: filter.severity,
        category: filter.category,
        node_id: filter.nodeId,
        limit: 50
      });
      setErrors(errorData);
    } catch (err) {
      setError('Failed to load errors');
      console.error('Error loading errors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleErrorClick = (error: ErrorDetails) => {
    setSelectedError(error);
    setIsModalOpen(true);
  };

  const handleRetry = async (errorId: string) => {
    try {
      await apiClient.retryError(errorId);
      // Reload errors to update retry count
      loadErrors();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to retry error:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return 'ℹ️';
      default:
        return '❓';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateMessage = (message: string, maxLength: number = 100) => {
    return message.length > maxLength ? `${message.substring(0, maxLength)}...` : message;
  };

  if (loading && errors.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading errors...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Error Monitor</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadErrors}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        <select
          value={filter.severity || ''}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
          className="text-xs border border-gray-300 rounded px-2 py-1"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filter.category || ''}
          onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
          className="text-xs border border-gray-300 rounded px-2 py-1"
        >
          <option value="">All Categories</option>
          <option value="validation">Validation</option>
          <option value="execution">Execution</option>
          <option value="resource">Resource</option>
          <option value="network">Network</option>
          <option value="permission">Permission</option>
          <option value="configuration">Configuration</option>
          <option value="dependency">Dependency</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <span className="text-red-500">⚠️</span>
            <span className="ml-2 text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Error List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {errors.map((error) => (
          <div
            key={error.id}
            onClick={() => handleErrorClick(error)}
            className={`p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${getSeverityColor(error.severity)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm">{getSeverityIcon(error.severity)}</span>
                  <span className="text-sm font-medium capitalize">{error.severity}</span>
                  <span className="text-xs opacity-75 capitalize">({error.category})</span>
                </div>
                
                <p className="text-sm font-medium mb-1">
                  {truncateMessage(error.message)}
                </p>
                
                <div className="flex items-center space-x-4 text-xs opacity-75">
                  <span>{formatTimestamp(error.timestamp)}</span>
                  {error.node_id && <span>Node: {error.node_id}</span>}
                  {error.workflow_id && <span>Workflow: {error.workflow_id}</span>}
                  {error.recoverable && (
                    <span className="text-green-600">
                      Retry: {error.retry_count}/{error.max_retries}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex-shrink-0 ml-2">
                <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {errors.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <p>No errors found</p>
          <p className="text-sm">All systems are running smoothly!</p>
        </div>
      )}

      {/* Error Details Modal */}
      <ErrorDetailsModal
        error={selectedError}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedError(null);
        }}
        onRetry={handleRetry}
      />
    </div>
  );
};

export default ErrorMonitor;
