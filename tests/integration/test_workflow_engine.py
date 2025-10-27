"""
Integration tests for workflow engine and API
"""
import pytest
import asyncio
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

from backend.core.workflow_engine import WorkflowEngine
from backend.schemas.schemas import (
    Workflow, WorkflowNode, WorkflowEdge, 
    NodeStatus, ExecutionStatus, NodeType, PortType
)


class TestWorkflowEngine:
    """Test workflow engine functionality"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.engine = WorkflowEngine()
        
        # Create a simple test workflow
        self.test_workflow = Workflow(
            id="test_workflow",
            name="Test Workflow",
            description="A test workflow",
            nodes=[
                WorkflowNode(
                    id="video_input_1",
                    type=NodeType.VIDEO_INPUT,
                    parameters={
                        "input_file": "/path/to/video.mp4",
                        "output_dir": "/path/to/frames",
                        "fps": 30,
                        "output_ext": "png"
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="extract_1",
                    type=NodeType.EXTRACT_FACES,
                    parameters={
                        "detector": "s3fd",
                        "face_type": "full_face",
                        "image_size": 512,
                        "gpu_idx": 0
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="train_1",
                    type=NodeType.TRAIN_MODEL,
                    parameters={
                        "model_type": "SAEHD",
                        "batch_size": 4,
                        "resolution": 256,
                        "gpu_idx": 0
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                )
            ],
            edges=[
                WorkflowEdge(
                    id="edge_1",
                    source="video_input_1",
                    target="extract_1",
                    source_port="video_frames",
                    target_port="images"
                ),
                WorkflowEdge(
                    id="edge_2",
                    source="extract_1",
                    target="train_1",
                    source_port="faces",
                    target_port="faces"
                )
            ],
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:00:00Z",
            version=1
        )
    
    @pytest.mark.asyncio
    async def test_workflow_validation(self):
        """Test workflow validation"""
        # Test valid workflow
        result = await self.engine._validate_workflow(self.test_workflow)
        assert result["valid"] == True
        
        # Test workflow with cycles
        cyclic_workflow = self.test_workflow.copy()
        cyclic_workflow.edges.append(
            WorkflowEdge(
                id="cycle_edge",
                source="train_1",
                target="video_input_1",
                source_port="model",
                target_port="video"
            )
        )
        
        result = await self.engine._validate_workflow(cyclic_workflow)
        assert result["valid"] == False
        assert "cycle" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_execution_order(self):
        """Test execution order calculation"""
        execution_order = await self.engine._get_execution_order(self.test_workflow)
        
        # Should start with video_input_1 (no dependencies)
        assert execution_order[0] == "video_input_1"
        # Should follow with extract_1 (depends on video_input_1)
        assert execution_order[1] == "extract_1"
        # Should end with train_1 (depends on extract_1)
        assert execution_order[2] == "train_1"
    
    @pytest.mark.asyncio
    async def test_parallel_execution(self):
        """Test parallel execution of independent nodes"""
        # Create workflow with independent nodes
        parallel_workflow = Workflow(
            id="parallel_workflow",
            name="Parallel Workflow",
            description="A workflow with independent nodes",
            nodes=[
                WorkflowNode(
                    id="node_1",
                    type=NodeType.VIDEO_INPUT,
                    parameters={"input_file": "/path/to/video1.mp4"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="node_2",
                    type=NodeType.VIDEO_INPUT,
                    parameters={"input_file": "/path/to/video2.mp4"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="merge_node",
                    type=NodeType.MERGE_FACES,
                    parameters={"merger_type": "seamless"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                )
            ],
            edges=[
                WorkflowEdge(
                    id="edge_1",
                    source="node_1",
                    target="merge_node",
                    source_port="video_frames",
                    target_port="faces"
                ),
                WorkflowEdge(
                    id="edge_2",
                    source="node_2",
                    target="merge_node",
                    source_port="video_frames",
                    target_port="faces"
                )
            ],
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:00:00Z",
            version=1
        )
        
        # Mock the node execution
        with patch.object(self.engine, '_execute_node_parallel') as mock_execute:
            mock_execute.return_value = {"success": True, "result": "test"}
            
            execution_context = {
                "workflow_id": "parallel_workflow",
                "execution_id": "test_execution",
                "status": ExecutionStatus.RUNNING,
                "current_node": None,
                "progress": 0.0,
                "started_at": "2024-01-01T00:00:00Z",
                "nodes_completed": set(),
                "nodes_failed": set(),
                "workflow": parallel_workflow
            }
            
            await self.engine._execute_workflow_parallel(parallel_workflow, execution_context)
            
            # Should execute node_1 and node_2 in parallel (first layer)
            # Then execute merge_node (second layer)
            assert mock_execute.call_count == 3
    
    @pytest.mark.asyncio
    async def test_workflow_execution(self):
        """Test complete workflow execution"""
        # Mock the workflow loading
        with patch.object(self.engine, '_load_workflow') as mock_load:
            mock_load.return_value = self.test_workflow
            
            # Mock node execution
            with patch.object(self.engine, '_execute_node_parallel') as mock_execute:
                mock_execute.return_value = {"success": True, "result": "test"}
                
                result = await self.engine.execute_workflow("test_workflow", "test_execution")
                
                assert result["success"] == True
                assert "completed successfully" in result["message"]
    
    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling during execution"""
        # Mock the workflow loading
        with patch.object(self.engine, '_load_workflow') as mock_load:
            mock_load.return_value = self.test_workflow
            
            # Mock node execution to fail
            with patch.object(self.engine, '_execute_node_parallel') as mock_execute:
                mock_execute.return_value = {"success": False, "error": "Test error"}
                
                result = await self.engine.execute_workflow("test_workflow", "test_execution")
                
                assert result["success"] == False
                assert "Test error" in result["error"]
    
    def test_node_instance_creation(self):
        """Test node instance creation"""
        # Test video input node
        video_node = WorkflowNode(
            id="video_1",
            type=NodeType.VIDEO_INPUT,
            parameters={},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        instance = asyncio.run(self.engine._create_node_instance(video_node))
        assert instance.node_id == "video_1"
        assert instance.node_type == "video_input"
        
        # Test extract node
        extract_node = WorkflowNode(
            id="extract_1",
            type=NodeType.EXTRACT_FACES,
            parameters={},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        instance = asyncio.run(self.engine._create_node_instance(extract_node))
        assert instance.node_id == "extract_1"
        assert instance.node_type == "extract_faces"


class TestWorkflowAPI:
    """Test workflow API endpoints"""
    
    @pytest.mark.asyncio
    async def test_create_workflow(self):
        """Test workflow creation via API"""
        from backend.api.routes.workflow import create_workflow
        
        workflow_data = {
            "name": "Test Workflow",
            "description": "A test workflow",
            "nodes": [],
            "edges": []
        }
        
        # Mock the database save
        with patch('backend.api.routes.workflow.save_workflow') as mock_save:
            mock_save.return_value = "test_workflow_id"
            
            result = await create_workflow(workflow_data)
            assert result["id"] == "test_workflow_id"
            assert result["name"] == "Test Workflow"
    
    @pytest.mark.asyncio
    async def test_get_workflow(self):
        """Test workflow retrieval via API"""
        from backend.api.routes.workflow import get_workflow
        
        # Mock the database load
        with patch('backend.api.routes.workflow.load_workflow') as mock_load:
            mock_workflow = {
                "id": "test_workflow",
                "name": "Test Workflow",
                "description": "A test workflow",
                "nodes": [],
                "edges": []
            }
            mock_load.return_value = mock_workflow
            
            result = await get_workflow("test_workflow")
            assert result["id"] == "test_workflow"
            assert result["name"] == "Test Workflow"


class TestNodeDefinitions:
    """Test node definition API"""
    
    @pytest.mark.asyncio
    async def test_get_node_definitions(self):
        """Test getting all node definitions"""
        from backend.api.routes.nodes import get_node_definitions
        
        definitions = await get_node_definitions()
        
        # Should have all node types
        node_types = [defn.type for defn in definitions]
        assert NodeType.VIDEO_INPUT in node_types
        assert NodeType.EXTRACT_FACES in node_types
        assert NodeType.TRAIN_MODEL in node_types
        assert NodeType.MERGE_FACES in node_types
        assert NodeType.VIDEO_OUTPUT in node_types
        assert NodeType.XSEG_EDITOR in node_types
    
    @pytest.mark.asyncio
    async def test_get_node_definition(self):
        """Test getting specific node definition"""
        from backend.api.routes.nodes import get_node_definition
        
        # Test video input node
        definition = await get_node_definition("video_input")
        assert definition.type == NodeType.VIDEO_INPUT
        assert definition.name == "Video Input"
        assert len(definition.outputs) > 0
        
        # Test extract faces node
        definition = await get_node_definition("extract_faces")
        assert definition.type == NodeType.EXTRACT_FACES
        assert definition.name == "Extract Faces"
        assert len(definition.inputs) > 0
        assert len(definition.outputs) > 0


if __name__ == "__main__":
    pytest.main([__file__])
