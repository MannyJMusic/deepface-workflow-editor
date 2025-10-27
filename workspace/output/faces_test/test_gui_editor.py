#!/usr/bin/env python3
"""
Test script for the Advanced Face Editor GUI
"""
import tkinter as tk
from tkinter import ttk, messagebox
import os
import sys
from pathlib import Path

class AdvancedFaceEditor:
    def __init__(self, root, input_path, face_files, face_type, detection_model, similarity_threshold):
        self.root = root
        self.input_path = Path(input_path)
        self.face_files = [Path(f) for f in face_files]
        self.face_type = face_type
        self.detection_model = detection_model
        self.similarity_threshold = similarity_threshold
        
        self.setup_ui()
        self.load_faces()
    
    def setup_ui(self):
        self.root.title("Advanced Face Editor - Test")
        self.root.geometry("1200x800")
        
        # Create main frame
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Control panel
        control_frame = ttk.LabelFrame(main_frame, text="Controls")
        control_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(control_frame, text="Auto Detect Faces", command=self.auto_detect_faces).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Load Model", command=self.load_model).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Group Faces", command=self.group_faces).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Save Changes", command=self.save_changes).pack(side=tk.LEFT, padx=5)
        
        # Face type selection
        type_frame = ttk.LabelFrame(main_frame, text="Face Type")
        type_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.face_type_var = tk.StringVar(value=self.face_type)
        face_types = ["mouth", "half_face", "midfull_face", "full_face", "whole_face", "head"]
        ttk.Combobox(type_frame, textvariable=self.face_type_var, values=face_types, state="readonly").pack(side=tk.LEFT, padx=5)
        
        # Detection model selection
        model_frame = ttk.LabelFrame(main_frame, text="Detection Model")
        model_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.model_var = tk.StringVar(value=self.detection_model)
        models = ["VGGFace2", "OpenCV", "MTCNN"]
        ttk.Combobox(model_frame, textvariable=self.model_var, values=models, state="readonly").pack(side=tk.LEFT, padx=5)
        
        # Similarity threshold
        threshold_frame = ttk.LabelFrame(main_frame, text="Similarity Threshold")
        threshold_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.threshold_var = tk.DoubleVar(value=self.similarity_threshold)
        ttk.Scale(threshold_frame, from_=0.0, to=1.0, variable=self.threshold_var, orient=tk.HORIZONTAL).pack(side=tk.LEFT, padx=5)
        ttk.Label(threshold_frame, textvariable=self.threshold_var).pack(side=tk.LEFT, padx=5)
        
        # Face display area
        display_frame = ttk.LabelFrame(main_frame, text="Face Images")
        display_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create canvas with scrollbar
        canvas = tk.Canvas(display_frame)
        scrollbar = ttk.Scrollbar(display_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        self.face_frame = scrollable_frame
        self.canvas = canvas
        
        # Status bar
        self.status_var = tk.StringVar(value=f"Loaded {len(self.face_files)} face images")
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.pack(fill=tk.X, pady=(10, 0))
    
    def load_faces(self):
        """Load and display face images"""
        for i, face_file in enumerate(self.face_files):
            if i >= 50:  # Limit display to first 50 faces
                break
                
            face_frame = ttk.Frame(self.face_frame)
            face_frame.pack(fill=tk.X, padx=5, pady=2)
            
            # Face image placeholder
            ttk.Label(face_frame, text=f"Face {i+1}: {face_file.name}").pack(side=tk.LEFT)
            
            # Selection checkbox
            var = tk.BooleanVar()
            ttk.Checkbutton(face_frame, variable=var).pack(side=tk.RIGHT)
            
            # Edit button
            ttk.Button(face_frame, text="Edit", command=lambda f=face_file: self.edit_face(f)).pack(side=tk.RIGHT, padx=5)
    
    def auto_detect_faces(self):
        """Auto detect faces in images"""
        messagebox.showinfo("Auto Detect", f"Auto detecting faces using {self.model_var.get()} model...")
        self.status_var.set("Auto detecting faces...")
    
    def load_model(self):
        """Load face detection model"""
        messagebox.showinfo("Load Model", f"Loading {self.model_var.get()} model...")
        self.status_var.set(f"Loading {self.model_var.get()} model...")
    
    def group_faces(self):
        """Group faces by similarity"""
        messagebox.showinfo("Group Faces", f"Grouping faces with threshold {self.threshold_var.get():.2f}...")
        self.status_var.set("Grouping faces by similarity...")
    
    def edit_face(self, face_file):
        """Edit individual face"""
        messagebox.showinfo("Edit Face", f"Editing face: {face_file.name}")
    
    def save_changes(self):
        """Save all changes"""
        messagebox.showinfo("Save Changes", "Saving all changes...")
        self.status_var.set("Changes saved successfully")

def main():
    # Test parameters
    input_path = "."
    face_files = ["test_face_001.jpg"]  # Use the test face we created
    face_type = "full_face"
    detection_model = "VGGFace2"
    similarity_threshold = 0.6
    
    root = tk.Tk()
    app = AdvancedFaceEditor(root, input_path, face_files, face_type, detection_model, similarity_threshold)
    root.mainloop()

if __name__ == "__main__":
    main()
