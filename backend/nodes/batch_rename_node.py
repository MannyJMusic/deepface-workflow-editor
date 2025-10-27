import asyncio
from typing import Dict, Any, List
from pathlib import Path
import shutil
import re

from nodes.base_node import BaseNode
from schemas.schemas import WorkflowNode, NodeStatus
from api.websocket import websocket_manager


class BatchRenameNode(BaseNode):
    """Batch rename node for renaming files with consistent naming patterns"""
    
    def __init__(self, node: WorkflowNode):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["input_dir", "pattern"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute batch renaming"""
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting batch rename...")
            
            # Get parameters
            input_dir = self.get_parameter("input_dir")
            pattern = self.get_parameter("pattern", "file_{index:04d}")
            start_index = self.get_parameter("start_index", 1)
            file_extensions = self.get_parameter("file_extensions", "jpg,jpeg,png,bmp")
            
            input_path = Path(input_dir)
            
            if not input_path.exists():
                return {"success": False, "error": f"Input directory does not exist: {input_path}"}
            
            await self.update_progress(10, "Scanning for files...")
            
            # Parse file extensions
            extensions = [ext.strip().lower() for ext in file_extensions.split(',')]
            extensions += [ext.upper() for ext in extensions]  # Add uppercase versions
            
            # Find all files with specified extensions
            files_to_rename = []
            for ext in extensions:
                files_to_rename.extend(input_path.glob(f"*.{ext}"))
            
            if not files_to_rename:
                return {"success": False, "error": f"No files found with extensions: {file_extensions}"}
            
            await self.log_message("info", f"Found {len(files_to_rename)} files to rename")
            await self.update_progress(20, f"Renaming {len(files_to_rename)} files...")
            
            # Sort files for consistent ordering
            files_to_rename.sort()
            
            # Rename files
            renamed_count = 0
            failed_count = 0
            
            for i, file_path in enumerate(files_to_rename):
                try:
                    # Generate new filename
                    new_name = pattern.format(index=start_index + i)
                    
                    # Ensure the pattern includes file extension
                    if not any(new_name.endswith(f".{ext}") for ext in extensions):
                        # Add original extension
                        new_name += file_path.suffix
                    
                    new_path = input_path / new_name
                    
                    # Check if target file already exists
                    if new_path.exists() and new_path != file_path:
                        await self.log_message("warning", f"Target file already exists: {new_name}")
                        failed_count += 1
                        continue
                    
                    # Rename file
                    file_path.rename(new_path)
                    renamed_count += 1
                    
                    await self.log_message("info", f"Renamed {file_path.name} -> {new_name}")
                    
                    # Update progress
                    progress = 20 + (i + 1) / len(files_to_rename) * 70
                    await self.update_progress(progress, f"Renamed {i + 1}/{len(files_to_rename)} files")
                    
                except Exception as e:
                    await self.log_message("error", f"Failed to rename {file_path.name}: {str(e)}")
                    failed_count += 1
                    continue
            
            await self.update_progress(100, "Batch rename completed")
            await self.log_message("info", f"Renaming complete: {renamed_count} renamed, {failed_count} failed")
            
            return {
                "success": True,
                "files_renamed": renamed_count,
                "files_failed": failed_count,
                "total_files": len(files_to_rename),
                "pattern_used": pattern,
                "start_index": start_index,
                "message": f"Renamed {renamed_count} files using pattern: {pattern}"
            }
            
        except Exception as e:
            error_msg = f"Batch rename failed: {str(e)}"
            await self.update_status(NodeStatus.ERROR, error_msg)
            await self.log_message("error", error_msg)
            return {"success": False, "error": error_msg}



