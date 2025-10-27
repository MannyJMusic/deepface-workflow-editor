import json
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

from schemas.schemas import NodePreset, NodeType

class PresetManager:
    def __init__(self, workspace_path: str = None):
        if workspace_path is None:
            # Default to current working directory + workspace
            workspace_path = Path.cwd() / "workspace"
        
        self.workspace_path = Path(workspace_path)
        self.presets_dir = self.workspace_path / "presets"
        self.presets_file = self.presets_dir / "presets.json"
        
        # Ensure presets directory exists
        self.presets_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize presets file if it doesn't exist
        if not self.presets_file.exists():
            self._save_presets_to_file([])
    
    def _load_presets_from_file(self) -> List[Dict[str, Any]]:
        """Load presets from JSON file"""
        try:
            with open(self.presets_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return []
    
    def _save_presets_to_file(self, presets: List[Dict[str, Any]]) -> None:
        """Save presets to JSON file"""
        try:
            with open(self.presets_file, 'w', encoding='utf-8') as f:
                json.dump(presets, f, indent=2, ensure_ascii=False)
        except Exception as e:
            raise Exception(f"Failed to save presets to file: {str(e)}")
    
    async def save_preset(self, preset: NodePreset) -> NodePreset:
        """Save a preset"""
        presets = self._load_presets_from_file()
        
        # Convert preset to dict
        preset_dict = preset.dict()
        
        # Check if preset already exists
        existing_index = None
        for i, existing_preset in enumerate(presets):
            if existing_preset.get('id') == preset.id:
                existing_index = i
                break
        
        if existing_index is not None:
            # Update existing preset
            presets[existing_index] = preset_dict
        else:
            # Add new preset
            presets.append(preset_dict)
        
        # Save to file
        self._save_presets_to_file(presets)
        
        return preset
    
    async def list_presets(self) -> List[NodePreset]:
        """List all presets"""
        presets_data = self._load_presets_from_file()
        presets = []
        
        for preset_data in presets_data:
            try:
                preset = NodePreset(**preset_data)
                presets.append(preset)
            except Exception as e:
                print(f"Warning: Skipping invalid preset {preset_data.get('id', 'unknown')}: {e}")
                continue
        
        return presets
    
    async def get_preset(self, preset_id: str) -> Optional[NodePreset]:
        """Get a specific preset by ID"""
        presets = await self.list_presets()
        
        for preset in presets:
            if preset.id == preset_id:
                return preset
        
        return None
    
    async def update_preset(self, preset_id: str, updates: Dict[str, Any]) -> Optional[NodePreset]:
        """Update a preset"""
        presets_data = self._load_presets_from_file()
        
        for i, preset_data in enumerate(presets_data):
            if preset_data.get('id') == preset_id:
                # Update the preset data
                preset_data.update(updates)
                
                # Save back to file
                self._save_presets_to_file(presets_data)
                
                # Return updated preset
                try:
                    return NodePreset(**preset_data)
                except Exception as e:
                    raise Exception(f"Invalid preset data after update: {e}")
        
        return None
    
    async def delete_preset(self, preset_id: str) -> bool:
        """Delete a preset"""
        presets_data = self._load_presets_from_file()
        
        for i, preset_data in enumerate(presets_data):
            if preset_data.get('id') == preset_id:
                # Remove the preset
                presets_data.pop(i)
                
                # Save back to file
                self._save_presets_to_file(presets_data)
                
                return True
        
        return False
    
    async def get_presets_by_type(self, node_type: str) -> List[NodePreset]:
        """Get presets filtered by node type"""
        all_presets = await self.list_presets()
        
        # Validate node type
        try:
            NodeType(node_type)
        except ValueError:
            raise ValueError(f"Invalid node type: {node_type}")
        
        # Filter presets by type
        filtered_presets = [preset for preset in all_presets if preset.nodeType == node_type]
        
        return filtered_presets
    
    async def search_presets(self, query: str) -> List[NodePreset]:
        """Search presets by name or description"""
        all_presets = await self.list_presets()
        query_lower = query.lower()
        
        matching_presets = []
        for preset in all_presets:
            if (query_lower in preset.name.lower() or 
                (preset.description and query_lower in preset.description.lower())):
                matching_presets.append(preset)
        
        return matching_presets
    
    async def get_preset_stats(self) -> Dict[str, Any]:
        """Get statistics about presets"""
        presets = await self.list_presets()
        
        stats = {
            "total_presets": len(presets),
            "presets_by_type": {},
            "recent_presets": [],
            "oldest_preset": None,
            "newest_preset": None
        }
        
        if not presets:
            return stats
        
        # Count by type
        for preset in presets:
            node_type = preset.nodeType
            stats["presets_by_type"][node_type] = stats["presets_by_type"].get(node_type, 0) + 1
        
        # Sort by creation date
        sorted_presets = sorted(presets, key=lambda p: p.created_at)
        
        # Recent presets (last 5)
        stats["recent_presets"] = sorted_presets[-5:]
        
        # Oldest and newest
        stats["oldest_preset"] = sorted_presets[0]
        stats["newest_preset"] = sorted_presets[-1]
        
        return stats
    
    def export_presets(self, file_path: str) -> None:
        """Export all presets to a file"""
        presets = self._load_presets_from_file()
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(presets, f, indent=2, ensure_ascii=False)
    
    def import_presets(self, file_path: str) -> int:
        """Import presets from a file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                imported_presets = json.load(f)
        except Exception as e:
            raise Exception(f"Failed to read import file: {e}")
        
        if not isinstance(imported_presets, list):
            raise Exception("Import file must contain a list of presets")
        
        # Load existing presets
        existing_presets = self._load_presets_from_file()
        existing_ids = {p.get('id') for p in existing_presets}
        
        # Add imported presets (skip duplicates)
        added_count = 0
        for preset_data in imported_presets:
            if preset_data.get('id') not in existing_ids:
                # Generate new ID to avoid conflicts
                preset_data['id'] = f"imported-{datetime.now().strftime('%Y%m%d%H%M%S')}-{added_count}"
                preset_data['created_at'] = datetime.now().isoformat()
                preset_data['updated_at'] = datetime.now().isoformat()
                
                existing_presets.append(preset_data)
                added_count += 1
        
        # Save updated presets
        self._save_presets_to_file(existing_presets)
        
        return added_count


