"""
DFL I/O Wrapper
Provides a clean API for reading and writing DeepFaceLab image metadata
"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import numpy as np

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from DFLJPG import DFLJPG
    from DFLPNG import DFLPNG
    from SegIEPolys import SegIEPolys
    from IEPolys import IEPolys
    from FaceType import FaceType
    DFL_AVAILABLE = True
except ImportError as e:
    print(f"Warning: DFL modules not available: {e}")
    DFL_AVAILABLE = False


class FaceDataNotFoundError(Exception):
    """Raised when no DFL face data is found in an image"""
    pass


def load_face_data(image_path: str) -> Optional[Dict[str, Any]]:
    """
    Load DFL face data from an image file

    Args:
        image_path: Path to the image file (JPG or PNG)

    Returns:
        Dictionary containing face data or None if not found

    Raises:
        FaceDataNotFoundError: If no DFL data found in image
        ValueError: If file format is unsupported
    """
    if not DFL_AVAILABLE:
        raise RuntimeError("DFL modules are not available")

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    ext = Path(image_path).suffix.lower()

    try:
        if ext in ['.jpg', '.jpeg']:
            dfl_data = DFLJPG.load(image_path)
        elif ext == '.png':
            dfl_data = DFLPNG.load(image_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        if dfl_data is None:
            raise FaceDataNotFoundError(f"No DFL data found in {image_path}")

        # Extract data into dictionary format
        result = {
            'landmarks': None,
            'segmentation_polygons': None,
            'face_type': None,
            'source_filename': None,
            'source_rect': None,
            'source_landmarks': None
        }

        # Get landmarks
        landmarks = dfl_data.get_landmarks()
        if landmarks is not None:
            if isinstance(landmarks, np.ndarray):
                result['landmarks'] = landmarks.tolist()
            else:
                result['landmarks'] = landmarks

        # Get segmentation polygons
        seg_ie_polys = dfl_data.get_seg_ie_polys()
        if seg_ie_polys is not None and seg_ie_polys.has_polys():
            polys = []
            for poly in seg_ie_polys.get_polys():
                pts = poly.get_pts()
                if isinstance(pts, np.ndarray):
                    polys.append(pts.tolist())
                else:
                    polys.append(pts)
            result['segmentation_polygons'] = polys

        # Get face type
        face_type = dfl_data.get_face_type()
        if face_type is not None:
            result['face_type'] = str(face_type)

        # Get source filename
        source_filename = dfl_data.get_source_filename()
        if source_filename is not None:
            result['source_filename'] = source_filename

        # Get source rect
        source_rect = dfl_data.get_source_rect()
        if source_rect is not None:
            if isinstance(source_rect, np.ndarray):
                result['source_rect'] = source_rect.tolist()
            else:
                result['source_rect'] = source_rect

        # Get source landmarks
        source_landmarks = dfl_data.get_source_landmarks()
        if source_landmarks is not None:
            if isinstance(source_landmarks, np.ndarray):
                result['source_landmarks'] = source_landmarks.tolist()
            else:
                result['source_landmarks'] = source_landmarks

        return result

    except Exception as e:
        print(f"Error loading face data from {image_path}: {str(e)}")
        raise


def save_face_data(image_path: str, face_data: Dict[str, Any]) -> bool:
    """
    Save DFL face data to an image file

    Args:
        image_path: Path to the image file
        face_data: Dictionary containing face data to save

    Returns:
        True if successful, False otherwise
    """
    if not DFL_AVAILABLE:
        raise RuntimeError("DFL modules are not available")

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    ext = Path(image_path).suffix.lower()

    try:
        # Load existing DFL data
        if ext in ['.jpg', '.jpeg']:
            dfl_data = DFLJPG.load(image_path)
        elif ext == '.png':
            dfl_data = DFLPNG.load(image_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        if dfl_data is None:
            raise FaceDataNotFoundError(f"No existing DFL data in {image_path}")

        # Update face data
        if 'landmarks' in face_data and face_data['landmarks'] is not None:
            landmarks = np.array(face_data['landmarks'])
            dfl_data.set_landmarks(landmarks)

        if 'segmentation_polygons' in face_data and face_data['segmentation_polygons'] is not None:
            # Create SegIEPolys object
            seg_ie_polys = SegIEPolys()
            for poly_pts in face_data['segmentation_polygons']:
                poly = IEPolys()
                poly.set_pts(np.array(poly_pts))
                seg_ie_polys.add_poly(poly)
            dfl_data.set_seg_ie_polys(seg_ie_polys)

        if 'face_type' in face_data and face_data['face_type'] is not None:
            # Convert string to FaceType enum
            face_type = FaceType[face_data['face_type']] if isinstance(face_data['face_type'], str) else face_data['face_type']
            dfl_data.set_face_type(face_type)

        # Save back to file
        if ext in ['.jpg', '.jpeg']:
            DFLJPG.save(image_path, dfl_data)
        elif ext == '.png':
            DFLPNG.save(image_path, dfl_data)

        return True

    except Exception as e:
        print(f"Error saving face data to {image_path}: {str(e)}")
        return False


def get_face_landmarks(image_path: str) -> Optional[List[List[float]]]:
    """
    Get facial landmarks from a DFL image

    Args:
        image_path: Path to the image file

    Returns:
        List of [x, y] landmark coordinates or None if not found
    """
    try:
        face_data = load_face_data(image_path)
        return face_data.get('landmarks')
    except (FaceDataNotFoundError, FileNotFoundError):
        return None


def get_segmentation_polygons(image_path: str) -> Optional[List[List[List[float]]]]:
    """
    Get segmentation polygons from a DFL image

    Args:
        image_path: Path to the image file

    Returns:
        List of polygons, where each polygon is a list of [x, y] points
    """
    try:
        face_data = load_face_data(image_path)
        return face_data.get('segmentation_polygons')
    except (FaceDataNotFoundError, FileNotFoundError):
        return None


def set_segmentation_polygons(image_path: str, polygons: List[List[List[float]]]) -> bool:
    """
    Set segmentation polygons for a DFL image

    Args:
        image_path: Path to the image file
        polygons: List of polygons to set

    Returns:
        True if successful, False otherwise
    """
    try:
        face_data = {'segmentation_polygons': polygons}
        return save_face_data(image_path, face_data)
    except Exception:
        return False


def embed_mask_polygons(image_paths: List[str], eyebrow_expand_mod: int = 1) -> Tuple[int, int]:
    """
    Embed mask polygons into multiple DFL images

    Args:
        image_paths: List of image file paths
        eyebrow_expand_mod: Eyebrow expansion modifier (1-4)

    Returns:
        Tuple of (success_count, failure_count)
    """
    if not DFL_AVAILABLE:
        raise RuntimeError("DFL modules are not available")

    success_count = 0
    failure_count = 0

    for image_path in image_paths:
        try:
            # Load face data
            face_data = load_face_data(image_path)

            if face_data.get('segmentation_polygons'):
                # Apply eyebrow expansion if needed
                if eyebrow_expand_mod > 1:
                    # TODO: Implement eyebrow expansion logic
                    pass

                # Save back to image
                if save_face_data(image_path, face_data):
                    success_count += 1
                else:
                    failure_count += 1
            else:
                failure_count += 1

        except Exception as e:
            print(f"Error embedding mask for {image_path}: {str(e)}")
            failure_count += 1

    return (success_count, failure_count)


def expand_eyebrow_region(polygon: List[List[float]], expand_mod: int, image_width: int, image_height: int) -> List[List[float]]:
    """
    Expand the eyebrow region of a segmentation polygon

    Args:
        polygon: List of [x, y] points defining the polygon
        expand_mod: Expansion modifier (1-4)
        image_width: Width of the image
        image_height: Height of the image

    Returns:
        Expanded polygon points
    """
    if expand_mod <= 1:
        return polygon

    expanded_polygon = []
    eyebrow_threshold = image_height * 0.3  # Top 30% is eyebrow region

    for point in polygon:
        x, y = point
        if y < eyebrow_threshold:
            # Expand upward for eyebrow region
            new_y = y - (expand_mod * image_height * 0.02)
            expanded_polygon.append([x, max(0, new_y)])
        else:
            expanded_polygon.append(point)

    return expanded_polygon
