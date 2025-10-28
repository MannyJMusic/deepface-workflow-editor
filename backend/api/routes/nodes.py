from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json

from schemas.schemas import NodeDefinition, NodeType, PortType, NodePort

router = APIRouter()

# Constants for file filters
VIDEO_FILES_FILTER = {"name": "Video Files", "extensions": ["mp4", "avi", "mov", "mkv", "webm"]}
ALL_FILES_FILTER = {"name": "All Files", "extensions": ["*"]}
IMAGE_FILES_FILTER = {"name": "Image Files", "extensions": ["jpg", "jpeg", "png", "bmp", "tiff"]}

# Node definitions for different node types
NODE_DEFINITIONS: Dict[str, NodeDefinition] = {
    "video_input": NodeDefinition(
        id="video_input",
        type=NodeType.VIDEO_INPUT,
        name="Video Input",
        description="Extract frames from video file using DeepFaceLab's VideoEd.py",
        inputs=[],
        outputs=[
            NodePort(id="video_frames", type=PortType.IMAGES, label="Video Frames", required=True)
        ],
        parameters={
            "input_file": {
                "type": "file-path", 
                "description": "Path to input video file", 
                "format": "file-path",
                "filters": [VIDEO_FILES_FILTER, ALL_FILES_FILTER],
                "required": True
            },
            "output_dir": {
                "type": "directory-path", 
                "description": "Directory to save extracted frames", 
                "format": "directory-path",
                "required": True
            },
            "fps": {
                "type": "number", 
                "description": "Frames per second to extract (0 = full fps)", 
                "default": 0, 
                "minimum": 0,
                "maximum": 120
            },
            "output_ext": {
                "type": "select", 
                "description": "Image format for extracted frames", 
                "options": ["png", "jpg"], 
                "default": "png"
            }
        },
        category="Input"
    ),
    
    "extract_faces": NodeDefinition(
        id="extract_faces",
        type=NodeType.EXTRACT_FACES,
        name="Extract Faces",
        description="Extract faces from video or images using S3FD or manual detection",
        inputs=[
            NodePort(id="video", type=PortType.VIDEO, label="Video", required=True),
            NodePort(id="images", type=PortType.IMAGES, label="Images", required=False)
        ],
        outputs=[
            NodePort(id="faces", type=PortType.FACES, label="Extracted Faces", required=True)
        ],
        parameters={
            "detector": {
                "type": "select", 
                "options": ["s3fd", "manual"], 
                "default": "s3fd",
                "description": "Face detection method"
            },
            "face_type": {
                "type": "select", 
                "options": ["half_face", "full_face", "whole_face", "head"], 
                "default": "full_face",
                "description": "Type of face region to extract"
            },
            "image_size": {
                "type": "number", 
                "default": 512, 
                "min": 64, 
                "max": 1024,
                "description": "Size of extracted face images"
            },
            "jpeg_quality": {
                "type": "number", 
                "default": 90, 
                "min": 1, 
                "max": 100,
                "description": "JPEG compression quality"
            },
            "max_faces_from_image": {
                "type": "number", 
                "default": 1, 
                "min": 1, 
                "max": 10,
                "description": "Maximum faces to extract per image"
            },
            "output_debug": {
                "type": "boolean", 
                "default": False,
                "description": "Save debug images with face detection overlays"
            },
            "gpu_idx": {
                "type": "gpu", 
                "description": "GPU device to use for face extraction", 
                "default": 0
            }
        },
        category="Processing"
    ),
    
    "train_model": NodeDefinition(
        id="train_model",
        type=NodeType.TRAIN_MODEL,
        name="Train Model",
        description="Train a face swap model using SAEHD, Quick96, or AMP",
        inputs=[
            NodePort(id="src_faces", type=PortType.FACES, label="Source Faces", required=True),
            NodePort(id="dst_faces", type=PortType.FACES, label="Destination Faces", required=True)
        ],
        outputs=[
            NodePort(id="model", type=PortType.MODEL, label="Trained Model", required=True)
        ],
        parameters={
            "model_type": {
                "type": "select", 
                "options": ["SAEHD", "Quick96", "AMP"], 
                "default": "SAEHD",
                "description": "Model architecture to use for training"
            },
            "batch_size": {
                "type": "number", 
                "default": 4, 
                "min": 1, 
                "max": 32,
                "description": "Training batch size"
            },
            "resolution": {
                "type": "number", 
                "default": 256, 
                "min": 64, 
                "max": 1024,
                "description": "Model resolution"
            },
            "target_iter": {
                "type": "number", 
                "default": 100000, 
                "min": 1000,
                "description": "Target number of training iterations"
            },
            "save_interval": {
                "type": "number", 
                "default": 25, 
                "min": 1,
                "description": "Save model every N iterations"
            },
            "preview": {
                "type": "boolean", 
                "default": True,
                "description": "Show training preview"
            },
            "gpu_idx": {
                "type": "gpu", 
                "description": "GPU device to use for training", 
                "default": 0
            },
            "pretrained_model": {
                "type": "file-path", 
                "description": "Path to pretrained model (optional)",
                "format": "file-path",
                "filters": [{"name": "Model Files", "extensions": ["pth", "pt", "h5"]}, {"name": "All Files", "extensions": ["*"]}],
                "required": False
            }
        },
        category="Processing"
    ),
    
    "merge_faces": NodeDefinition(
        id="merge_faces",
        type=NodeType.MERGE_FACES,
        name="Merge Faces",
        description="Merge trained model with destination video/images",
        inputs=[
            NodePort(id="model", type=PortType.MODEL, label="Trained Model", required=True),
            NodePort(id="dst_video", type=PortType.VIDEO, label="Destination Video", required=True),
            NodePort(id="dst_faces", type=PortType.FACES, label="Destination Faces", required=True),
            NodePort(id="mask", type=PortType.MASK, label="XSeg Mask", required=False)
        ],
        outputs=[
            NodePort(id="merged_video", type=PortType.VIDEO, label="Merged Video", required=True),
            NodePort(id="merged_images", type=PortType.IMAGES, label="Merged Images", required=False)
        ],
        parameters={
            "face_enhancer": {
                "type": "select", 
                "options": ["none", "GFPGAN", "CodeFormer"], 
                "default": "none",
                "description": "Face enhancement method"
            },
            "color_transfer": {
                "type": "select", 
                "options": ["none", "rct", "lct", "mkl", "idt"], 
                "default": "none",
                "description": "Color transfer method"
            },
            "erode_mask": {
                "type": "number", 
                "default": 0, 
                "min": 0, 
                "max": 50,
                "description": "Erode mask by N pixels"
            },
            "blur_mask": {
                "type": "number", 
                "default": 0, 
                "min": 0, 
                "max": 50,
                "description": "Blur mask by N pixels"
            },
            "output_format": {
                "type": "select", 
                "options": ["png", "jpg"], 
                "default": "png",
                "description": "Output image format"
            },
            "gpu_idx": {
                "type": "gpu", 
                "description": "GPU device to use for merging", 
                "default": 0
            }
        },
        category="Processing"
    ),
    
    "video_output": NodeDefinition(
        id="video_output",
        type=NodeType.VIDEO_OUTPUT,
        name="Video Output",
        description="Create video from image sequence using DeepFaceLab's VideoEd.py",
        inputs=[
            NodePort(id="image_sequence", type=PortType.IMAGES, label="Image Sequence", required=True)
        ],
        outputs=[
            NodePort(id="output_video", type=PortType.VIDEO, label="Output Video", required=True)
        ],
        parameters={
            "input_dir": {
                "type": "directory-path", 
                "description": "Directory containing image sequence", 
                "format": "directory-path",
                "required": True
            },
            "output_file": {
                "type": "file-path", 
                "description": "Path for the output video file", 
                "format": "file-path",
                "filters": [VIDEO_FILES_FILTER, ALL_FILES_FILTER],
                "required": True
            },
            "reference_file": {
                "type": "file-path", 
                "description": "Reference video file for FPS and audio (optional)", 
                "format": "file-path",
                "filters": [VIDEO_FILES_FILTER, ALL_FILES_FILTER],
                "required": False
            },
            "ext": {
                "type": "select", 
                "description": "Format of input images", 
                "options": ["png", "jpg"], 
                "default": "png"
            },
            "fps": {
                "type": "number", 
                "description": "Output video FPS (overridden by reference file)", 
                "minimum": 1,
                "default": 30
            },
            "bitrate": {
                "type": "number", 
                "description": "Output video bitrate in Megabits", 
                "minimum": 1,
                "default": 10
            },
            "include_audio": {
                "type": "boolean", 
                "description": "Include audio from reference file", 
                "default": False
            },
            "lossless": {
                "type": "boolean", 
                "description": "Use lossless codec (PNG)", 
                "default": False
            }
        },
        category="Output"
    ),
    
    "advanced_face_editor": NodeDefinition(
        id="advanced_face_editor",
        type=NodeType.XSEG_EDITOR,  # Reusing the same type for now
        name="Advanced Face Editor",
        description="Advanced face editor with auto-detection, model loading, and segment selection",
        inputs=[
            NodePort(id="faces", type=PortType.FACES, label="Faces", required=True)
        ],
        outputs=[
            NodePort(id="edited_faces", type=PortType.FACES, label="Edited Faces", required=True)
        ],
        parameters={
            "input_dir": {
                "type": "directory-path", 
                "description": "Directory containing face images to edit", 
                "format": "directory-path",
                "required": True
            },
            "face_type": {
                "type": "select",
                "options": ["mouth", "half_face", "midfull_face", "full_face", "whole_face", "head"],
                "default": "full_face",
                "description": "Type of face detection to use"
            },
            "detection_model": {
                "type": "select",
                "options": ["VGGFace2", "OpenCV", "MTCNN"],
                "default": "VGGFace2",
                "description": "Face detection model to use"
            },
            "similarity_threshold": {
                "type": "number",
                "default": 0.6,
                "min": 0.0,
                "max": 1.0,
                "description": "Threshold for grouping similar faces"
            }
        },
        category="Editing"
    ),
    
    "image_resize": NodeDefinition(
        id="image_resize",
        type=NodeType.UTILITY,
        name="Image Resize",
        description="Resize images to specified dimensions",
        inputs=[
            NodePort(id="images", type=PortType.IMAGES, label="Images", required=True)
        ],
        outputs=[
            NodePort(id="resized_images", type=PortType.IMAGES, label="Resized Images", required=True)
        ],
        parameters={
            "input_dir": {
                "type": "directory-path", 
                "description": "Directory containing images to resize", 
                "format": "directory-path",
                "required": True
            },
            "output_dir": {
                "type": "directory-path", 
                "description": "Directory to save resized images", 
                "format": "directory-path",
                "required": True
            },
            "width": {
                "type": "number", 
                "description": "Target width in pixels", 
                "default": 512, 
                "minimum": 64,
                "maximum": 4096
            },
            "height": {
                "type": "number", 
                "description": "Target height in pixels", 
                "default": 512, 
                "minimum": 64,
                "maximum": 4096
            },
            "maintain_aspect": {
                "type": "boolean", 
                "description": "Maintain aspect ratio", 
                "default": True
            }
        },
        category="Processing"
    ),
    
    "face_filter": NodeDefinition(
        id="face_filter",
        type=NodeType.UTILITY,
        name="Face Filter",
        description="Filter faces based on quality, blur, or other criteria",
        inputs=[
            NodePort(id="faces", type=PortType.FACES, label="Faces", required=True)
        ],
        outputs=[
            NodePort(id="filtered_faces", type=PortType.FACES, label="Filtered Faces", required=True)
        ],
        parameters={
            "input_dir": {
                "type": "directory-path", 
                "description": "Directory containing face images", 
                "format": "directory-path",
                "required": True
            },
            "output_dir": {
                "type": "directory-path", 
                "description": "Directory to save filtered faces", 
                "format": "directory-path",
                "required": True
            },
            "min_quality": {
                "type": "number", 
                "description": "Minimum face quality score", 
                "default": 0.5, 
                "minimum": 0.0,
                "maximum": 1.0
            },
            "max_blur": {
                "type": "number", 
                "description": "Maximum blur threshold", 
                "default": 0.3, 
                "minimum": 0.0,
                "maximum": 1.0
            },
            "min_resolution": {
                "type": "number", 
                "description": "Minimum resolution (pixels)", 
                "default": 64, 
                "minimum": 32,
                "maximum": 1024
            }
        },
        category="Processing"
    ),
    
    "batch_rename": NodeDefinition(
        id="batch_rename",
        type=NodeType.UTILITY,
        name="Batch Rename",
        description="Rename files in a directory with a consistent naming pattern",
        inputs=[
            NodePort(id="files", type=PortType.FILES, label="Files", required=True)
        ],
        outputs=[
            NodePort(id="renamed_files", type=PortType.FILES, label="Renamed Files", required=True)
        ],
        parameters={
            "input_dir": {
                "type": "directory-path", 
                "description": "Directory containing files to rename", 
                "format": "directory-path",
                "required": True
            },
            "pattern": {
                "type": "string", 
                "description": "Naming pattern (e.g., 'face_{index:04d}.jpg')", 
                "default": "face_{index:04d}.jpg",
                "required": True
            },
            "start_index": {
                "type": "number", 
                "description": "Starting index number", 
                "default": 1, 
                "minimum": 0
            },
            "file_extensions": {
                "type": "string", 
                "description": "File extensions to process (comma-separated)", 
                "default": "jpg,jpeg,png,bmp"
            }
        },
        category="Processing"
    )
}

