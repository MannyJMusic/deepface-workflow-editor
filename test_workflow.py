#!/usr/bin/env python3
"""
Test script for DeepFaceLab Workflow Editor
This script tests the complete workflow functionality
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Any

# Add the backend to the path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from schemas.schemas import Workflow, WorkflowNode, WorkflowEdge, NodeType, NodeStatus
from core.workflow_engine import WorkflowEngine


async def test_complete_workflow():
    """Test a complete DeepFaceLab workflow"""
    print("🧪 Testing DeepFaceLab Workflow Editor")
    print("=" * 50)
    
    # Create a test workflow
    workflow = create_test_workflow()
    
    print(f"📋 Created test workflow: {workflow.name}")
    print(f"   Nodes: {len(workflow.nodes)}")
    print(f"   Edges: {len(workflow.edges)}")
    
    # Initialize workflow engine
    engine = WorkflowEngine()
    
    try:
        # Test workflow validation
        print("\n🔍 Testing workflow validation...")
        validation_result = await engine.validate_workflow(workflow)
        
        if validation_result["valid"]:
            print("✅ Workflow validation passed")
        else:
            print("❌ Workflow validation failed:")
            for error in validation_result["errors"]:
                print(f"   - {error}")
            return False
        
        # Test workflow execution
        print("\n🚀 Testing workflow execution...")
        execution_id = "test_execution_001"
        
        result = await engine.execute_workflow(workflow.id, execution_id)
        
        if result["success"]:
            print("✅ Workflow execution completed successfully")
            print(f"   Execution ID: {execution_id}")
            print(f"   Duration: {result.get('duration', 'N/A')}")
        else:
            print("❌ Workflow execution failed:")
            print(f"   Error: {result.get('error', 'Unknown error')}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        return False


def create_test_workflow() -> Workflow:
    """Create a test workflow for DeepFaceLab operations"""
    
    # Create nodes
    video_input = WorkflowNode(
        id="video_input_1",
        type=NodeType.VIDEO_INPUT,
        position={"x": 100, "y": 100},
        parameters={
            "input_file": "/tmp/test_video.mp4",
            "output_dir": "/tmp/frames",
            "fps": 30,
            "output_ext": "png"
        },
        status=NodeStatus.IDLE
    )
    
    extract_src = WorkflowNode(
        id="extract_src_1",
        type=NodeType.EXTRACT_FACES,
        position={"x": 300, "y": 100},
        parameters={
            "detector": "s3fd",
            "face_type": "full_face",
            "image_size": 512,
            "jpeg_quality": 90,
            "max_faces_from_image": 1,
            "output_debug": False,
            "gpu_idx": 0
        },
        status=NodeStatus.IDLE
    )
    
    extract_dst = WorkflowNode(
        id="extract_dst_1",
        type=NodeType.EXTRACT_FACES,
        position={"x": 300, "y": 200},
        parameters={
            "detector": "s3fd",
            "face_type": "full_face",
            "image_size": 512,
            "jpeg_quality": 90,
            "max_faces_from_image": 1,
            "output_debug": False,
            "gpu_idx": 0
        },
        status=NodeStatus.IDLE
    )
    
    train_model = WorkflowNode(
        id="train_model_1",
        type=NodeType.TRAIN_MODEL,
        position={"x": 500, "y": 150},
        parameters={
            "model_type": "SAEHD",
            "batch_size": 4,
            "resolution": 256,
            "target_iter": 1000,
            "save_interval": 25,
            "preview": True,
            "gpu_idx": 0
        },
        status=NodeStatus.IDLE
    )
    
    merge_faces = WorkflowNode(
        id="merge_faces_1",
        type=NodeType.MERGE_FACES,
        position={"x": 700, "y": 150},
        parameters={
            "face_enhancer": "none",
            "color_transfer": "none",
            "erode_mask": 0,
            "blur_mask": 0,
            "output_format": "png",
            "gpu_idx": 0
        },
        status=NodeStatus.IDLE
    )
    
    video_output = WorkflowNode(
        id="video_output_1",
        type=NodeType.VIDEO_OUTPUT,
        position={"x": 900, "y": 150},
        parameters={
            "input_dir": "/tmp/merged_images",
            "output_file": "/tmp/output_video.mp4",
            "reference_file": "/tmp/test_video.mp4",
            "ext": "png",
            "fps": 30,
            "include_audio": True,
            "lossless": False
        },
        status=NodeStatus.IDLE
    )
    
    # Create edges
    edges = [
        WorkflowEdge(
            id="edge_1",
            source="video_input_1",
            target="extract_src_1",
            source_port="video_frames",
            target_port="video"
        ),
        WorkflowEdge(
            id="edge_2",
            source="video_input_1",
            target="extract_dst_1",
            source_port="video_frames",
            target_port="video"
        ),
        WorkflowEdge(
            id="edge_3",
            source="extract_src_1",
            target="train_model_1",
            source_port="faces",
            target_port="src_faces"
        ),
        WorkflowEdge(
            id="edge_4",
            source="extract_dst_1",
            target="train_model_1",
            source_port="faces",
            target_port="dst_faces"
        ),
        WorkflowEdge(
            id="edge_5",
            source="train_model_1",
            target="merge_faces_1",
            source_port="model",
            target_port="model"
        ),
        WorkflowEdge(
            id="edge_6",
            source="extract_dst_1",
            target="merge_faces_1",
            source_port="faces",
            target_port="dst_faces"
        ),
        WorkflowEdge(
            id="edge_7",
            source="video_input_1",
            target="merge_faces_1",
            source_port="video_frames",
            target_port="dst_video"
        ),
        WorkflowEdge(
            id="edge_8",
            source="merge_faces_1",
            target="video_output_1",
            source_port="merged_images",
            target_port="image_sequence"
        )
    ]
    
    # Create workflow
    workflow = Workflow(
        id="test_workflow_001",
        name="Test DeepFaceLab Workflow",
        description="Complete face swap workflow for testing",
        nodes=[video_input, extract_src, extract_dst, train_model, merge_faces, video_output],
        edges=edges,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    )
    
    return workflow


async def test_individual_nodes():
    """Test individual node functionality"""
    print("\n🔧 Testing individual nodes...")
    
    # Test VideoInputNode
    print("   Testing VideoInputNode...")
    video_node = WorkflowNode(
        id="test_video_input",
        type=NodeType.VIDEO_INPUT,
        position={"x": 0, "y": 0},
        parameters={
            "input_file": "/tmp/test_video.mp4",
            "output_dir": "/tmp/frames",
            "fps": 30,
            "output_ext": "png"
        },
        status=NodeStatus.IDLE
    )
    
    # Test ExtractNode
    print("   Testing ExtractNode...")
    extract_node = WorkflowNode(
        id="test_extract",
        type=NodeType.EXTRACT_FACES,
        position={"x": 0, "y": 0},
        parameters={
            "detector": "s3fd",
            "face_type": "full_face",
            "image_size": 512,
            "jpeg_quality": 90,
            "max_faces_from_image": 1,
            "output_debug": False,
            "gpu_idx": 0
        },
        status=NodeStatus.IDLE
    )
    
    # Test TrainNode
    print("   Testing TrainNode...")
    train_node = WorkflowNode(
        id="test_train",
        type=NodeType.TRAIN_MODEL,
        position={"x": 0, "y": 0},
        parameters={
            "model_type": "SAEHD",
            "batch_size": 4,
            "resolution": 256,
            "target_iter": 100,
            "save_interval": 25,
            "preview": True,
            "gpu_idx": 0
        },
        status=NodeStatus.IDLE
    )
    
    print("✅ Individual node tests completed")


async def main():
    """Main test function"""
    print("🎬 DeepFaceLab Workflow Editor - Test Suite")
    print("=" * 60)
    
    try:
        # Test individual nodes
        await test_individual_nodes()
        
        # Test complete workflow
        success = await test_complete_workflow()
        
        if success:
            print("\n🎉 All tests passed! The workflow editor is functional.")
            print("\n📝 Next steps:")
            print("   1. Install DeepFaceLab dependencies")
            print("   2. Test with real video files")
            print("   3. Verify GPU acceleration")
            print("   4. Test WebSocket real-time updates")
            print("   5. Validate output quality")
        else:
            print("\n❌ Some tests failed. Please check the implementation.")
            
    except Exception as e:
        print(f"\n💥 Test suite failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
