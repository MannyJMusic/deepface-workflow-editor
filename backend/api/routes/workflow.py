from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import json
import os

from schemas.schemas import Workflow, WorkflowNode, WorkflowEdge, NodeStatus

router = APIRouter()

# In-memory storage for demo (replace with database in production)
workflows_db: Dict[str, Workflow] = {}

@router.get("/", response_model=List[Workflow])
async def list_workflows():
    """Get all workflows"""
    return list(workflows_db.values())

@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(workflow_id: str):
    """Get a specific workflow by ID"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflows_db[workflow_id]

@router.post("/", response_model=Workflow)
async def create_workflow(workflow: Workflow):
    """Create a new workflow"""
    workflow_id = str(uuid.uuid4())
    workflow.id = workflow_id
    workflow.created_at = datetime.now().isoformat()
    workflow.updated_at = workflow.created_at
    
    workflows_db[workflow_id] = workflow
    return workflow

@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(workflow_id: str, workflow: Workflow):
    """Update an existing workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow.id = workflow_id
    workflow.updated_at = datetime.now().isoformat()
    workflows_db[workflow_id] = workflow
    return workflow

@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Delete a workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    del workflows_db[workflow_id]
    return {"message": "Workflow deleted successfully"}

@router.post("/{workflow_id}/nodes", response_model=WorkflowNode)
async def add_node(workflow_id: str, node: WorkflowNode):
    """Add a node to a workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflows_db[workflow_id]
    node.id = str(uuid.uuid4())
    workflow.nodes.append(node)
    workflow.updated_at = datetime.now().isoformat()
    
    return node

@router.put("/{workflow_id}/nodes/{node_id}", response_model=WorkflowNode)
async def update_node(workflow_id: str, node_id: str, node: WorkflowNode):
    """Update a node in a workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflows_db[workflow_id]
    node_index = next((i for i, n in enumerate(workflow.nodes) if n.id == node_id), None)
    
    if node_index is None:
        raise HTTPException(status_code=404, detail="Node not found")
    
    node.id = node_id
    workflow.nodes[node_index] = node
    workflow.updated_at = datetime.now().isoformat()
    
    return node

@router.delete("/{workflow_id}/nodes/{node_id}")
async def delete_node(workflow_id: str, node_id: str):
    """Delete a node from a workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflows_db[workflow_id]
    workflow.nodes = [n for n in workflow.nodes if n.id != node_id]
    workflow.edges = [e for e in workflow.edges if e.source != node_id and e.target != node_id]
    workflow.updated_at = datetime.now().isoformat()
    
    return {"message": "Node deleted successfully"}

@router.post("/{workflow_id}/edges", response_model=WorkflowEdge)
async def add_edge(workflow_id: str, edge: WorkflowEdge):
    """Add an edge to a workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflows_db[workflow_id]
    edge.id = str(uuid.uuid4())
    workflow.edges.append(edge)
    workflow.updated_at = datetime.now().isoformat()
    
    return edge

@router.delete("/{workflow_id}/edges/{edge_id}")
async def delete_edge(workflow_id: str, edge_id: str):
    """Delete an edge from a workflow"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflows_db[workflow_id]
    workflow.edges = [e for e in workflow.edges if e.id != edge_id]
    workflow.updated_at = datetime.now().isoformat()
    
    return {"message": "Edge deleted successfully"}

@router.post("/{workflow_id}/export")
async def export_workflow(workflow_id: str):
    """Export workflow as JSON file"""
    if workflow_id not in workflows_db:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    workflow = workflows_db[workflow_id]
    export_data = {
        "workflow": workflow.dict(),
        "exported_at": datetime.now().isoformat(),
        "version": "1.0"
    }
    
    return export_data

@router.post("/import")
async def import_workflow(workflow_data: Dict[str, Any]):
    """Import workflow from JSON data"""
    try:
        workflow_dict = workflow_data.get("workflow", workflow_data)
        workflow = Workflow(**workflow_dict)
        
        workflow_id = str(uuid.uuid4())
        workflow.id = workflow_id
        workflow.created_at = datetime.now().isoformat()
        workflow.updated_at = workflow.created_at
        
        workflows_db[workflow_id] = workflow
        return workflow
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid workflow data: {str(e)}")
