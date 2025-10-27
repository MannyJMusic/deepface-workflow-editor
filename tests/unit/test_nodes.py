"""
Unit tests for individual node implementations
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

from backend.nodes.base_node import BaseNode
from backend.nodes.extract_node import ExtractNode
from backend.nodes.train_node import TrainNode
from backend.nodes.merge_node import MergeNode
from backend.nodes.video_input_node import VideoInputNode
from backend.nodes.video_output_node import VideoOutputNode
from backend.nodes.xseg_node import XSegNode
from backend.schemas.schemas import WorkflowNode, NodeStatus


class TestBaseNode:
    """Test the base node functionality"""
    
    def test_base_node_initialization(self):
        """Test base node initialization"""
        node_data = WorkflowNode(
            id="test_node",
            type="test_type",
            parameters={"param1": "value1"},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = BaseNode(node_data)
        assert node.node_id == "test_node"
        assert node.node_type == "test_type"
        assert node.parameters == {"param1": "value1"}
        assert node.status == NodeStatus.IDLE
        assert node.progress == 0.0
    
    def test_parameter_validation(self):
        """Test parameter validation"""
        node_data = WorkflowNode(
            id="test_node",
            type="test_type",
            parameters={"required_param": "value"},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = BaseNode(node_data)
        
        # Test with valid parameters
        assert node.validate_parameters() == True
        
        # Test with missing required parameters
        node_data.parameters = {}
        node = BaseNode(node_data)
        # Base node should pass validation by default
        assert node.validate_parameters() == True


class TestVideoInputNode:
    """Test video input node functionality"""
    
    def test_video_input_node_initialization(self):
        """Test video input node initialization"""
        node_data = WorkflowNode(
            id="video_input_1",
            type="video_input",
            parameters={
                "input_file": "/path/to/video.mp4",
                "output_dir": "/path/to/output",
                "fps": 30,
                "output_ext": "png"
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = VideoInputNode(node_data.id, node_data.parameters)
        assert node.node_id == "video_input_1"
        assert node.node_type == "video_input"
        assert node.parameters["input_file"] == "/path/to/video.mp4"
    
    @pytest.mark.asyncio
    async def test_video_input_execution(self):
        """Test video input node execution"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create a mock video file
            video_path = Path(temp_dir) / "test_video.mp4"
            video_path.touch()
            
            node_data = WorkflowNode(
                id="video_input_1",
                type="video_input",
                parameters={
                    "input_file": str(video_path),
                    "output_dir": str(Path(temp_dir) / "output"),
                    "fps": 30,
                    "output_ext": "png"
                },
                status=NodeStatus.IDLE,
                progress=0.0,
                message="",
                inputs={},
                outputs={}
            )
            
            node = VideoInputNode(node_data.id, node_data.parameters)
            
            # Mock the subprocess execution
            with patch('subprocess.Popen') as mock_popen:
                mock_process = Mock()
                mock_process.wait.return_value = 0
                mock_process.stdout.read.return_value = b"Video processing completed"
                mock_process.stderr.read.return_value = b""
                mock_popen.return_value = mock_process
                
                context = {"dfl_path": "/path/to/dfl"}
                result = await node.execute(context)
                
                assert result["success"] == True
                assert "output_dir" in result


class TestExtractNode:
    """Test face extraction node functionality"""
    
    def test_extract_node_initialization(self):
        """Test extract node initialization"""
        node_data = WorkflowNode(
            id="extract_1",
            type="extract_faces",
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
        )
        
        node = ExtractNode(node_data)
        assert node.node_id == "extract_1"
        assert node.node_type == "extract_faces"
        assert node.parameters["detector"] == "s3fd"
    
    @pytest.mark.asyncio
    async def test_extract_node_execution(self):
        """Test extract node execution"""
        node_data = WorkflowNode(
            id="extract_1",
            type="extract_faces",
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
        )
        
        node = ExtractNode(node_data)
        
        # Mock the DeepFaceLab execution
        with patch('subprocess.Popen') as mock_popen:
            mock_process = Mock()
            mock_process.wait.return_value = 0
            mock_process.stdout.read.return_value = b"Face extraction completed"
            mock_process.stderr.read.return_value = b""
            mock_popen.return_value = mock_process
            
            context = {
                "input_dir": "/path/to/images",
                "output_dir": "/path/to/faces",
                "dfl_path": "/path/to/dfl"
            }
            
            result = await node.execute(context)
            
            assert result["success"] == True
            assert "faces_dir" in result


