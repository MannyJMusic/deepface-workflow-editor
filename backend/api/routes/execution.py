from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional
import asyncio
from datetime import datetime
import uuid

from schemas.schemas import WorkflowExecution, ExecutionStatus, ProgressUpdate
from core.workflow_engine import WorkflowEngine
from api.websocket import websocket_manager

router = APIRouter()

# In-memory storage for executions (replace with database in production)
executions_db: Dict[str, WorkflowExecution] = {}
workflow_engine = WorkflowEngine()

@router.post("/start/{workflow_id}", response_model=WorkflowExecution)
async def start_execution(workflow_id: str, background_tasks: BackgroundTasks):
    """Start execution of a workflow"""
    # Check if workflow exists (this would be imported from workflow routes)
    # For now, we'll assume it exists
    
    execution_id = str(uuid.uuid4())
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        status=ExecutionStatus.RUNNING,
        started_at=datetime.now().isoformat(),
        message="Starting workflow execution..."
    )
    
    executions_db[execution_id] = execution
    
    # Start execution in background
    background_tasks.add_task(run_workflow, execution_id, workflow_id)
    
    return execution

@router.post("/stop/{execution_id}")
async def stop_execution(execution_id: str):
    """Stop a running execution"""
    if execution_id not in executions_db:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution = executions_db[execution_id]
    if execution.status != ExecutionStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Execution is not running")
    
    execution.status = ExecutionStatus.PAUSED
    execution.message = "Execution stopped by user"
    
    await websocket_manager.send_execution_update({
        "execution_id": execution_id,
        "status": execution.status,
        "message": execution.message
    })
    
    return {"message": "Execution stopped"}

@router.post("/pause/{execution_id}")
async def pause_execution(execution_id: str):
    """Pause a running execution"""
    if execution_id not in executions_db:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution = executions_db[execution_id]
    if execution.status != ExecutionStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Execution is not running")
    
    execution.status = ExecutionStatus.PAUSED
    execution.message = "Execution paused"
    
    await websocket_manager.send_execution_update({
        "execution_id": execution_id,
        "status": execution.status,
        "message": execution.message
    })
    
    return {"message": "Execution paused"}

@router.post("/resume/{execution_id}")
async def resume_execution(execution_id: str, background_tasks: BackgroundTasks):
    """Resume a paused execution"""
    if execution_id not in executions_db:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    execution = executions_db[execution_id]
    if execution.status != ExecutionStatus.PAUSED:
        raise HTTPException(status_code=400, detail="Execution is not paused")
    
    execution.status = ExecutionStatus.RUNNING
    execution.message = "Resuming execution..."
    
    await websocket_manager.send_execution_update({
        "execution_id": execution_id,
        "status": execution.status,
        "message": execution.message
    })
    
    # Resume execution in background
    background_tasks.add_task(run_workflow, execution_id, execution.workflow_id)
    
    return {"message": "Execution resumed"}

@router.get("/status/{execution_id}")
async def get_execution_status(execution_id: str):
    """Get the status of an execution"""
    if execution_id not in executions_db:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return executions_db[execution_id]

@router.get("/list")
async def list_executions():
    """List all executions"""
    return list(executions_db.values())

@router.post("/start-node/{node_id}")
async def start_node_execution(node_id: str, background_tasks: BackgroundTasks, input_dir: str = None):
    """Start execution of a single node"""
    execution_id = str(uuid.uuid4())
    execution = WorkflowExecution(
        workflow_id=f"single_node_{node_id}",
        status=ExecutionStatus.RUNNING,
        current_node=node_id,
        started_at=datetime.now().isoformat(),
        message=f"Starting single node execution: {node_id}"
    )

    executions_db[execution_id] = execution

    # Start single node execution in background
    background_tasks.add_task(run_single_node, execution_id, node_id, input_dir)

    return execution

async def run_workflow(execution_id: str, workflow_id: str):
    """Background task to run a workflow"""
    try:
        execution = executions_db[execution_id]
        
        # Send initial status update
        await websocket_manager.send_execution_update({
            "execution_id": execution_id,
            "status": execution.status,
            "message": execution.message
        })
        
        # Run the workflow using the workflow engine
        result = await workflow_engine.execute_workflow(workflow_id, execution_id)
        
        if result["success"]:
            execution.status = ExecutionStatus.COMPLETED
            execution.completed_at = datetime.now().isoformat()
            execution.message = "Workflow completed successfully"
        else:
            execution.status = ExecutionStatus.ERROR
            execution.error = result["error"]
            execution.message = f"Workflow failed: {result['error']}"
        
        # Send final status update
        await websocket_manager.send_execution_update({
            "execution_id": execution_id,
            "status": execution.status,
            "message": execution.message,
            "error": execution.error
        })
        
    except Exception as e:
        execution = executions_db[execution_id]
        execution.status = ExecutionStatus.ERROR
        execution.error = str(e)
        execution.message = f"Workflow execution failed: {str(e)}"
        
        await websocket_manager.send_execution_update({
            "execution_id": execution_id,
            "status": execution.status,
            "message": execution.message,
            "error": execution.error
        })

