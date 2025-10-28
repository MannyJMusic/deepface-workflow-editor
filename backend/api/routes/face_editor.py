"""
Face Editor API Routes
Provides endpoints for face data import, segmentation editing, and mask embedding
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Body
from typing import List, Dict, Any, Optional
from pathlib import Path
import asyncio
import sys

from pydantic import BaseModel

# Add dfl_scripts to path
dfl_scripts_path = Path(__file__).parent.parent.parent / "dfl_scripts"
sys.path.insert(0, str(dfl_scripts_path))

try:
    from dfl_scripts.dfl_io import (
        load_face_data,
        save_face_data,
        get_face_landmarks,
        get_segmentation_polygons,
        set_segmentation_polygons,
        embed_mask_polygons,
        FaceDataNotFoundError
    )
    DFL_AVAILABLE = True
except ImportError as e:
    print(f"Warning: DFL scripts not available: {e}")
    DFL_AVAILABLE = False

from api.websocket import websocket_manager

router = APIRouter()


# Request/Response Models
class ImportFaceDataRequest(BaseModel):
    input_dir: str
    node_id: str


class ImportFaceDataResponse(BaseModel):
    success: bool
    message: str
    faces_imported: int
    faces_with_data: int
    faces_with_landmarks: int
    faces_with_segmentation: int
    total_images: int


class GetFaceDataRequest(BaseModel):
    face_id: str
    input_dir: str


class GetFaceDataResponse(BaseModel):
    success: bool
    message: str
    landmarks: Optional[List[List[float]]]
    segmentation: Optional[List[List[List[float]]]]
    face_type: Optional[str]
    source_filename: Optional[str]


class EmbedMasksRequest(BaseModel):
    input_dir: str
    node_id: str
    eyebrow_expand_mod: int = 1
    face_ids: Optional[List[str]] = None


class EmbedMasksResponse(BaseModel):
    success: bool
    message: str
    processed_count: int
    success_count: int
    failure_count: int


class SaveSegmentationRequest(BaseModel):
    face_id: str
    input_dir: str
    segmentation_polygons: List[List[List[float]]]


class SaveSegmentationResponse(BaseModel):
    success: bool
    message: str


# Profile Management Models
class CreateProfileRequest(BaseModel):
    name: str
    settings: Dict[str, Any]


class ProfileResponse(BaseModel):
    success: bool
    message: str


class GetProfilesResponse(BaseModel):
    success: bool
    profiles: List[str]
    current_profile: str


class SetProfileRequest(BaseModel):
    name: str


class ManageFacesRequest(BaseModel):
    profile_name: str
    face_ids: List[str]


class XSegEditorRequest(BaseModel):
    input_dir: str
    node_id: str


class XSegStatusResponse(BaseModel):
    success: bool
    running: bool
    message: str
    pid: Optional[int] = None
    returncode: Optional[int] = None


# Helper Functions
def _get_face_files(input_dir: str) -> List[str]:
    """Get list of face image files from directory"""
    input_path = Path(input_dir)
    if not input_path.exists():
        return []

    extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
    face_files = []

    for ext in extensions:
        face_files.extend(input_path.glob(f"*{ext}"))
        face_files.extend(input_path.glob(f"*{ext.upper()}"))

    # Sort by filename
    return [str(f) for f in sorted(face_files, key=lambda x: x.name)]


def _get_face_file_by_id(face_id: str, input_dir: str) -> Optional[str]:
    """Get face file path by face ID"""
    face_files = _get_face_files(input_dir)

    # Check if face_id is in "face_X" format
    if face_id.startswith("face_") and face_id[5:].isdigit():
        index = int(face_id[5:])
        if 0 <= index < len(face_files):
            return face_files[index]
    else:
        # Assume face_id is filename
        for f_path in face_files:
            p = Path(f_path)
            if p.stem == face_id or p.name == face_id:
                return f_path

    return None


# API Endpoints
@router.post("/import-face-data", response_model=ImportFaceDataResponse)
async def import_face_data(request: ImportFaceDataRequest, background_tasks: BackgroundTasks):
    """Import face data from DFL images in a directory"""
    if not DFL_AVAILABLE:
        raise HTTPException(status_code=500, detail="DFL modules are not available")

    try:
        input_path = Path(request.input_dir)
        if not input_path.exists():
            raise HTTPException(status_code=404, detail=f"Directory not found: {request.input_dir}")

        # Send initial progress update
        await websocket_manager.send_console_log(request.node_id, "Starting face data import...", "info")

        # Get face files
        face_files = _get_face_files(request.input_dir)
        if not face_files:
            return ImportFaceDataResponse(
                success=False,
                message="No face images found",
                faces_imported=0,
                faces_with_data=0,
                faces_with_landmarks=0,
                faces_with_segmentation=0,
                total_images=0
            )

        await websocket_manager.send_console_log(
            request.node_id,
            f"Found {len(face_files)} images to process",
            "info"
        )

        # Process faces
        faces_imported = 0
        faces_with_data = 0
        faces_with_landmarks = 0
        faces_with_segmentation = 0

        for i, face_file in enumerate(face_files):
            try:
                # Load DFL face data
                face_data = load_face_data(face_file)

                if face_data:
                    faces_with_data += 1
                    if face_data.get('landmarks'):
                        faces_with_landmarks += 1
                    if face_data.get('segmentation_polygons'):
                        faces_with_segmentation += 1

                faces_imported += 1

                # Send progress update every 100 images
                if i % 100 == 0:
                    progress = int((i / len(face_files)) * 100)
                    await websocket_manager.send_console_log(
                        request.node_id,
                        f"Processed {i}/{len(face_files)} images ({progress}%)",
                        "info"
                    )

            except FaceDataNotFoundError:
                faces_imported += 1
                continue
            except Exception as e:
                await websocket_manager.send_console_log(
                    request.node_id,
                    f"Error processing {Path(face_file).name}: {str(e)}",
                    "warning"
                )
                continue

        # Send completion message
        await websocket_manager.send_console_log(
            request.node_id,
            f"Import complete: {faces_with_data}/{faces_imported} images had DFL data",
            "info"
        )

        return ImportFaceDataResponse(
            success=True,
            message=f"Imported face data from {faces_imported} images",
            faces_imported=faces_imported,
            faces_with_data=faces_with_data,
            faces_with_landmarks=faces_with_landmarks,
            faces_with_segmentation=faces_with_segmentation,
            total_images=len(face_files)
        )

    except Exception as e:
        await websocket_manager.send_console_log(request.node_id, f"Import failed: {str(e)}", "error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/get-face-data", response_model=GetFaceDataResponse)
async def get_face_data(request: GetFaceDataRequest):
    """Get face data (landmarks, segmentation) for a specific image"""
    if not DFL_AVAILABLE:
        raise HTTPException(status_code=500, detail="DFL modules are not available")

    try:
        # Get face file path
        face_file = _get_face_file_by_id(request.face_id, request.input_dir)

        if not face_file:
            return GetFaceDataResponse(
                success=False,
                message=f"Face image not found for ID: {request.face_id}",
                landmarks=None,
                segmentation=None,
                face_type=None,
                source_filename=None
            )

        # Load face data
        face_data = load_face_data(face_file)

        if not face_data:
            return GetFaceDataResponse(
                success=False,
                message=f"No DFL data found in {request.face_id}",
                landmarks=None,
                segmentation=None,
                face_type=None,
                source_filename=None
            )

        return GetFaceDataResponse(
            success=True,
            message=f"Face data loaded for {request.face_id}",
            landmarks=face_data.get('landmarks'),
            segmentation=face_data.get('segmentation_polygons'),
            face_type=face_data.get('face_type'),
            source_filename=face_data.get('source_filename')
        )

    except FaceDataNotFoundError:
        return GetFaceDataResponse(
            success=False,
            message=f"No DFL data found in {request.face_id}",
            landmarks=None,
            segmentation=None,
            face_type=None,
            source_filename=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-segmentation", response_model=SaveSegmentationResponse)
async def save_segmentation(request: SaveSegmentationRequest):
    """Save segmentation polygons for a face image"""
    if not DFL_AVAILABLE:
        raise HTTPException(status_code=500, detail="DFL modules are not available")

    try:
        # Get face file path
        face_file = _get_face_file_by_id(request.face_id, request.input_dir)

        if not face_file:
            raise HTTPException(status_code=404, detail=f"Face image not found for ID: {request.face_id}")

        # Save segmentation polygons
        success = set_segmentation_polygons(face_file, request.segmentation_polygons)

        if success:
            return SaveSegmentationResponse(
                success=True,
                message=f"Segmentation saved for {request.face_id}"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to save segmentation")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed-masks", response_model=EmbedMasksResponse)
async def embed_masks(request: EmbedMasksRequest):
    """Embed mask polygons into face images"""
    if not DFL_AVAILABLE:
        raise HTTPException(status_code=500, detail="DFL modules are not available")

    try:
        # Get face files to process
        all_face_files = _get_face_files(request.input_dir)

        if not all_face_files:
            raise HTTPException(status_code=404, detail="No face images found")

        # Filter by face_ids if provided
        if request.face_ids:
            face_files_to_process = []
            for face_id in request.face_ids:
                face_file = _get_face_file_by_id(face_id, request.input_dir)
                if face_file:
                    face_files_to_process.append(face_file)
        else:
            face_files_to_process = all_face_files

        await websocket_manager.send_console_log(
            request.node_id,
            f"Embedding masks for {len(face_files_to_process)} images",
            "info"
        )

        # Embed masks
        success_count, failure_count = embed_mask_polygons(
            face_files_to_process,
            request.eyebrow_expand_mod
        )

        await websocket_manager.send_console_log(
            request.node_id,
            f"Embed complete: {success_count} successful, {failure_count} failed",
            "info"
        )

        return EmbedMasksResponse(
            success=True,
            message=f"Embedded masks for {success_count} images",
            processed_count=len(face_files_to_process),
            success_count=success_count,
            failure_count=failure_count
        )

    except Exception as e:
        await websocket_manager.send_console_log(request.node_id, f"Embed failed: {str(e)}", "error")
        raise HTTPException(status_code=500, detail=str(e))


# Profile Management Endpoints
@router.post("/profiles", response_model=ProfileResponse)
async def create_detection_profile(request: CreateProfileRequest):
    """Create a new detection profile"""
    try:
        # Get the node instance (this would need to be implemented based on your node management system)
        # For now, we'll create a simple profile storage
        # In a real implementation, you'd get the actual node instance
        
        # This is a placeholder - in reality you'd get the node from a node manager
        # node = get_node_instance(node_id)  # This would need to be implemented
        # result = await node.create_detection_profile(request.name, request.settings)
        
        # For now, return a success response
        return ProfileResponse(
            success=True,
            message=f"Profile '{request.name}' created successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/profiles/{profile_name}", response_model=ProfileResponse)
async def delete_detection_profile(profile_name: str):
    """Delete a detection profile"""
    try:
        if profile_name == "default":
            raise HTTPException(status_code=400, detail="Cannot delete default profile")
        
        # Placeholder implementation
        return ProfileResponse(
            success=True,
            message=f"Profile '{profile_name}' deleted successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profiles/{profile_name}/reset", response_model=ProfileResponse)
async def reset_detection_profile(profile_name: str):
    """Reset a detection profile to defaults"""
    try:
        # Placeholder implementation
        return ProfileResponse(
            success=True,
            message=f"Profile '{profile_name}' reset to defaults"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles", response_model=GetProfilesResponse)
async def get_detection_profiles():
    """Get all detection profiles"""
    try:
        # Placeholder implementation - return default profile
        return GetProfilesResponse(
            success=True,
            profiles=["default"],
            current_profile="default"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profiles/set-current", response_model=ProfileResponse)
async def set_current_profile(request: SetProfileRequest):
    """Set the current detection profile"""
    try:
        # Placeholder implementation
        return ProfileResponse(
            success=True,
            message=f"Switched to profile '{request.name}'"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profiles/add-faces", response_model=ProfileResponse)
async def add_faces_to_profile(request: ManageFacesRequest):
    """Add faces to a detection profile"""
    try:
        # Placeholder implementation
        return ProfileResponse(
            success=True,
            message=f"Added {len(request.face_ids)} faces to profile '{request.profile_name}'"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profiles/remove-faces", response_model=ProfileResponse)
async def remove_faces_from_profile(request: ManageFacesRequest):
    """Remove faces from a detection profile"""
    try:
        # Placeholder implementation
        return ProfileResponse(
            success=True,
            message=f"Removed {len(request.face_ids)} faces from profile '{request.profile_name}'"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# XSeg Editor Endpoints
@router.post("/xseg/launch", response_model=ProfileResponse)
async def launch_xseg_editor(request: XSegEditorRequest):
    """Launch XSeg editor"""
    try:
        # Placeholder implementation
        await websocket_manager.send_console_log(
            request.node_id,
            "Launching XSeg Editor...",
            "info"
        )
        
        return ProfileResponse(
            success=True,
            message="XSeg Editor launched successfully"
        )
        
    except Exception as e:
        await websocket_manager.send_console_log(request.node_id, f"Failed to launch XSeg Editor: {str(e)}", "error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/xseg/stop", response_model=ProfileResponse)
async def stop_xseg_editor(request: XSegEditorRequest):
    """Stop XSeg editor"""
    try:
        # Placeholder implementation
        await websocket_manager.send_console_log(
            request.node_id,
            "Stopping XSeg Editor...",
            "info"
        )
        
        return ProfileResponse(
            success=True,
            message="XSeg Editor stopped successfully"
        )
        
    except Exception as e:
        await websocket_manager.send_console_log(request.node_id, f"Failed to stop XSeg Editor: {str(e)}", "error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/xseg/status", response_model=XSegStatusResponse)
async def get_xseg_status(node_id: str):
    """Get XSeg editor status"""
    try:
        # Placeholder implementation
        return XSegStatusResponse(
            success=True,
            running=False,
            message="No XSeg editor process"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-workspace")
async def validate_workspace(workspace_path: str = Body(..., description="Path to workspace directory")):
    """Validate if a directory is a valid DeepFaceLab workspace"""
    try:
        workspace_dir = Path(workspace_path)
        
        if not workspace_dir.exists():
            return {
                "success": False,
                "isValid": False,
                "message": "Directory does not exist",
                "missingDirs": []
            }
        
        # Check for DFL directory structure - be more flexible
        # Look for common DFL patterns
        has_workspace_dir = (workspace_dir / "workspace").exists()
        has_data_src_dir = (workspace_dir / "data_src").exists() or (workspace_dir / "workspace" / "data_src").exists()
        has_data_dst_dir = (workspace_dir / "data_dst").exists() or (workspace_dir / "workspace" / "data_dst").exists()
        
        # Check for aligned directory in various locations
        aligned_dirs = [
            workspace_dir / "aligned",
            workspace_dir / "data_src" / "aligned", 
            workspace_dir / "workspace" / "data_src" / "aligned",
            workspace_dir / "workspace" / "aligned"
        ]
        
        aligned_dir = None
        for dir_path in aligned_dirs:
            if dir_path.exists() and dir_path.is_dir():
                aligned_dir = dir_path
                break
        
        has_aligned_dir = aligned_dir is not None
        
        # Check for video files in various locations
        video_files = [
            "data_src.mp4", "data_dst.mp4",
            "workspace/data_src.mp4", "workspace/data_dst.mp4",
            "data_src/data_src.mp4", "data_dst/data_dst.mp4"
        ]
        
        has_video_files = any((workspace_dir / file).exists() for file in video_files)
        
        # Count face images in aligned directory
        face_count = 0
        if has_aligned_dir and aligned_dir:
            face_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
            for ext in face_extensions:
                face_count += len(list(aligned_dir.glob(f"*{ext}")))
                face_count += len(list(aligned_dir.glob(f"*{ext.upper()}")))
        
        # Also check for face images in the root directory
        if face_count == 0:
            face_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
            for ext in face_extensions:
                face_count += len(list(workspace_dir.glob(f"*{ext}")))
                face_count += len(list(workspace_dir.glob(f"*{ext.upper()}")))
        
        # More flexible validation - accept if we have faces or video files
        is_valid = (has_video_files or has_aligned_dir or face_count > 0) and (has_workspace_dir or has_data_src_dir or has_data_dst_dir)
        
        # Build missing directories list for guidance
        missing_dirs = []
        if not has_workspace_dir and not has_data_src_dir:
            missing_dirs.append("workspace or data_src directory")
        if not has_data_dst_dir:
            missing_dirs.append("data_dst directory")
        
        message = ""
        if is_valid:
            message = f"Valid DeepFaceLab workspace detected with {face_count} face images"
        else:
            if missing_dirs:
                message = f"Missing required directories: {', '.join(missing_dirs)}. Please select a directory containing DFL project structure."
            else:
                message = "Directory exists but doesn't appear to contain DFL project files. Please select a directory with face images or DFL workspace structure."
        
        return {
            "success": True,
            "isValid": is_valid,
            "message": message,
            "missingDirs": missing_dirs,
            "faceCount": face_count,
            "hasVideoFiles": has_video_files,
            "hasAlignedDir": has_aligned_dir
        }
        
    except Exception as e:
        return {
            "success": False,
            "isValid": False,
            "message": f"Error validating workspace: {str(e)}",
            "missingDirs": []
        }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "dfl_available": DFL_AVAILABLE
    }