@router.get("/definitions", response_model=List[NodeDefinition])
async def get_node_definitions():
    """Get all available node definitions"""
    return list(NODE_DEFINITIONS.values())

@router.get("/definitions/{node_type}", response_model=NodeDefinition)
async def get_node_definition(node_type: str):
    """Get definition for a specific node type"""
    # Handle legacy xseg_editor type - redirect to advanced_face_editor
    if node_type == "xseg_editor":
        node_type = "advanced_face_editor"
    
    if node_type not in NODE_DEFINITIONS:
        raise HTTPException(status_code=404, detail="Node type not found")
    
    return NODE_DEFINITIONS[node_type]

@router.get("/categories")
async def get_node_categories():
    """Get all node categories"""
    categories = set()
    for definition in NODE_DEFINITIONS.values():
        categories.add(definition.category)
    
    return sorted(categories)

@router.get("/by-category/{category}", response_model=List[NodeDefinition])
async def get_nodes_by_category(category: str):
    """Get all nodes in a specific category"""
    nodes = [defn for defn in NODE_DEFINITIONS.values() if defn.category == category]
    return nodes

@router.post("/validate-connection")
async def validate_connection(source_node_type: str, target_node_type: str, source_port: str, target_port: str):
    """Validate if two nodes can be connected"""
    source_def = NODE_DEFINITIONS.get(source_node_type)
    target_def = NODE_DEFINITIONS.get(target_node_type)
    
    if not source_def or not target_def:
        return {"valid": False, "reason": "Node type not found"}
    
    # Find source output port
    source_output = next((port for port in source_def.outputs if port.id == source_port), None)
    if not source_output:
        return {"valid": False, "reason": "Source port not found"}
    
    # Find target input port
    target_input = next((port for port in target_def.inputs if port.id == target_port), None)
    if not target_input:
        return {"valid": False, "reason": "Target port not found"}
    
    # Check port type compatibility
    if source_output.type != target_input.type:
        return {"valid": False, "reason": f"Port type mismatch: {source_output.type} != {target_input.type}"}
    
    return {"valid": True, "reason": "Connection is valid"}

