from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime

from schemas.schemas import ErrorInfo, ErrorSeverity, ErrorCategory
from core.error_handler import error_handler

router = APIRouter()

@router.get("/errors", response_model=List[ErrorInfo])
async def get_errors(
    severity: Optional[ErrorSeverity] = Query(None, description="Filter by error severity"),
    category: Optional[ErrorCategory] = Query(None, description="Filter by error category"),
    node_id: Optional[str] = Query(None, description="Filter by node ID"),
    workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
    limit: int = Query(100, description="Maximum number of errors to return", ge=1, le=1000)
):
    """Get list of errors with optional filtering"""
    try:
        errors = error_handler.get_errors(
            severity=severity,
            category=category,
            node_id=node_id,
            workflow_id=workflow_id,
            limit=limit
        )
        return errors
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get errors: {str(e)}")

@router.get("/errors/summary")
async def get_error_summary():
    """Get error summary statistics"""
    try:
        summary = error_handler.get_error_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get error summary: {str(e)}")

@router.get("/errors/{error_id}")
async def get_error(error_id: str):
    """Get specific error by ID"""
    try:
        errors = error_handler.get_errors()
        error = next((e for e in errors if e.id == error_id), None)
        
        if not error:
            raise HTTPException(status_code=404, detail="Error not found")
        
        return error
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get error: {str(e)}")

@router.delete("/errors")
async def clear_errors(older_than_hours: int = Query(24, description="Clear errors older than this many hours")):
    """Clear old errors"""
    try:
        error_handler.clear_errors(older_than_hours=older_than_hours)
        return {"message": f"Cleared errors older than {older_than_hours} hours"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear errors: {str(e)}")

@router.post("/errors/{error_id}/retry")
async def retry_error(error_id: str):
    """Retry a recoverable error"""
    try:
        errors = error_handler.get_errors()
        error = next((e for e in errors if e.id == error_id), None)
        
        if not error:
            raise HTTPException(status_code=404, detail="Error not found")
        
        if not error.recoverable:
            raise HTTPException(status_code=400, detail="Error is not recoverable")
        
        if error.retry_count >= error.max_retries:
            raise HTTPException(status_code=400, detail="Maximum retry attempts exceeded")
        
        # Increment retry count
        error.retry_count += 1
        
        return {
            "error_id": error_id,
            "retry_count": error.retry_count,
            "max_retries": error.max_retries,
            "message": f"Error {error_id} marked for retry (attempt {error.retry_count}/{error.max_retries})"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retry error: {str(e)}")

@router.get("/errors/node/{node_id}")
async def get_node_errors(node_id: str, limit: int = Query(50, ge=1, le=100)):
    """Get errors for a specific node"""
    try:
        errors = error_handler.get_errors(node_id=node_id, limit=limit)
        return {
            "node_id": node_id,
            "error_count": len(errors),
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get node errors: {str(e)}")

@router.get("/errors/workflow/{workflow_id}")
async def get_workflow_errors(workflow_id: str, limit: int = Query(100, ge=1, le=500)):
    """Get errors for a specific workflow"""
    try:
        errors = error_handler.get_errors(workflow_id=workflow_id, limit=limit)
        return {
            "workflow_id": workflow_id,
            "error_count": len(errors),
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow errors: {str(e)}")

@router.get("/errors/recent")
async def get_recent_errors(hours: int = Query(1, description="Get errors from last N hours", ge=1, le=24)):
    """Get recent errors"""
    try:
        cutoff_time = datetime.now().timestamp() - (hours * 3600)
        all_errors = error_handler.get_errors()
        recent_errors = [
            e for e in all_errors 
            if e.timestamp.timestamp() > cutoff_time
        ]
        
        return {
            "hours": hours,
            "error_count": len(recent_errors),
            "errors": recent_errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recent errors: {str(e)}")

@router.get("/errors/stats")
async def get_error_stats():
    """Get detailed error statistics"""
    try:
        errors = error_handler.get_errors()
        
        # Calculate statistics
        total_errors = len(errors)
        errors_by_severity = {}
        errors_by_category = {}
        errors_by_hour = {}
        recoverable_count = 0
        
        for error in errors:
            # Severity stats
            severity = error.severity.value
            errors_by_severity[severity] = errors_by_severity.get(severity, 0) + 1
            
            # Category stats
            category = error.category.value
            errors_by_category[category] = errors_by_category.get(category, 0) + 1
            
            # Hourly stats
            hour = error.timestamp.hour
            errors_by_hour[hour] = errors_by_hour.get(hour, 0) + 1
            
            # Recoverable stats
            if error.recoverable:
                recoverable_count += 1
        
        return {
            "total_errors": total_errors,
            "recoverable_errors": recoverable_count,
            "non_recoverable_errors": total_errors - recoverable_count,
            "errors_by_severity": errors_by_severity,
            "errors_by_category": errors_by_category,
            "errors_by_hour": errors_by_hour,
            "average_errors_per_hour": total_errors / 24 if total_errors > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get error stats: {str(e)}")
