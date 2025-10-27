"""
End-to-end tests for complete face swap workflow
"""
import pytest
import asyncio
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

from backend.core.workflow_engine import WorkflowEngine
from backend.schemas.schemas import (
    Workflow, WorkflowNode, WorkflowEdge, 
    NodeStatus, ExecutionStatus, NodeType, PortType
)


class TestCompleteFaceSwapWorkflow:
    """Test complete face swap workflow from video to video"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.engine = WorkflowEngine()
        self.temp_dir = tempfile.mkdtemp()
        
        # Create test directories
        self.video_dir = Path(self.temp_dir) / "videos"
        self.frames_dir = Path(self.temp_dir) / "frames"
        self.faces_dir = Path(self.temp_dir) / "faces"
        self.model_dir = Path(self.temp_dir) / "model"
        self.output_dir = Path(self.temp_dir) / "output"
        
        for dir_path in [self.video_dir, self.frames_dir, self.faces_dir, self.model_dir, self.output_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # Create mock video file
        self.source_video = self.video_dir / "source.mp4"
        self.target_video = self.video_dir / "target.mp4"
        self.source_video.touch()
        self.target_video.touch()
        
        # Create complete face swap workflow
        self.face_swap_workflow = Workflow(
            id="face_swap_workflow",
            name="Complete Face Swap Workflow",
            description="End-to-end face swap from source video to target video",
            nodes=[
                # Extract frames from source video
                WorkflowNode(
                    id="extract_source_frames",
                    type=NodeType.VIDEO_INPUT,
                    parameters={
                        "input_file": str(self.source_video),
                        "output_dir": str(self.frames_dir / "source"),
                        "fps": 30,
                        "output_ext": "png"
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                # Extract frames from target video
                WorkflowNode(
                    id="extract_target_frames",
                    type=NodeType.VIDEO_INPUT,
                    parameters={
                        "input_file": str(self.target_video),
                        "output_dir": str(self.frames_dir / "target"),
                        "fps": 30,
                        "output_ext": "png"
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                # Extract faces from source frames
                WorkflowNode(
                    id="extract_source_faces",
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
                # Extract faces from target frames
                WorkflowNode(
                    id="extract_target_faces",
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
                # Train the model
                WorkflowNode(
                    id="train_model",
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
                ),
                # Merge faces back to target frames
                WorkflowNode(
                    id="merge_faces",
                    type=NodeType.MERGE_FACES,
                    parameters={
                        "merger_type": "seamless",
                        "face_enhancer": "GFPGAN",
                        "gpu_idx": 0
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                # Create final video
                WorkflowNode(
                    id="create_output_video",
                    type=NodeType.VIDEO_OUTPUT,
                    parameters={
                        "input_dir": str(self.output_dir),
                        "output_file": str(self.output_dir / "face_swap_result.mp4"),
                        "reference_file": str(self.target_video),
                        "fps": 30,
                        "ext": "png",
                        "include_audio": True
                    },
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                )
            ],
            edges=[
                # Source video -> source frames
                WorkflowEdge(
                    id="edge_1",
                    source="extract_source_frames",
                    target="extract_source_faces",
                    source_port="video_frames",
                    target_port="images"
                ),
                # Target video -> target frames
                WorkflowEdge(
                    id="edge_2",
                    source="extract_target_frames",
                    target="extract_target_faces",
                    source_port="video_frames",
                    target_port="images"
                ),
                # Source faces -> training
                WorkflowEdge(
                    id="edge_3",
                    source="extract_source_faces",
                    target="train_model",
                    source_port="faces",
                    target_port="faces"
                ),
                # Target faces -> training
                WorkflowEdge(
                    id="edge_4",
                    source="extract_target_faces",
                    target="train_model",
                    source_port="faces",
                    target_port="faces"
                ),
                # Model -> merging
                WorkflowEdge(
                    id="edge_5",
                    source="train_model",
                    target="merge_faces",
                    source_port="model",
                    target_port="model"
                ),
                # Target frames -> merging
                WorkflowEdge(
                    id="edge_6",
                    source="extract_target_frames",
                    target="merge_faces",
                    source_port="video_frames",
                    target_port="images"
                ),
                # Merged frames -> output video
                WorkflowEdge(
                    id="edge_7",
                    source="merge_faces",
                    target="create_output_video",
                    source_port="output_images",
                    target_port="image_sequence"
                )
            ],
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:00:00Z",
            version=1
        )
    
    def teardown_method(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_workflow_validation(self):
        """Test that the complete workflow is valid"""
        result = await self.engine._validate_workflow(self.face_swap_workflow)
        assert result["valid"] == True
    
    @pytest.mark.asyncio
    async def test_execution_order(self):
        """Test that execution order is correct"""
        execution_order = await self.engine._get_execution_order(self.face_swap_workflow)
        
        # First layer: video extraction (can run in parallel)
        first_layer = execution_order[:2]
        assert "extract_source_frames" in first_layer
        assert "extract_target_frames" in first_layer
        
        # Second layer: face extraction (can run in parallel)
        second_layer = execution_order[2:4]
        assert "extract_source_faces" in second_layer
        assert "extract_target_faces" in second_layer
        
        # Third layer: training (depends on both face extractions)
        assert execution_order[4] == "train_model"
        
        # Fourth layer: merging (depends on training and target frames)
        assert execution_order[5] == "merge_faces"
        
        # Fifth layer: video creation (depends on merging)
        assert execution_order[6] == "create_output_video"
    
    @pytest.mark.asyncio
    async def test_parallel_execution_layers(self):
        """Test that independent nodes execute in parallel"""
        # Mock node execution
        with patch.object(self.engine, '_execute_node_parallel') as mock_execute:
            mock_execute.return_value = {"success": True, "result": "test"}
            
            execution_context = {
                "workflow_id": "face_swap_workflow",
                "execution_id": "test_execution",
                "status": ExecutionStatus.RUNNING,
                "current_node": None,
                "progress": 0.0,
                "started_at": "2024-01-01T00:00:00Z",
                "nodes_completed": set(),
                "nodes_failed": set(),
                "workflow": self.face_swap_workflow
            }
            
            await self.engine._execute_workflow_parallel(self.face_swap_workflow, execution_context)
            
            # Should execute all 7 nodes
            assert mock_execute.call_count == 7
    
    @pytest.mark.asyncio
    async def test_complete_workflow_execution(self):
        """Test complete workflow execution with mocked DeepFaceLab calls"""
        # Mock the workflow loading
        with patch.object(self.engine, '_load_workflow') as mock_load:
            mock_load.return_value = self.face_swap_workflow
            
            # Mock all subprocess calls to DeepFaceLab
            with patch('subprocess.Popen') as mock_popen:
                mock_process = Mock()
                mock_process.wait.return_value = 0
                mock_process.stdout.read.return_value = b"Processing completed"
                mock_process.stderr.read.return_value = b""
                mock_popen.return_value = mock_process
                
                result = await self.engine.execute_workflow("face_swap_workflow", "test_execution")
                
                assert result["success"] == True
                assert "completed successfully" in result["message"]
    
    @pytest.mark.asyncio
    async def test_error_handling_during_execution(self):
        """Test error handling when a node fails"""
        # Mock the workflow loading
        with patch.object(self.engine, '_load_workflow') as mock_load:
            mock_load.return_value = self.face_swap_workflow
            
            # Mock subprocess calls to fail on face extraction
            with patch('subprocess.Popen') as mock_popen:
                mock_process = Mock()
                mock_process.wait.return_value = 1  # Failure
                mock_process.stdout.read.return_value = b""
                mock_process.stderr.read.return_value = b"Face detection failed"
                mock_popen.return_value = mock_process
                
                result = await self.engine.execute_workflow("face_swap_workflow", "test_execution")
                
                assert result["success"] == False
                assert "failed" in result["error"]
    
    @pytest.mark.asyncio
    async def test_workflow_with_xseg_editing(self):
        """Test workflow that includes XSeg editing step"""
        # Add XSeg editing step to the workflow
        xseg_workflow = self.face_swap_workflow.copy()
        
        # Add XSeg node
        xseg_node = WorkflowNode(
            id="xseg_edit",
            type=NodeType.XSEG_EDITOR,
            parameters={
                "dfl_path": "/path/to/dfl",
                "input_dir": str(self.faces_dir)
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        xseg_workflow.nodes.append(xseg_node)
        
        # Add edge from face extraction to XSeg editing
        xseg_edge = WorkflowEdge(
            id="xseg_edge",
            source="extract_source_faces",
            target="xseg_edit",
            source_port="faces",
            target_port="faces"
        )
        
        xseg_workflow.edges.append(xseg_edge)
        
        # Update training to depend on XSeg editing instead of direct face extraction
        for edge in xseg_workflow.edges:
            if edge.source == "extract_source_faces" and edge.target == "train_model":
                edge.source = "xseg_edit"
                break
        
        # Test workflow validation
        result = await self.engine._validate_workflow(xseg_workflow)
        assert result["valid"] == True
        
        # Test execution order includes XSeg editing
        execution_order = await self.engine._get_execution_order(xseg_workflow)
        assert "xseg_edit" in execution_order
        
        # XSeg editing should come after face extraction but before training
        xseg_index = execution_order.index("xseg_edit")
        extract_index = execution_order.index("extract_source_faces")
        train_index = execution_order.index("train_model")
        
        assert extract_index < xseg_index < train_index


class TestWorkflowTemplates:
    """Test workflow templates and common patterns"""
    
    @pytest.mark.asyncio
    async def test_basic_face_swap_template(self):
        """Test basic face swap template"""
        from backend.api.routes.workflow import load_template
        
        # Mock template loading
        with patch('backend.api.routes.workflow.load_template') as mock_load:
            template_data = {
                "name": "Basic Face Swap",
                "description": "Simple face swap between two videos",
                "nodes": [
                    {
                        "type": "video_input",
                        "parameters": {"input_file": "", "output_dir": ""}
                    },
                    {
                        "type": "extract_faces",
                        "parameters": {"detector": "s3fd", "face_type": "full_face"}
                    },
                    {
                        "type": "train_model",
                        "parameters": {"model_type": "SAEHD"}
                    },
                    {
                        "type": "merge_faces",
                        "parameters": {"merger_type": "seamless"}
                    },
                    {
                        "type": "video_output",
                        "parameters": {"output_file": ""}
                    }
                ],
                "edges": [
                    {"source": 0, "target": 1},
                    {"source": 1, "target": 2},
                    {"source": 2, "target": 3},
                    {"source": 3, "target": 4}
                ]
            }
            mock_load.return_value = template_data
            
            result = await load_template("basic-face-swap")
            assert result["name"] == "Basic Face Swap"
            assert len(result["nodes"]) == 5
            assert len(result["edges"]) == 4
    
    @pytest.mark.asyncio
    async def test_batch_processing_template(self):
        """Test batch processing template for multiple videos"""
        # Create a workflow that processes multiple source videos against one target
        batch_workflow = Workflow(
            id="batch_workflow",
            name="Batch Face Swap",
            description="Process multiple source videos against one target",
            nodes=[
                # Multiple source video inputs
                WorkflowNode(
                    id="source_1",
                    type=NodeType.VIDEO_INPUT,
                    parameters={"input_file": "/path/to/source1.mp4"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="source_2",
                    type=NodeType.VIDEO_INPUT,
                    parameters={"input_file": "/path/to/source2.mp4"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                # Single target video
                WorkflowNode(
                    id="target",
                    type=NodeType.VIDEO_INPUT,
                    parameters={"input_file": "/path/to/target.mp4"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                # Face extraction for all
                WorkflowNode(
                    id="extract_source_1",
                    type=NodeType.EXTRACT_FACES,
                    parameters={"detector": "s3fd"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="extract_source_2",
                    type=NodeType.EXTRACT_FACES,
                    parameters={"detector": "s3fd"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                ),
                WorkflowNode(
                    id="extract_target",
                    type=NodeType.EXTRACT_FACES,
                    parameters={"detector": "s3fd"},
                    status=NodeStatus.IDLE,
                    progress=0.0,
                    message="",
                    inputs={},
                    outputs={}
                )
            ],
            edges=[
                WorkflowEdge(id="e1", source="source_1", target="extract_source_1", source_port="video_frames", target_port="images"),
                WorkflowEdge(id="e2", source="source_2", target="extract_source_2", source_port="video_frames", target_port="images"),
                WorkflowEdge(id="e3", source="target", target="extract_target", source_port="video_frames", target_port="images")
            ],
            created_at="2024-01-01T00:00:00Z",
            updated_at="2024-01-01T00:00:00Z",
            version=1
        )
        
        engine = WorkflowEngine()
        
        # Test execution order - should have parallel extraction
        execution_order = await engine._get_execution_order(batch_workflow)
        
        # First layer: all video inputs (parallel)
        first_layer = execution_order[:3]
        assert "source_1" in first_layer
        assert "source_2" in first_layer
        assert "target" in first_layer
        
        # Second layer: all face extractions (parallel)
        second_layer = execution_order[3:6]
        assert "extract_source_1" in second_layer
        assert "extract_source_2" in second_layer
        assert "extract_target" in second_layer


if __name__ == "__main__":
    pytest.main([__file__])