# Face Editor API Endpoints

@router.post("/{node_id}/detect-faces")
async def detect_faces(node_id: str, request: Dict[str, Any]):
    """Trigger face detection for advanced face editor node"""
    try:
        from core.workflow_engine import WorkflowEngine
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        from pathlib import Path
        
        # Create a mock workflow node for the face editor
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters=request,
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor node instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Detect faces
        face_data = await face_editor.detect_faces(
            Path(request["input_dir"]),
            face_editor._find_face_images(Path(request["input_dir"])),
            request.get("detection_model", "VGGFace2"),
            request.get("face_type", "full_face"),
            request.get("similarity_threshold", 0.6)
        )
        
        return {
            "success": True,
            "face_images": face_data,
            "message": f"Detected {len(face_data)} faces"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/load-segmentation-model")
async def load_segmentation_model(node_id: str):
    """Load BiSeNet segmentation model"""
    try:
        from core.workflow_engine import WorkflowEngine
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        # Create a mock workflow node for the face editor
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor node instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Load BiSeNet model
        result = await face_editor.load_bisenet_model()
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/generate-masks")
async def generate_masks(node_id: str, request: Dict[str, Any]):
    """Generate segmentation masks for face images"""
    try:
        from core.workflow_engine import WorkflowEngine
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        # Create a mock workflow node for the face editor
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters=request,
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor node instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Get face images from request
        face_images = request.get("face_images", [])
        eyebrow_expand_mod = request.get("eyebrow_expand_mod", 1)
        
        # Generate masks
        result = await face_editor.generate_segmentation_masks(face_images, eyebrow_expand_mod)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/embed-polygons")
async def embed_polygons(node_id: str, request: Dict[str, Any]):
    """Embed mask polygons into face images"""
    try:
        from core.workflow_engine import WorkflowEngine
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        # Create a mock workflow node for the face editor
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters=request,
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor node instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Get face images from request
        face_images = request.get("face_images", [])
        eyebrow_expand_mod = request.get("eyebrow_expand_mod", 1)
        
        # Embed polygons
        result = await face_editor.embed_mask_polygons(face_images, eyebrow_expand_mod)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/face-images-stream")
async def get_face_images_stream(node_id: str, input_dir: str):
    """Stream face images one by one as they're processed"""
    from fastapi.responses import StreamingResponse
    import json
    import asyncio
    from core.workflow_engine import WorkflowEngine
    from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
    from schemas.schemas import WorkflowNode, NodeStatus
    from pathlib import Path
    
    async def generate_face_images():
        try:
            # Create a mock workflow node for the face editor
            workflow_node = WorkflowNode(
                id=node_id,
                type="xseg_editor",
                position={"x": 0, "y": 0},
                parameters={"input_dir": input_dir},
                status=NodeStatus.IDLE,
                progress=0.0,
                message="",
                inputs={},
                outputs={}
            )
            
            # Create face editor node instance
            face_editor = AdvancedFaceEditorNode(workflow_node)
            
            # Find face images
            face_files = face_editor._find_face_images(Path(input_dir))
            
            # Send total count first
            yield f"data: {json.dumps({'type': 'count', 'total': len(face_files)})}\n\n"
            
            # Process and send each image individually
            for i, face_file in enumerate(face_files):
                face_data = {
                    "id": f"face_{i}",
                    "filename": face_file.name,
                    "filePath": str(face_file),
                    "thumbnailUrl": None,
                    "segmentationPolygon": None,
                    "landmarks": None,
                    "selected": False,
                    "active": False
                }
                
                # Send individual face data
                yield f"data: {json.dumps({'type': 'face', 'data': face_data})}\n\n"
                
                # Delay to allow frontend to process and render each image individually
                await asyncio.sleep(0.1)  # Increased from 0.01s to 0.1s for better UX
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_face_images(),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@router.get("/{node_id}/face-images")
async def get_face_images(node_id: str, input_dir: str):
    """Get list of detected face images"""
    try:
        from core.workflow_engine import WorkflowEngine
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        from pathlib import Path
        
        # Create a mock workflow node for the face editor
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor node instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Find face images
        face_files = face_editor._find_face_images(Path(input_dir))
        
        # Convert to face data format
        face_data = []
        for i, face_file in enumerate(face_files):
            face_data.append({
                "id": f"face_{i}",
                "filename": face_file.name,
                "filePath": str(face_file),
                "thumbnailUrl": None,
                "segmentationPolygon": None,
                "landmarks": None,
                "selected": False,
                "active": False
            })
        
        return {
            "success": True,
            "face_images": face_data,
            "count": len(face_data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/face-image/{filename}")
async def get_face_image(node_id: str, filename: str, input_dir: str):
    """Serve face image file"""
    try:
        from fastapi.responses import FileResponse
        from pathlib import Path
        
        print(f"🖼️ Serving face image: {filename} from {input_dir}")
        
        # Construct the full file path
        file_path = Path(input_dir) / filename
        
        # Check if file exists
        if not file_path.exists():
            print(f"❌ Image file not found: {file_path}")
            raise HTTPException(status_code=404, detail="Image file not found")
        
        print(f"✅ Image file found: {file_path}")
        
        # Return the image file with CORS headers
        from fastapi import Response
        response = FileResponse(
            path=str(file_path),
            media_type="image/jpeg",
            filename=filename
        )
        
        # Add CORS headers explicitly
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Detection Profile Management Endpoints

@router.post("/{node_id}/detection-profiles")
async def create_detection_profile(node_id: str, request: Dict[str, Any]):
    """Create a new detection profile"""
    try:
        profile_name = request.get("name", "default")
        profile_settings = request.get("settings", {})
        
        # Store profile (in a real implementation, this would save to a database or file)
        # For now, just return success
        return {
            "success": True,
            "profile_name": profile_name,
            "message": f"Detection profile '{profile_name}' created"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/detection-profiles")
async def list_detection_profiles(node_id: str):
    """List all detection profiles"""
    try:
        # Return list of profiles (would fetch from database in real implementation)
        return {
            "success": True,
            "profiles": ["default"],
            "count": 1
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{node_id}/detection-profiles/{profile_name}")
async def delete_detection_profile(node_id: str, profile_name: str):
    """Delete a detection profile"""
    try:
        # Delete profile (would remove from database in real implementation)
        return {
            "success": True,
            "profile_name": profile_name,
            "message": f"Detection profile '{profile_name}' deleted"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{node_id}/detection-profiles/{profile_name}/reset")
async def reset_detection_profile(node_id: str, profile_name: str):
    """Reset a detection profile to defaults"""
    try:
        # Reset profile to defaults (would update in database in real implementation)
        return {
            "success": True,
            "profile_name": profile_name,
            "message": f"Detection profile '{profile_name}' reset to defaults"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Face Data Operations Endpoints

@router.post("/{node_id}/update-parent-frames")
async def update_parent_frames(node_id: str, request: Dict[str, Any]):
    """Update faces to reference parent frames"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        from pathlib import Path
        
        input_dir = request.get("input_dir")
        parent_frame_folder = request.get("parent_frame_folder")
        
        if not input_dir or not parent_frame_folder:
            raise HTTPException(status_code=400, detail="Missing required parameters: input_dir and parent_frame_folder")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir, "parent_frame_folder": parent_frame_folder},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Update parent frames
        result = await face_editor.update_parent_to_self(input_dir, parent_frame_folder)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/import-face-data")
async def import_face_data(node_id: str, request: Dict[str, Any]):
    """Import face metadata from existing images"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        input_dir = request.get("input_dir")
        
        if not input_dir:
            raise HTTPException(status_code=400, detail="Missing required parameter: input_dir")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Import face data
        result = await face_editor.import_face_data(input_dir)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/face-data/{face_id}")
async def get_face_data(node_id: str, face_id: str, input_dir: str = None):
    """Get face data (landmarks, segmentation) for a specific face image"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        if not input_dir:
            raise HTTPException(status_code=400, detail="Missing required parameter: input_dir")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir},
            status=NodeStatus.IDLE,
            progress=0.0,
            message=""
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Get face data for the specific image
        face_data = await face_editor.get_face_data_for_image(face_id, input_dir)
        
        return face_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/face-data-batch")
async def get_face_data_batch(node_id: str, request: Dict[str, Any]):
    """Get face data (landmarks, segmentation) for multiple face images in batch"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        face_ids = request.get('face_ids', [])
        input_dir = request.get('input_dir')
        
        if not input_dir:
            raise HTTPException(status_code=400, detail="Missing required parameter: input_dir")
        
        if not face_ids:
            raise HTTPException(status_code=400, detail="Missing required parameter: face_ids")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir},
            status=NodeStatus.IDLE,
            progress=0.0,
            message=""
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Get face data for all images in batch
        batch_results = {}
        for face_id in face_ids:
            try:
                face_data = await face_editor.get_face_data_for_image(face_id, input_dir)
                batch_results[face_id] = face_data
            except Exception as e:
                batch_results[face_id] = {
                    "success": False,
                    "message": f"Error loading face data for {face_id}: {str(e)}",
                    "landmarks": None,
                    "segmentation": None,
                    "face_type": None,
                    "source_filename": None
                }
        
        return {
            "success": True,
            "message": f"Batch loaded face data for {len(face_ids)} images",
            "results": batch_results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/import-all-face-data")
async def import_all_face_data(node_id: str, request: Dict[str, Any]):
    """Import face data for all images in the input directory upfront"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        input_dir = request.get('input_dir')
        
        if not input_dir:
            raise HTTPException(status_code=400, detail="Missing required parameter: input_dir")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir},
            status=NodeStatus.IDLE,
            progress=0.0,
            message=""
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Import all face data upfront
        result = await face_editor.import_all_face_data(input_dir)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/progress")
async def get_node_progress(node_id: str):
    """Get current progress of a node operation"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={},
            status=NodeStatus.IDLE,
            progress=0.0,
            message=""
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Get current progress
        progress = face_editor.get_progress()
        message = face_editor.get_message()
        
        return {
            "success": True,
            "progress": progress,
            "message": message
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/copy-embedded-data")
async def copy_embedded_data(node_id: str, request: Dict[str, Any]):
    """Copy face metadata between folders"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        input_dir = request.get("input_dir")
        faces_folder = request.get("faces_folder")
        only_parent_data = request.get("only_parent_data", False)
        recalculate = request.get("recalculate", False)
        
        if not input_dir or not faces_folder:
            raise HTTPException(status_code=400, detail="Missing required parameters: input_dir and faces_folder")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={
                "input_dir": input_dir,
                "faces_folder": faces_folder,
                "only_parent_data": only_parent_data,
                "recalculate": recalculate
            },
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Copy embedded data
        result = await face_editor.copy_embedded_data(input_dir, faces_folder, only_parent_data, recalculate)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# XSeg Model Operations Endpoints

@router.post("/{node_id}/xseg/train")
async def train_xseg_model(node_id: str, request: Dict[str, Any]):
    """Train XSeg segmentation model"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        input_dir = request.get("input_dir")
        xseg_model_path = request.get("xseg_model_path")
        
        if not input_dir or not xseg_model_path:
            raise HTTPException(status_code=400, detail="Missing required parameters: input_dir and xseg_model_path")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir, "xseg_model_path": xseg_model_path},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Train XSeg model
        result = await face_editor.train_xseg(input_dir, xseg_model_path)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{node_id}/xseg/apply")
async def apply_xseg_model(node_id: str, request: Dict[str, Any]):
    """Apply XSeg model to generate masks"""
    try:
        from nodes.advanced_face_editor_node import AdvancedFaceEditorNode
        from schemas.schemas import WorkflowNode, NodeStatus
        
        input_dir = request.get("input_dir")
        xseg_model_path = request.get("xseg_model_path")
        
        if not input_dir or not xseg_model_path:
            raise HTTPException(status_code=400, detail="Missing required parameters: input_dir and xseg_model_path")
        
        # Create workflow node
        workflow_node = WorkflowNode(
            id=node_id,
            type="xseg_editor",
            position={"x": 0, "y": 0},
            parameters={"input_dir": input_dir, "xseg_model_path": xseg_model_path},
            status=NodeStatus.IDLE,
            progress=0.0,
            message="",
            inputs={},
            outputs={}
        )
        
        # Create face editor instance
        face_editor = AdvancedFaceEditorNode(workflow_node)
        
        # Apply XSeg model
        result = await face_editor.apply_xseg(input_dir, xseg_model_path)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{node_id}/xseg/status")
async def get_xseg_training_status(node_id: str):
    """Get XSeg training status"""
    try:
        # Return training status (would fetch from training process in real implementation)
        return {
            "success": True,
            "status": "idle",  # idle, training, completed, error
            "progress": 0.0,
            "epoch": 0,
            "loss": None,
            "message": "No training in progress"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