async def run_single_node(execution_id: str, node_id: str, custom_input_dir: str = None):
    """Background task to run a single node"""
    try:
        execution = executions_db[execution_id]
        
        # Send initial status update
        await websocket_manager.send_execution_update({
            "execution_id": execution_id,
            "status": execution.status,
            "current_node": node_id,
            "message": execution.message
        })
        
        # For single node execution, we need to create a minimal workflow
        # This is a simplified implementation - in practice, you'd need to
        # load the node from the workflow store and create a minimal execution context
        
        # Create a mock node with appropriate parameters based on node type
        from schemas.schemas import WorkflowNode, NodeType, NodeStatus
        import os
        from pathlib import Path

        # Determine node type from the node_id or use a default
        # In a real implementation, this would come from the workflow store
        # For now, we'll default to Advanced Face Editor since that's what we're testing
        node_type = NodeType.XSEG_EDITOR  # Advanced Face Editor
        
        # Check for specific node types in the node_id - be VERY specific to avoid false positives
        # Only trigger specific node types for very explicit node IDs
        if node_id.lower() == "video-input" or node_id.lower() == "video_input":
            node_type = NodeType.VIDEO_INPUT
        elif node_id.lower() == "extract-faces" or node_id.lower() == "extract_faces":
            node_type = NodeType.EXTRACT_FACES
        elif node_id.lower() == "train-model" or node_id.lower() == "train_model":
            node_type = NodeType.TRAIN_MODEL
        elif node_id.lower() == "merge-faces" or node_id.lower() == "merge_faces":
            node_type = NodeType.MERGE_FACES
        elif node_id.lower() == "video-output" or node_id.lower() == "video_output":
            node_type = NodeType.VIDEO_OUTPUT
        elif "resize" in node_id.lower():
            node_type = NodeType.UTILITY  # Will be handled by specific node creation
        elif "filter" in node_id.lower():
            node_type = NodeType.UTILITY  # Will be handled by specific node creation
        elif "rename" in node_id.lower():
            node_type = NodeType.UTILITY  # Will be handled by specific node creation
        
        # Log the detected node type for debugging
        await websocket_manager.send_log_message("info", node_id, f"Detected node type: {node_type}")
        
        # Create appropriate parameters based on node type
        parameters = {}
        if node_type == NodeType.VIDEO_INPUT:
            # Create sample video path and output directory
            workspace_path = Path.cwd() / "workspace"
            
            # Use custom input file if provided, otherwise use default
            if custom_input_dir and Path(custom_input_dir).is_file():
                input_file = custom_input_dir
            else:
                input_file = workspace_path / "sample_videos" / "sample.mp4"
            
            output_dir = workspace_path / "output" / f"frames_{node_id}"
            
            # Create directories if they don't exist
            Path(input_file).parent.mkdir(parents=True, exist_ok=True)
            output_dir.mkdir(parents=True, exist_ok=True)
            
            parameters = {
                "input_file": str(input_file),
                "output_dir": str(output_dir),
                "fps": 0,  # Full fps
                "output_ext": "png"
            }
        elif node_type == NodeType.EXTRACT_FACES:
            parameters = {
                "input_dir": str(Path.cwd() / "workspace" / "sample_videos"),
                "output_dir": str(Path.cwd() / "workspace" / "output" / f"faces_{node_id}"),
                "detector": "S3FD",
                "face_type": "full_face"
            }
        elif node_type == NodeType.TRAIN_MODEL:
            parameters = {
                "src_dir": str(Path.cwd() / "workspace" / "output" / "faces_src"),
                "dst_dir": str(Path.cwd() / "workspace" / "output" / "faces_dst"),
                "model_name": "SAEHD",
                "batch_size": 4
            }
        elif node_type == NodeType.MERGE_FACES:
            parameters = {
                "model_path": str(Path.cwd() / "workspace" / "models" / "SAEHD"),
                "dst_faces_dir": str(Path.cwd() / "workspace" / "output" / "faces_dst"),
                "output_dir": str(Path.cwd() / "workspace" / "output" / f"merged_{node_id}")
            }
        elif node_type == NodeType.VIDEO_OUTPUT:
            parameters = {
                "input_dir": str(Path.cwd() / "workspace" / "output" / "merged"),
                "output_file": str(Path.cwd() / "workspace" / "output" / f"output_{node_id}.mp4"),
                "fps": 30
            }
        elif node_type == NodeType.XSEG_EDITOR:
            # Use the correct workspace path, but allow for custom input directories
            workspace_path = Path("/Volumes/MacOSNew/SourceCode/deepface-editor/deepface-workflow-editor/workspace")
            
            # Use custom input directory if provided, otherwise default to faces_test
            if custom_input_dir:
                input_dir = custom_input_dir
            else:
                # Default to faces_test directory
                input_dir = str(workspace_path / "output" / "faces_test")
            
            parameters = {
                "input_dir": input_dir,
                "face_type": "full_face",
                "detection_model": "VGGFace2",
                "similarity_threshold": 0.6
            }

        mock_node = WorkflowNode(
            id=node_id,
            type=node_type,
            position={"x": 0, "y": 0},
            parameters=parameters,
            status=NodeStatus.IDLE
        )

        # Execute the single node using the new method
        result = await workflow_engine.execute_single_node(mock_node, execution_id)

        if result["success"]:
            execution.status = ExecutionStatus.COMPLETED
            execution.completed_at = datetime.now().isoformat()
            execution.message = "Single node execution completed successfully"
        else:
            execution.status = ExecutionStatus.ERROR
            execution.error = result["error"]
            execution.message = f"Single node execution failed: {result['error']}"

        # Send final status update
        await websocket_manager.send_execution_update({
            "execution_id": execution_id,
            "status": execution.status,
            "current_node": node_id,
            "message": execution.message,
            "error": execution.error
        })

    except Exception as e:
        execution = executions_db[execution_id]
        execution.status = ExecutionStatus.ERROR
        execution.error = str(e)
        execution.message = f"Single node execution failed: {str(e)}"

        await websocket_manager.send_execution_update({
            "execution_id": execution_id,
            "status": execution.status,
            "current_node": node_id,
            "message": execution.message,
            "error": execution.error
        })