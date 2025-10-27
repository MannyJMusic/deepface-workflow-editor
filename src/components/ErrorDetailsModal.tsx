import React from 'react';

export interface ErrorDetails {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  details: Record<string, any>;
  node_id?: string;
  workflow_id?: string;
  execution_id?: string;
  stack_trace?: string;
  recoverable: boolean;
  retry_count: number;
  max_retries: number;
}

interface ErrorDetailsModalProps {
  error: ErrorDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: (errorId: string) => void;
}

export const ErrorDetailsModal: React.FC<ErrorDetailsModalProps> = ({
  error,
  isOpen,
  onClose,
  onRetry
}) => {
  if (!isOpen || !error) {
    return null;
  }

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

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString();
  };

  const canRetry = error.recoverable && error.retry_count < error.max_retries;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">{getSeverityIcon(error.severity)}</span>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Error Details
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatTimestamp(error.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-4 pb-4 sm:p-6 sm:pt-0">
            <div className="space-y-6">
              {/* Error Summary */}
              <div className={`p-4 rounded-lg border ${getSeverityColor(error.severity)}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium capitalize">{error.severity} Error</h4>
                  <span className="text-sm capitalize">{error.category}</span>
                </div>
                <p className="text-sm font-medium">{error.message}</p>
              </div>

              {/* Error ID and Context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Error ID
                  </label>
                  <p className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                    {error.id}
                  </p>
                </div>
                
                {error.node_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Node ID
                    </label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                      {error.node_id}
                    </p>
                  </div>
                )}

                {error.workflow_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workflow ID
                    </label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                      {error.workflow_id}
                    </p>
                  </div>
                )}

                {error.execution_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Execution ID
                    </label>
                    <p className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded">
                      {error.execution_id}
                    </p>
                  </div>
                )}
              </div>

              {/* Retry Information */}
              {error.recoverable && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-900">Recoverable Error</h4>
                      <p className="text-sm text-blue-700">
                        Retry attempts: {error.retry_count} / {error.max_retries}
                      </p>
                    </div>
                    {canRetry && onRetry && (
                      <button
                        onClick={() => onRetry(error.id)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {Object.keys(error.details).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Details
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                      {JSON.stringify(error.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {error.stack_trace && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stack Trace
                  </label>
                  <div className="bg-gray-900 text-green-400 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {error.stack_trace}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
