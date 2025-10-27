import asyncio
from typing import Dict, Any
from pathlib import Path
import sys

from nodes.base_node import BaseNode
from schemas.schemas import NodeStatus

class TrainNode(BaseNode):
    def __init__(self, node):
        super().__init__(node)
        
    def get_required_parameters(self) -> list:
        return ["model_type", "batch_size", "resolution"]
    
    async def execute(self, execution_context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            await self.update_status(NodeStatus.RUNNING, "Starting model training...")
            
            # Get parameters
            model_type = self.get_parameter("model_type", "SAEHD")
            batch_size = self.get_parameter("batch_size", 4)
            resolution = self.get_parameter("resolution", 256)
            target_iter = self.get_parameter("target_iter", 100000)
            save_interval = self.get_parameter("save_interval", 25)
            preview = self.get_parameter("preview", True)
            gpu_idx = self.get_parameter("gpu_idx", 0)
            pretrained_model = self.get_parameter("pretrained_model", None)
            
            # Get input paths
            src_faces_path = self.get_input_path("src_faces")
            dst_faces_path = self.get_input_path("dst_faces")
            
            if not src_faces_path or not dst_faces_path:
                return {"success": False, "error": "Source and destination face paths required"}
            
            # Create model output directory
            model_dir = self.create_output_directory(execution_context.get("workspace_path", "."), self.node.id)
            
            await self.log_message("info", f"Training {model_type} model")
            await self.log_message("info", f"Source faces: {src_faces_path}")
            await self.log_message("info", f"Destination faces: {dst_faces_path}")
            
            await self.update_progress(5, "Initializing training environment...")
            
            # Import DeepFaceLab modules
            try:
                deepfacelab_path = Path(__file__).parent.parent / "deepfacelab"
                sys.path.insert(0, str(deepfacelab_path))
                
                from mainscripts import Trainer
                from core.interact import interact as io
                
                await self.update_progress(10, "Loading training data...")
                
                # Run training
                result = await self._run_training(
                    model_type=model_type,
                    src_faces_path=Path(src_faces_path),
                    dst_faces_path=Path(dst_faces_path),
                    model_dir=model_dir,
                    batch_size=batch_size,
                    resolution=resolution,
                    target_iter=target_iter,
                    save_interval=save_interval,
                    preview=preview,
                    gpu_idx=gpu_idx,
                    pretrained_model=pretrained_model
                )
                
                if result["success"]:
                    # Set output path
                    self.set_output_path("model", str(model_dir))
                    
                    await self.update_progress(100, "Model training completed successfully")
                    await self.log_message("info", f"Model saved to {model_dir}")
                    
                    return {"success": True, "output_path": str(model_dir), "iterations": result.get("iterations", 0)}
                else:
                    return {"success": False, "error": result["error"]}
                    
            except ImportError as e:
                await self.log_message("error", f"Failed to import DeepFaceLab modules: {e}")
                return {"success": False, "error": f"DeepFaceLab not available: {e}"}
                
        except Exception as e:
            await self.log_message("error", f"Model training failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def _run_training(self, model_type: str, src_faces_path: Path, dst_faces_path: Path,
                          model_dir: Path, batch_size: int, resolution: int, target_iter: int,
                          save_interval: int, preview: bool, gpu_idx: int, pretrained_model: str = None) -> Dict[str, Any]:
        """Run the actual model training using DeepFaceLab"""
        try:
            await self.update_progress(15, "Preparing training data...")
            
            # Validate input directories
            if not src_faces_path.exists():
                return {"success": False, "error": f"Source faces directory not found: {src_faces_path}"}
            
            if not dst_faces_path.exists():
                return {"success": False, "error": f"Destination faces directory not found: {dst_faces_path}"}
            
            await self.update_progress(20, "Initializing model...")
            
            # Import DeepFaceLab modules
            from mainscripts import Trainer
            from core.interact import interact as io
            from core.leras import nn
            from models import ModelBase
            
            # Set GPU device
            nn.initialize_main_env()
            device_config = nn.DeviceConfig.GPUIndexes([gpu_idx])
            nn.initialize(device_config)
            
            await self.update_progress(25, f"Loading {model_type} model...")
            
            # Initialize model based on type
            model_class = self._get_model_class(model_type)
            if not model_class:
                return {"success": False, "error": f"Unsupported model type: {model_type}"}
            
            # Create model instance
            model = model_class(
                name=f"{model_type}_model",
                resolution=resolution,
                batch_size=batch_size,
                device_config=device_config
            )
            
            await self.update_progress(30, "Loading training data...")
            
            # Load training data
            src_data = self._load_training_data(src_faces_path)
            dst_data = self._load_training_data(dst_faces_path)
            
            if not src_data or not dst_data:
                return {"success": False, "error": "Failed to load training data"}
            
            await self.log_message("info", f"Loaded {len(src_data)} source faces and {len(dst_data)} destination faces")
            
            await self.update_progress(35, "Starting training...")
            
            # Load pretrained model if specified
            if pretrained_model and Path(pretrained_model).exists():
                await self.log_message("info", f"Loading pretrained model from {pretrained_model}")
                model.load_weights(str(pretrained_model))
            
            # Training loop
            current_iter = model.get_iter()
            start_iter = current_iter
            
            while current_iter < target_iter:
                try:
                    # Train one iteration
                    loss_src, loss_dst = model.train_one_iter(src_data, dst_data)
                    
                    current_iter += 1
                    
                    # Update progress
                    progress = 35 + ((current_iter - start_iter) / (target_iter - start_iter)) * 60
                    await self.update_progress(min(95, progress), f"Training iteration {current_iter}/{target_iter}")
                    
                    # Log progress periodically
                    if current_iter % (save_interval * 2) == 0:
                        await self.log_message("info", f"Iteration {current_iter}: Loss SRC={loss_src:.4f}, Loss DST={loss_dst:.4f}")
                    
                    # Save model at intervals
                    if current_iter % save_interval == 0:
                        await self.update_progress(progress, f"Saving model at iteration {current_iter}")
                        model.save_weights(str(model_dir))
                        await self.log_message("info", f"Model saved at iteration {current_iter}")
                    
                    # Generate preview if enabled
                    if preview and current_iter % (save_interval * 4) == 0:
                        preview_path = model_dir / f"preview_{current_iter:06d}.jpg"
                        await self._generate_preview(model, src_data, dst_data, preview_path)
                    
                except Exception as e:
                    await self.log_message("warning", f"Training iteration {current_iter} failed: {e}")
                    continue
            
            await self.update_progress(95, "Saving final model...")
            
            # Save final model
            model.save_weights(str(model_dir))
            
            await self.update_progress(100, "Training completed")
            await self.log_message("info", f"Training completed: {current_iter - start_iter} iterations")
            
            return {
                "success": True, 
                "iterations": current_iter - start_iter,
                "final_iteration": current_iter,
                "model_path": str(model_dir)
            }
            
        except Exception as e:
            await self.log_message("error", f"Training failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _get_model_class(self, model_type: str):
        """Get the model class for the specified type"""
        try:
            if model_type.upper() == "SAEHD":
                from models.Model_SAEHD import Model
                return Model
            elif model_type.upper() == "QUICK96":
                from models.Model_Quick96 import Model
                return Model
            elif model_type.upper() == "AMP":
                from models.Model_AMP import Model
                return Model
            else:
                return None
        except ImportError:
            return None
    
    def _load_training_data(self, faces_path: Path):
        """Load training data from faces directory"""
        try:
            import cv2
            import numpy as np
            
            face_files = list(faces_path.glob("*.jpg")) + list(faces_path.glob("*.png"))
            if not face_files:
                return None
            
            faces = []
            for face_file in face_files:
                try:
                    face = cv2.imread(str(face_file))
                    if face is not None:
                        faces.append(face)
                except Exception:
                    continue
            
            return faces if faces else None
            
        except Exception:
            return None
    
    async def _generate_preview(self, model, src_data, dst_data, preview_path: Path):
        """Generate training preview image"""
        try:
            import cv2
            import numpy as np
            
            # Generate preview using model
            preview = model.get_preview(src_data[:1], dst_data[:1])
            
            if preview is not None:
                cv2.imwrite(str(preview_path), preview)
                await self.log_message("info", f"Preview saved: {preview_path.name}")
            
        except Exception as e:
            await self.log_message("warning", f"Failed to generate preview: {e}")
