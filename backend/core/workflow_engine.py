import asyncio
import json
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
import uuid
from pathlib import Path

from schemas.schemas import Workflow, WorkflowNode, WorkflowEdge, NodeStatus, ExecutionStatus, ProgressUpdate
from nodes.base_node import BaseNode
from nodes.extract_node import ExtractNode
from nodes.train_node import TrainNode
from nodes.merge_node import MergeNode
from nodes.video_input_node import VideoInputNode
from nodes.video_output_node import VideoOutputNode
from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
from nodes.image_resize_node import ImageResizeNode
from nodes.face_filter_node import FaceFilterNode
from nodes.batch_rename_node import BatchRenameNode
from api.websocket import websocket_manager
from core.error_handler import error_handler, handle_execution_error, handle_resource_error, handle_critical_error

class WorkflowEngine:
    def __init__(self):
        self.running_executions: Dict[str, Dict[str, Any]] = {}
        self.node_instances: Dict[str, BaseNode] = {}
        self.execution_queue: asyncio.Queue = asyncio.Queue()
        
    async def execute_workflow(self, workflow_id: str, execution_id: str) -> Dict[str, Any]:
        """Execute a workflow"""
        try:
            # Load workflow (in real implementation, this would come from database)
            workflow = await self._load_workflow(workflow_id)
            if not workflow:
                return {"success": False, "error": "Workflow not found"}
            
            # Validate workflow
            validation_result = await self._validate_workflow(workflow)
            if not validation_result["valid"]:
                return {"success": False, "error": f"Workflow validation failed: {validation_result['error']}"}
            
            # Create execution context
            execution_context = {
                "workflow_id": workflow_id,
                "execution_id": execution_id,
                "status": ExecutionStatus.RUNNING,
                "current_node": None,
                "progress": 0.0,
                "started_at": datetime.now().isoformat(),
                "nodes_completed": set(),
                "nodes_failed": set(),
                "workflow": workflow
            }
            
            self.running_executions[execution_id] = execution_context
            
            # Execute workflow nodes in parallel where possible
            await self._execute_workflow_parallel(workflow, execution_context)
            
            # Finalize execution
            if execution_context["nodes_failed"]:
                execution_context["status"] = ExecutionStatus.ERROR
                return {"success": False, "error": f"Execution failed at node: {list(execution_context['nodes_failed'])[0]}"}
            else:
                execution_context["status"] = ExecutionStatus.COMPLETED
                execution_context["completed_at"] = datetime.now().isoformat()
                return {"success": True, "message": "Workflow completed successfully"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            # Clean up execution context
            if execution_id in self.running_executions:
                del self.running_executions[execution_id]
    
    async def stop_execution(self, execution_id: str):
        """Stop a running execution"""
        if execution_id in self.running_executions:
            execution_context = self.running_executions[execution_id]
            execution_context["status"] = ExecutionStatus.PAUSED
            
            # Stop current node if running
            current_node_id = execution_context.get("current_node")
            if current_node_id:
                await self._send_node_update(current_node_id, {
                    "status": NodeStatus.PAUSED,
                    "message": "Execution paused by user"
                })
    
    async def resume_execution(self, execution_id: str) -> Dict[str, Any]:
        """Resume a paused execution"""
        if execution_id not in self.running_executions:
            return {"success": False, "error": "Execution not found"}
        
        execution_context = self.running_executions[execution_id]
        execution_context["status"] = ExecutionStatus.RUNNING
        
        # Resume from where we left off
        workflow = execution_context["workflow"]
        execution_order = await self._get_execution_order(workflow)
        
        # Find the next node to execute
        completed_nodes = execution_context["nodes_completed"]
        next_node_id = None
        
        for node_id in execution_order:
            if node_id not in completed_nodes and node_id not in execution_context["nodes_failed"]:
                next_node_id = node_id
                break
        
        if not next_node_id:
            return {"success": True, "message": "No more nodes to execute"}
        
        # Continue execution from the next node
        # This is a simplified implementation - in practice, you'd need to handle
        # the partial execution state more carefully
        return await self.execute_workflow(execution_context["workflow_id"], execution_id)
    
    async def execute_single_node(self, node: WorkflowNode, execution_id: str) -> Dict[str, Any]:
        """Execute a single node without requiring a full workflow"""
        try:
            # Create execution context
            execution_context = {
                "execution_id": execution_id,
                "workspace_path": str(Path.cwd() / "workspace"),
                "start_time": datetime.now().isoformat()
            }
            
            # Create node instance
            node_instance = await self._create_node_instance(node)
            
            # Update node status
            await websocket_manager.send_node_update(
                node_id=node.id,
                update_data={
                    "status": NodeStatus.RUNNING,
                    "progress": 0,
                    "message": "Starting node execution..."
                }
            )
            
            # Execute the node
            result = await node_instance.execute(execution_context)
            
            # Update final status
            if result.get("success", False):
                await websocket_manager.send_node_update(
                    node_id=node.id,
                    update_data={
                        "status": NodeStatus.COMPLETED,
                        "progress": 100,
                        "message": "Node execution completed successfully"
                    }
                )
            else:
                await websocket_manager.send_node_update(
                    node_id=node.id,
                    update_data={
                        "status": NodeStatus.ERROR,
                        "progress": 0,
                        "message": result.get("error", "Node execution failed")
                    }
                )
            
            return result
            
        except Exception as e:
            await websocket_manager.send_node_update(
                node_id=node.id,
                update_data={
                    "status": NodeStatus.ERROR,
                    "progress": 0,
                    "message": f"Node execution failed: {str(e)}"
                }
            )
            return {"success": False, "error": str(e)}

    async def _load_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Load workflow from storage (placeholder implementation)"""
        # In real implementation, this would load from database
        # For now, return None to indicate workflow not found
        return None
    
    async def _validate_workflow(self, workflow: Workflow) -> Dict[str, Any]:
        """Validate workflow structure and connections"""
        try:
            # Check for cycles
            if await self._has_cycles(workflow):
                return {"valid": False, "error": "Workflow contains cycles"}
            
            # Check for required inputs
            for node in workflow.nodes:
                for input_port in node.inputs:
                    if input_port not in node.inputs:
                        return {"valid": False, "error": f"Node {node.id} missing required input {input_port}"}
            
            return {"valid": True}
            
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    async def _get_execution_order(self, workflow: Workflow) -> List[str]:
        """Get topological order of nodes for execution"""
        # Build adjacency list
        graph = {node.id: [] for node in workflow.nodes}
        in_degree = {node.id: 0 for node in workflow.nodes}
        
        for edge in workflow.edges:
            graph[edge.source].append(edge.target)
            in_degree[edge.target] += 1
        
        # Topological sort using Kahn's algorithm
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            current = queue.pop(0)
            result.append(current)
            
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        
        return result
    
    async def _has_cycles(self, workflow: Workflow) -> bool:
        """Check if workflow has cycles"""
        visited = set()
        rec_stack = set()
        
        def dfs(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)
            
            # Find outgoing edges
            for edge in workflow.edges:
                if edge.source == node_id:
                    if edge.target in rec_stack:
                        return True
                    if edge.target not in visited and dfs(edge.target):
                        return True
            
            rec_stack.remove(node_id)
            return False
        
        for node in workflow.nodes:
            if node.id not in visited:
                if dfs(node.id):
                    return True
        
        return False
    
    async def _execute_workflow_parallel(self, workflow: Workflow, execution_context: Dict[str, Any]):
        """Execute workflow nodes in parallel where possible"""
        # Build dependency graph
        dependencies = {node.id: set() for node in workflow.nodes}
        dependents = {node.id: set() for node in workflow.nodes}
        
        for edge in workflow.edges:
            dependencies[edge.target].add(edge.source)
            dependents[edge.source].add(edge.target)
        
        # Group nodes by dependency level (layers)
        layers = []
        remaining_nodes = set(node.id for node in workflow.nodes)
        
        while remaining_nodes:
            # Find nodes with no remaining dependencies
            current_layer = []
            for node_id in remaining_nodes:
                if not dependencies[node_id] or dependencies[node_id].issubset(execution_context["nodes_completed"]):
                    current_layer.append(node_id)
            
            if not current_layer:
                # Circular dependency or error
                raise ValueError("Circular dependency detected or unable to resolve dependencies")
            
            layers.append(current_layer)
            remaining_nodes -= set(current_layer)
        
        total_nodes = len(workflow.nodes)
        
        # Execute each layer in parallel
        for layer in layers:
            if execution_context["nodes_failed"]:
                break  # Stop if any node failed
                
            # Execute all nodes in current layer in parallel
            tasks = []
            for node_id in layer:
                node = next((n for n in workflow.nodes if n.id == node_id), None)
                if node:
                    task = self._execute_node_parallel(node, execution_context)
                    tasks.append(task)
            
            # Wait for all nodes in this layer to complete
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for i, result in enumerate(results):
                    node_id = layer[i]
                    node = next((n for n in workflow.nodes if n.id == node_id), None)
                    
                    if isinstance(result, Exception):
                        # Node failed
                        node.status = NodeStatus.ERROR
                        node.message = str(result)
                        execution_context["nodes_failed"].add(node_id)
                        
                        await self._send_node_update(node_id, {
                            "status": NodeStatus.ERROR,
                            "progress": 0.0,
                            "message": str(result)
                        })
                    elif result and result.get("success", False):
                        # Node succeeded
                        node.status = NodeStatus.COMPLETED
                        node.progress = 100.0
                        node.message = "Completed successfully"
                        execution_context["nodes_completed"].add(node_id)
                        
                        await self._send_node_update(node_id, {
                            "status": NodeStatus.COMPLETED,
                            "progress": 100.0,
                            "message": "Completed successfully"
                        })
                    else:
                        # Node failed
                        node.status = NodeStatus.ERROR
                        node.message = result.get("error", "Unknown error") if result else "No result"
                        execution_context["nodes_failed"].add(node_id)
                        
                        await self._send_node_update(node_id, {
                            "status": NodeStatus.ERROR,
                            "progress": 0.0,
                            "message": node.message
                        })
            
            # Update overall progress
            completed_count = len(execution_context["nodes_completed"])
            execution_context["progress"] = (completed_count / total_nodes) * 100
            await self._send_execution_update(execution_context)
    
    async def _execute_node_parallel(self, node: WorkflowNode, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single node (for parallel execution)"""
        try:
            # Create node instance based on type
            node_instance = await self._create_node_instance(node)
            
            # Send node update
            await self._send_node_update(node.id, {
                "status": NodeStatus.RUNNING,
                "progress": 0,
                "message": "Starting execution..."
            })
            
            # Execute the node
            result = await node_instance.execute(execution_context)
            
            return result
            
        except Exception as e:
            # Handle execution error
            await handle_execution_error(
                error=e,
                node_id=node.id,
                workflow_id=execution_context.get("workflow_id"),
                execution_id=execution_context.get("execution_id"),
                details={
                    "node_type": node.type,
                    "node_parameters": node.parameters
                },
                halt_workflow=False  # Don't halt immediately in parallel execution
            )
            
            return {"success": False, "error": str(e)}
    
    async def _create_node_instance(self, node: WorkflowNode) -> BaseNode:
        """Create node instance based on node type"""
        node_type = node.type
        
        if node_type == "video_input":
            return VideoInputNode(node)
        elif node_type == "extract_faces":
            return ExtractNode(node)
        elif node_type == "train_model":
            return TrainNode(node)
        elif node_type == "merge_faces":
            return MergeNode(node)
        elif node_type == "video_output":
            return VideoOutputNode(node)
        elif node_type == "xseg_editor":
            return AdvancedFaceEditorNode(node)
        elif node_type == "image_resize":
            return ImageResizeNode(node)
        elif node_type == "face_filter":
            return FaceFilterNode(node)
        elif node_type == "batch_rename":
            return BatchRenameNode(node)
        else:
            # Default base node for unsupported types
            return BaseNode(node)
    
    async def _send_node_update(self, node_id: str, update_data: Dict[str, Any]):
        """Send node update via WebSocket"""
        await websocket_manager.send_node_update(node_id, update_data)
    
    async def _send_execution_update(self, execution_context: Dict[str, Any]):
        """Send execution update via WebSocket"""
        update_data = {
            "execution_id": execution_context["execution_id"],
            "status": execution_context["status"],
            "progress": execution_context["progress"],
            "current_node": execution_context.get("current_node"),
            "message": f"Progress: {execution_context['progress']:.1f}%"
        }
        await websocket_manager.send_execution_update(update_data)