class TestTrainNode:
    """Test model training node functionality"""
    
    def test_train_node_initialization(self):
        """Test train node initialization"""
        node_data = WorkflowNode(
            id="train_1",
            type="train_model",
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
        
        node = TrainNode(node_data)
        assert node.node_id == "train_1"
        assert node.node_type == "train_model"
        assert node.parameters["model_type"] == "SAEHD"
    
    @pytest.mark.asyncio
    async def test_train_node_execution(self):
        """Test train node execution"""
        node_data = WorkflowNode(
            id="train_1",
            type="train_model",
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
        
        node = TrainNode(node_data)
        
        # Mock the DeepFaceLab training execution
        with patch('subprocess.Popen') as mock_popen:
            mock_process = Mock()
            mock_process.wait.return_value = 0
            mock_process.stdout.read.return_value = b"Training completed"
            mock_process.stderr.read.return_value = b""
            mock_popen.return_value = mock_process
            
            context = {
                "data_src_dir": "/path/to/src",
                "data_dst_dir": "/path/to/dst",
                "model_dir": "/path/to/model",
                "dfl_path": "/path/to/dfl"
            }
            
            result = await node.execute(context)
            
            assert result["success"] == True
            assert "model_path" in result


class TestMergeNode:
    """Test face merging node functionality"""
    
    def test_merge_node_initialization(self):
        """Test merge node initialization"""
        node_data = WorkflowNode(
            id="merge_1",
            type="merge_faces",
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
        )
        
        node = MergeNode(node_data)
        assert node.node_id == "merge_1"
        assert node.node_type == "merge_faces"
        assert node.parameters["merger_type"] == "seamless"
    
    @pytest.mark.asyncio
    async def test_merge_node_execution(self):
        """Test merge node execution"""
        node_data = WorkflowNode(
            id="merge_1",
            type="merge_faces",
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
        )
        
        node = MergeNode(node_data)
        
        # Mock the DeepFaceLab merging execution
        with patch('subprocess.Popen') as mock_popen:
            mock_process = Mock()
            mock_process.wait.return_value = 0
            mock_process.stdout.read.return_value = b"Merging completed"
            mock_process.stderr.read.return_value = b""
            mock_popen.return_value = mock_process
            
            context = {
                "model_path": "/path/to/model",
                "input_dir": "/path/to/input",
                "output_dir": "/path/to/output",
                "dfl_path": "/path/to/dfl"
            }
            
            result = await node.execute(context)
            
            assert result["success"] == True
            assert "output_dir" in result


class TestVideoOutputNode:
    """Test video output node functionality"""
    
    def test_video_output_node_initialization(self):
        """Test video output node initialization"""
        node_data = WorkflowNode(
            id="video_output_1",
            type="video_output",
            parameters={
                "input_dir": "/path/to/images",
                "output_file": "/path/to/output.mp4",
                "fps": 30,
                "ext": "png"
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = VideoOutputNode(node_data.id, node_data.parameters)
        assert node.node_id == "video_output_1"
        assert node.node_type == "video_output"
        assert node.parameters["output_file"] == "/path/to/output.mp4"
    
    @pytest.mark.asyncio
    async def test_video_output_execution(self):
        """Test video output node execution"""
        node_data = WorkflowNode(
            id="video_output_1",
            type="video_output",
            parameters={
                "input_dir": "/path/to/images",
                "output_file": "/path/to/output.mp4",
                "fps": 30,
                "ext": "png"
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = VideoOutputNode(node_data.id, node_data.parameters)
        
        # Mock the subprocess execution
        with patch('subprocess.Popen') as mock_popen:
            mock_process = Mock()
            mock_process.wait.return_value = 0
            mock_process.stdout.read.return_value = b"Video creation completed"
            mock_process.stderr.read.return_value = b""
            mock_popen.return_value = mock_process
            
            context = {"dfl_path": "/path/to/dfl"}
            result = await node.execute(context)
            
            assert result["success"] == True
            assert "output_file" in result


class TestXSegNode:
    """Test XSeg editor node functionality"""
    
    def test_xseg_node_initialization(self):
        """Test XSeg node initialization"""
        node_data = WorkflowNode(
            id="xseg_1",
            type="xseg_editor",
            parameters={
                "dfl_path": "/path/to/dfl",
                "input_dir": "/path/to/faces"
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = XSegNode(node_data)
        assert node.node_id == "xseg_1"
        assert node.node_type == "xseg_editor"
        assert node.parameters["dfl_path"] == "/path/to/dfl"
    
    @pytest.mark.asyncio
    async def test_xseg_node_execution(self):
        """Test XSeg node execution"""
        node_data = WorkflowNode(
            id="xseg_1",
            type="xseg_editor",
            parameters={
                "dfl_path": "/path/to/dfl",
                "input_dir": "/path/to/faces"
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        node = XSegNode(node_data)
        
        # Mock the XSegEditor execution
        with patch('subprocess.Popen') as mock_popen:
            mock_process = Mock()
            mock_process.wait.return_value = 0
            mock_process.stdout.read.return_value = b"XSeg editing completed"
            mock_process.stderr.read.return_value = b""
            mock_popen.return_value = mock_process
            
            context = {
                "input_dir": "/path/to/faces",
                "dfl_path": "/path/to/dfl"
            }
            
            result = await node.execute(context)
            
            assert result["success"] == True
            assert "output_dir" in result


if __name__ == "__main__":
    pytest.main([__file__])
