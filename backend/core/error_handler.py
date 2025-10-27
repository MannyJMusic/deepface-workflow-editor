import traceback
import logging
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime
from dataclasses import dataclass, asdict
import asyncio

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ErrorCategory(Enum):
    VALIDATION = "validation"
    EXECUTION = "execution"
    RESOURCE = "resource"
    NETWORK = "network"
    PERMISSION = "permission"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"
    UNKNOWN = "unknown"

@dataclass
class ErrorInfo:
    id: str
    timestamp: datetime
    severity: ErrorSeverity
    category: ErrorCategory
    message: str
    details: Dict[str, Any]
    node_id: Optional[str] = None
    workflow_id: Optional[str] = None
    execution_id: Optional[str] = None
    stack_trace: Optional[str] = None
    recoverable: bool = True
    retry_count: int = 0
    max_retries: int = 3

class ErrorHandler:
    """Centralized error handling and management"""
    
    def __init__(self):
        self.errors: List[ErrorInfo] = []
        self.error_callbacks: List[callable] = []
        self.logger = logging.getLogger(__name__)
        
    def register_callback(self, callback: callable):
        """Register a callback for error notifications"""
        self.error_callbacks.append(callback)
    
    def unregister_callback(self, callback: callable):
        """Unregister an error callback"""
        if callback in self.error_callbacks:
            self.error_callbacks.remove(callback)
    
    async def handle_error(
        self,
        error: Exception,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        node_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        execution_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        recoverable: bool = True,
        halt_workflow: bool = False
    ) -> ErrorInfo:
        """Handle an error and create ErrorInfo"""
        
        error_id = f"err_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(self.errors)}"
        
        error_info = ErrorInfo(
            id=error_id,
            timestamp=datetime.now(),
            severity=severity,
            category=category,
            message=str(error),
            details=details or {},
            node_id=node_id,
            workflow_id=workflow_id,
            execution_id=execution_id,
            stack_trace=traceback.format_exc(),
            recoverable=recoverable
        )
        
        # Add to error log
        self.errors.append(error_info)
        
        # Log the error
        self._log_error(error_info)
        
        # Notify callbacks
        await self._notify_callbacks(error_info)
        
        # Halt workflow if critical
        if halt_workflow or severity == ErrorSeverity.CRITICAL:
            await self._halt_workflow(error_info)
        
        return error_info
    
    def _log_error(self, error_info: ErrorInfo):
        """Log error to appropriate level"""
        log_message = f"[{error_info.severity.value.upper()}] {error_info.message}"
        
        if error_info.node_id:
            log_message += f" (Node: {error_info.node_id})"
        if error_info.workflow_id:
            log_message += f" (Workflow: {error_info.workflow_id})"
        
        if error_info.severity == ErrorSeverity.CRITICAL:
            self.logger.critical(log_message, exc_info=True)
        elif error_info.severity == ErrorSeverity.HIGH:
            self.logger.error(log_message, exc_info=True)
        elif error_info.severity == ErrorSeverity.MEDIUM:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
    
    async def _notify_callbacks(self, error_info: ErrorInfo):
        """Notify all registered callbacks"""
        for callback in self.error_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(error_info)
                else:
                    callback(error_info)
            except Exception as e:
                self.logger.error(f"Error in error callback: {e}")
    
    async def _halt_workflow(self, error_info: ErrorInfo):
        """Halt workflow execution due to critical error"""
        if error_info.workflow_id and error_info.execution_id:
            # Import here to avoid circular imports
            from core.workflow_engine import WorkflowEngine
            from api.websocket import websocket_manager
            
            workflow_engine = WorkflowEngine()
            await workflow_engine.stop_execution(error_info.execution_id)
            
            # Notify via WebSocket
            await websocket_manager.send_execution_update({
                "execution_id": error_info.execution_id,
                "status": "error",
                "message": f"Workflow halted due to critical error: {error_info.message}",
                "error": asdict(error_info)
            })
    
    def get_errors(
        self,
        severity: Optional[ErrorSeverity] = None,
        category: Optional[ErrorCategory] = None,
        node_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        limit: int = 100
    ) -> List[ErrorInfo]:
        """Get filtered list of errors"""
        filtered_errors = self.errors
        
        if severity:
            filtered_errors = [e for e in filtered_errors if e.severity == severity]
        if category:
            filtered_errors = [e for e in filtered_errors if e.category == category]
        if node_id:
            filtered_errors = [e for e in filtered_errors if e.node_id == node_id]
        if workflow_id:
            filtered_errors = [e for e in filtered_errors if e.workflow_id == workflow_id]
        
        return filtered_errors[-limit:]  # Return most recent errors
    
    def clear_errors(self, older_than_hours: int = 24):
        """Clear old errors"""
        cutoff_time = datetime.now().timestamp() - (older_than_hours * 3600)
        self.errors = [
            e for e in self.errors 
            if e.timestamp.timestamp() > cutoff_time
        ]
    
    def get_error_summary(self) -> Dict[str, Any]:
        """Get error summary statistics"""
        total_errors = len(self.errors)
        errors_by_severity = {}
        errors_by_category = {}
        
        for error in self.errors:
            severity = error.severity.value
            category = error.category.value
            
            errors_by_severity[severity] = errors_by_severity.get(severity, 0) + 1
            errors_by_category[category] = errors_by_category.get(category, 0) + 1
        
        return {
            "total_errors": total_errors,
            "errors_by_severity": errors_by_severity,
            "errors_by_category": errors_by_category,
            "recent_errors": len([e for e in self.errors if (datetime.now() - e.timestamp).seconds < 3600])
        }

# Global error handler instance
error_handler = ErrorHandler()

# Convenience functions
async def handle_validation_error(
    error: Exception,
    node_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> ErrorInfo:
    """Handle validation errors"""
    return await error_handler.handle_error(
        error=error,
        severity=ErrorSeverity.MEDIUM,
        category=ErrorCategory.VALIDATION,
        node_id=node_id,
        workflow_id=workflow_id,
        details=details,
        recoverable=True,
        halt_workflow=False
    )

async def handle_execution_error(
    error: Exception,
    node_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    execution_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    halt_workflow: bool = True
) -> ErrorInfo:
    """Handle execution errors"""
    return await error_handler.handle_error(
        error=error,
        severity=ErrorSeverity.HIGH,
        category=ErrorCategory.EXECUTION,
        node_id=node_id,
        workflow_id=workflow_id,
        execution_id=execution_id,
        details=details,
        recoverable=True,
        halt_workflow=halt_workflow
    )

async def handle_resource_error(
    error: Exception,
    node_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> ErrorInfo:
    """Handle resource errors (GPU, memory, disk)"""
    return await error_handler.handle_error(
        error=error,
        severity=ErrorSeverity.HIGH,
        category=ErrorCategory.RESOURCE,
        node_id=node_id,
        workflow_id=workflow_id,
        details=details,
        recoverable=True,
        halt_workflow=True
    )

async def handle_critical_error(
    error: Exception,
    node_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    execution_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> ErrorInfo:
    """Handle critical errors that require immediate attention"""
    return await error_handler.handle_error(
        error=error,
        severity=ErrorSeverity.CRITICAL,
        category=ErrorCategory.UNKNOWN,
        node_id=node_id,
        workflow_id=workflow_id,
        execution_id=execution_id,
        details=details,
        recoverable=False,
        halt_workflow=True
    )
