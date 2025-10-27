from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import uuid
from datetime import datetime

from schemas.schemas import NodePreset, WorkflowNode, NodeType, NodeStatus
from core.preset_manager import PresetManager

router = APIRouter()
preset_manager = PresetManager()

@router.post("/", response_model=NodePreset)
async def save_preset(preset: NodePreset):
    """Save a node preset"""
    try:
        # Generate ID if not provided
        if not preset.id:
            preset.id = f"preset-{uuid.uuid4().hex[:8]}"
        
        # Set timestamps
        now = datetime.now().isoformat()
        if not preset.created_at:
            preset.created_at = now
        preset.updated_at = now
        
        saved_preset = await preset_manager.save_preset(preset)
        return saved_preset
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save preset: {str(e)}")

@router.get("/", response_model=List[NodePreset])
async def list_presets():
    """List all presets"""
    try:
        presets = await preset_manager.list_presets()
        return presets
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list presets: {str(e)}")

@router.get("/{preset_id}", response_model=NodePreset)
async def get_preset(preset_id: str):
    """Get a specific preset"""
    try:
        preset = await preset_manager.get_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        return preset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preset: {str(e)}")

@router.put("/{preset_id}", response_model=NodePreset)
async def update_preset(preset_id: str, preset_update: Dict[str, Any]):
    """Update a preset"""
    try:
        preset_update["updated_at"] = datetime.now().isoformat()
        updated_preset = await preset_manager.update_preset(preset_id, preset_update)
        if not updated_preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        return updated_preset
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preset: {str(e)}")

@router.delete("/{preset_id}")
async def delete_preset(preset_id: str):
    """Delete a preset"""
    try:
        success = await preset_manager.delete_preset(preset_id)
        if not success:
            raise HTTPException(status_code=404, detail="Preset not found")
        return {"message": "Preset deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete preset: {str(e)}")

@router.get("/by-type/{node_type}", response_model=List[NodePreset])
async def get_presets_by_type(node_type: str):
    """Get presets by node type"""
    try:
        # Validate node type
        try:
            NodeType(node_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid node type: {node_type}")
        
        presets = await preset_manager.get_presets_by_type(node_type)
        return presets
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get presets by type: {str(e)}")

@router.post("/{preset_id}/load-into-workflow", response_model=WorkflowNode)
async def load_preset_into_workflow(preset_id: str, position: Dict[str, float]):
    """Load a preset as a workflow node"""
    try:
        preset = await preset_manager.get_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="Preset not found")
        
        # Create a workflow node from the preset
        node_id = f"node-{uuid.uuid4().hex[:8]}"
        workflow_node = WorkflowNode(
            id=node_id,
            type=preset.nodeType,
            position=position,
            parameters=preset.parameters,
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        return workflow_node
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load preset into workflow: {str(e)}")


