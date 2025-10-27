
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, simpledialog
import os
import sys
from pathlib import Path
import json
import threading

class MachineVideoEditorGUI:
    def __init__(self, root, input_path, face_files, face_type, detection_model, similarity_threshold):
        self.root = root
        self.input_path = Path(input_path)
        self.face_files = [Path(f) for f in face_files]
        self.face_type = face_type
        self.detection_model = detection_model
        self.similarity_threshold = similarity_threshold
        
        # State variables
        self.selected_faces = set()
        self.face_images = {}
        self.face_data = {}
        self.detection_profiles = {"default": []}
        self.current_profile = "default"
        self.frame_size = 25  # Percentage
        self.sort_mode = "filename"
        self.filter_range = (0, len(face_files))
        
        self.setup_ui()
        self.load_faces()
    
    def setup_ui(self):
        self.root.title("Machine Video Editor - Advanced Face Editor")
        self.root.geometry("1400x900")
        self.root.configure(bg='#2b2b2b')
        
        # Create main paned window
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Left Panel - File Explorer
        self.setup_left_panel(main_paned)
        
        # Center Panel - Face Grid
        self.setup_center_panel(main_paned)
        
        # Right Panel - Detection Management
        self.setup_right_panel(main_paned)
        
        # Configure paned window weights
        main_paned.add(self.left_frame, weight=1)
        main_paned.add(self.center_frame, weight=3)
        main_paned.add(self.right_frame, weight=1)
    
    def setup_left_panel(self, parent):
        """Setup the left file explorer panel"""
        self.left_frame = ttk.LabelFrame(parent, text="Project Explorer", padding=10)
        
        # Project structure tree
        tree_frame = ttk.Frame(self.left_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)
        
        self.tree = ttk.Treeview(tree_frame)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Add scrollbar
        tree_scroll = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.tree.yview)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.configure(yscrollcommand=tree_scroll.set)
        
        # Populate tree
        self.populate_file_tree()
        
        # Actions frame
        actions_frame = ttk.LabelFrame(self.left_frame, text="Actions", padding=5)
        actions_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(actions_frame, text="Open Images", command=self.open_images).pack(fill=tk.X, pady=2)
        ttk.Button(actions_frame, text="Open Slideshow", command=self.open_slideshow).pack(fill=tk.X, pady=2)
        ttk.Button(actions_frame, text="Refresh", command=self.refresh_tree).pack(fill=tk.X, pady=2)
    
    def setup_center_panel(self, parent):
        """Setup the center face grid panel"""
        self.center_frame = ttk.LabelFrame(parent, text="Face Images", padding=10)
        
        # Top controls
        controls_frame = ttk.Frame(self.center_frame)
        controls_frame.pack(fill=tk.X, pady=(0, 10))
        
        # View mode buttons
        view_frame = ttk.LabelFrame(controls_frame, text="View", padding=5)
        view_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Button(view_frame, text="📋", command=self.set_list_view).pack(side=tk.LEFT, padx=2)
        ttk.Button(view_frame, text="⊞", command=self.set_grid_view).pack(side=tk.LEFT, padx=2)
        
        # Frame size control
        size_frame = ttk.LabelFrame(controls_frame, text="Frame Size", padding=5)
        size_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        self.size_var = tk.StringVar(value="25%")
        size_combo = ttk.Combobox(size_frame, textvariable=self.size_var, 
                                 values=["10%", "25%", "50%", "75%", "100%"], 
                                 state="readonly", width=8)
        size_combo.pack(side=tk.LEFT)
        size_combo.bind('<<ComboboxSelected>>', self.on_size_change)
        
        # Sort and Filter controls
        filter_frame = ttk.LabelFrame(controls_frame, text="Sort & Filter", padding=5)
        filter_frame.pack(side=tk.LEFT, padx=(0, 10))
        
        self.sort_var = tk.StringVar(value="filename")
        sort_combo = ttk.Combobox(filter_frame, textvariable=self.sort_var,
                                 values=["filename", "date", "size", "similarity"], 
                                 state="readonly", width=10)
        sort_combo.pack(side=tk.LEFT, padx=(0, 5))
        
        ttk.Button(filter_frame, text="Sort", command=self.sort_faces).pack(side=tk.LEFT, padx=2)
        ttk.Button(filter_frame, text="Filter", command=self.filter_faces).pack(side=tk.LEFT, padx=2)
        
        # Frame range controls
        range_frame = ttk.LabelFrame(controls_frame, text="Frame Range", padding=5)
        range_frame.pack(side=tk.LEFT)
        
        ttk.Label(range_frame, text="Start:").pack(side=tk.LEFT)
        self.start_frame_var = tk.StringVar(value="0")
        ttk.Entry(range_frame, textvariable=self.start_frame_var, width=8).pack(side=tk.LEFT, padx=2)
        
        ttk.Label(range_frame, text="End:").pack(side=tk.LEFT, padx=(5, 0))
        self.end_frame_var = tk.StringVar(value=str(len(self.face_files)))
        ttk.Entry(range_frame, textvariable=self.end_frame_var, width=8).pack(side=tk.LEFT, padx=2)
        
        # Face grid with scrollbars
        grid_frame = ttk.Frame(self.center_frame)
        grid_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create canvas for face grid
        self.canvas = tk.Canvas(grid_frame, bg='#1e1e1e')
        self.scrollbar_v = ttk.Scrollbar(grid_frame, orient=tk.VERTICAL, command=self.canvas.yview)
        self.scrollbar_h = ttk.Scrollbar(grid_frame, orient=tk.HORIZONTAL, command=self.canvas.xview)
        
        self.canvas.configure(yscrollcommand=self.scrollbar_v.set, xscrollcommand=self.scrollbar_h.set)
        
        # Pack canvas and scrollbars
        self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.scrollbar_v.pack(side=tk.RIGHT, fill=tk.Y)
        self.scrollbar_h.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Create frame inside canvas for face images
        self.face_frame = ttk.Frame(self.canvas)
        self.canvas.create_window((0, 0), window=self.face_frame, anchor="nw")
        
        # Bind canvas events
        self.canvas.bind('<Configure>', self.on_canvas_configure)
        self.canvas.bind('<MouseWheel>', self.on_mousewheel)
    
    def setup_right_panel(self, parent):
        """Setup the right detection management panel"""
        self.right_frame = ttk.LabelFrame(parent, text="Detection Management", padding=10)
        
        # Frame count
        count_frame = ttk.Frame(self.right_frame)
        count_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(count_frame, text=f"Frame count: {len(self.face_files)}", 
                 font=("Arial", 10, "bold")).pack()
        
        # Detection Profiles
        profiles_frame = ttk.LabelFrame(self.right_frame, text="Detection Profiles", padding=5)
        profiles_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.profile_var = tk.StringVar(value="default")
        profile_combo = ttk.Combobox(profiles_frame, textvariable=self.profile_var,
                                    values=list(self.detection_profiles.keys()),
                                    state="readonly")
        profile_combo.pack(fill=tk.X, pady=2)
        
        profile_buttons = ttk.Frame(profiles_frame)
        profile_buttons.pack(fill=tk.X, pady=2)
        
        ttk.Button(profile_buttons, text="Add Name", command=self.add_profile).pack(side=tk.LEFT, padx=1)
        ttk.Button(profile_buttons, text="Remove", command=self.remove_profile).pack(side=tk.LEFT, padx=1)
        ttk.Button(profile_buttons, text="Reset", command=self.reset_profile).pack(side=tk.LEFT, padx=1)
        ttk.Button(profile_buttons, text="Remove Selected", command=self.remove_selected).pack(side=tk.LEFT, padx=1)
        
        # Image Information
        info_frame = ttk.LabelFrame(self.right_frame, text="Image Information", padding=5)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(info_frame, text="Face:").pack(anchor=tk.W)
        self.face_var = tk.StringVar()
        ttk.Combobox(info_frame, textvariable=self.face_var, state="readonly").pack(fill=tk.X, pady=2)
        
        ttk.Label(info_frame, text="Parent frame folder:").pack(anchor=tk.W, pady=(5, 0))
        parent_frame = ttk.Frame(info_frame)
        parent_frame.pack(fill=tk.X, pady=2)
        
        self.parent_folder_var = tk.StringVar()
        ttk.Entry(parent_frame, textvariable=self.parent_folder_var).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(parent_frame, text="📁", command=self.browse_parent_folder).pack(side=tk.RIGHT, padx=(5, 0))
        
        # Embedded Detections
        embedded_frame = ttk.LabelFrame(self.right_frame, text="Embedded Detections", padding=5)
        embedded_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.set_faces_var = tk.BooleanVar()
        ttk.Checkbutton(embedded_frame, text="Set faces to parent frames", 
                       variable=self.set_faces_var).pack(anchor=tk.W)
        
        ttk.Button(embedded_frame, text="Import face data", command=self.import_face_data).pack(fill=tk.X, pady=2)
        ttk.Button(embedded_frame, text="Embed Mask Polygons", command=self.embed_mask_polygons).pack(fill=tk.X, pady=2)
        
        # Eyebrow expand control
        eyebrow_frame = ttk.Frame(embedded_frame)
        eyebrow_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(eyebrow_frame, text="Eyebrow expand mod value between 1-4:").pack(anchor=tk.W)
        self.eyebrow_var = tk.StringVar(value="1")
        ttk.Entry(eyebrow_frame, textvariable=self.eyebrow_var, width=5).pack(anchor=tk.W)
        
        # Faces Folder
        faces_folder_frame = ttk.LabelFrame(self.right_frame, text="Faces Folder", padding=5)
        faces_folder_frame.pack(fill=tk.X, pady=(0, 10))
        
        folder_frame = ttk.Frame(faces_folder_frame)
        folder_frame.pack(fill=tk.X, pady=2)
        
        self.faces_folder_var = tk.StringVar(value=str(self.input_path))
        ttk.Entry(folder_frame, textvariable=self.faces_folder_var).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(folder_frame, text="📁", command=self.browse_faces_folder).pack(side=tk.RIGHT, padx=(5, 0))
        
        # Checkboxes
        self.only_parent_var = tk.BooleanVar()
        ttk.Checkbutton(faces_folder_frame, text="Only parent data", 
                       variable=self.only_parent_var).pack(anchor=tk.W)
        
        self.recalculate_var = tk.BooleanVar()
        ttk.Checkbutton(faces_folder_frame, text="Recalculate face data", 
                       variable=self.recalculate_var).pack(anchor=tk.W)
        
        self.copy_embedded_var = tk.BooleanVar()
        ttk.Checkbutton(faces_folder_frame, text="Copy embedded data", 
                       variable=self.copy_embedded_var).pack(anchor=tk.W)
        
        # Open XSeg Editor button
        ttk.Button(self.right_frame, text="Open XSeg Editor", 
                  command=self.open_xseg_editor).pack(fill=tk.X, pady=(10, 0))
    
    def populate_file_tree(self):
        """Populate the file tree with project structure"""
        # Clear existing items
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # Add project structure
        project_root = self.tree.insert("", "end", text="DeepFaceLab_Workflow", open=True)
        
        # Add workspace structure
        workspace = self.tree.insert(project_root, "end", text="workspace", open=True)
        
        # Add data_src
        data_src = self.tree.insert(workspace, "end", text="data_src", open=True)
        
        # Add aligned folder (current)
        aligned = self.tree.insert(data_src, "end", text="aligned", open=True)
        self.tree.insert(aligned, "end", text=f"Open images ({len(self.face_files)})")
        
        # Add other folders
        self.tree.insert(data_src, "end", text="aligned_debug")
        self.tree.insert(workspace, "end", text="model")
        self.tree.insert(workspace, "end", text="data_dst.mp4")
    
    def load_faces(self):
        """Load and display face images in the grid"""
        # Clear existing images
        for widget in self.face_frame.winfo_children():
            widget.destroy()
        
        # Calculate grid dimensions
        cols = 10  # Number of columns
        face_size = int(120 * (self.frame_size / 100))  # Adjust size based on frame size
        
        for i, face_file in enumerate(self.face_files):
            row = i // cols
            col = i % cols
            
            # Create frame for each face
            face_widget = ttk.Frame(self.face_frame)
            face_widget.grid(row=row, column=col, padx=2, pady=2)
            
            # Load and resize image
            try:
                from PIL import Image, ImageTk
                img = Image.open(face_file)
                img = img.resize((face_size, face_size), Image.Resampling.LANCZOS)
                photo = ImageTk.PhotoImage(img)
                
                # Create label with image
                img_label = ttk.Label(face_widget, image=photo)
                img_label.image = photo  # Keep a reference
                img_label.pack()
                
                # Add filename label
                filename_label = ttk.Label(face_widget, text=face_file.name, 
                                         font=("Arial", 8), foreground="white")
                filename_label.pack()
                
                # Add selection checkbox
                var = tk.BooleanVar()
                checkbox = ttk.Checkbutton(face_widget, variable=var,
                                         command=lambda f=face_file, v=var: self.toggle_selection(f, v))
                checkbox.pack()
                
                # Add bookmark button
                bookmark_btn = ttk.Button(face_widget, text="🔖", width=3,
                                         command=lambda f=face_file: self.bookmark_face(f))
                bookmark_btn.pack()
                
                # Store references
                self.face_images[face_file] = {
                    'widget': face_widget,
                    'image': photo,
                    'checkbox': checkbox,
                    'var': var,
                    'selected': False
                }
                
            except Exception as e:
                # Create placeholder for failed images
                placeholder = ttk.Label(face_widget, text=f"Error\n{face_file.name}", 
                                      font=("Arial", 8), foreground="red")
                placeholder.pack()
        
        # Update canvas scroll region
        self.face_frame.update_idletasks()
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))
    
    def toggle_selection(self, face_file, var):
        """Toggle selection of a face"""
        if var.get():
            self.selected_faces.add(face_file)
            self.face_images[face_file]['selected'] = True
            # Add green border effect
            self.face_images[face_file]['widget'].configure(relief="solid", borderwidth=2)
        else:
            self.selected_faces.discard(face_file)
            self.face_images[face_file]['selected'] = False
            # Remove border
            self.face_images[face_file]['widget'].configure(relief="flat", borderwidth=0)
    
    def bookmark_face(self, face_file):
        """Bookmark a face"""
        messagebox.showinfo("Bookmark", f"Bookmarked: {face_file.name}")
    
    def on_canvas_configure(self, event):
        """Handle canvas resize"""
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))
    
    def on_mousewheel(self, event):
        """Handle mouse wheel scrolling"""
        self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")
    
    def on_size_change(self, event):
        """Handle frame size change"""
        self.frame_size = int(self.size_var.get().replace('%', ''))
        self.load_faces()
    
    def sort_faces(self):
        """Sort faces based on selected criteria"""
        sort_mode = self.sort_var.get()
        if sort_mode == "filename":
            self.face_files.sort(key=lambda x: x.name)
        elif sort_mode == "date":
            self.face_files.sort(key=lambda x: x.stat().st_mtime)
        elif sort_mode == "size":
            self.face_files.sort(key=lambda x: x.stat().st_size)
        
        self.load_faces()
    
    def filter_faces(self):
        """Filter faces based on range"""
        try:
            start = int(self.start_frame_var.get())
            end = int(self.end_frame_var.get())
            self.face_files = self.face_files[start:end]
            self.load_faces()
        except ValueError:
            messagebox.showerror("Error", "Invalid frame range")
    
    def set_list_view(self):
        """Set list view mode"""
        messagebox.showinfo("View", "Switched to list view")
    
    def set_grid_view(self):
        """Set grid view mode"""
        messagebox.showinfo("View", "Switched to grid view")
    
    def open_images(self):
        """Open images in external viewer"""
        messagebox.showinfo("Open Images", f"Opening {len(self.face_files)} images")
    
    def open_slideshow(self):
        """Open slideshow mode"""
        messagebox.showinfo("Slideshow", "Opening slideshow mode")
    
    def refresh_tree(self):
        """Refresh the file tree"""
        self.populate_file_tree()
    
    def add_profile(self):
        """Add new detection profile"""
        name = tk.simpledialog.askstring("Add Profile", "Enter profile name:")
        if name:
            self.detection_profiles[name] = []
            # Update combobox
            self.profile_var.set(name)
    
    def remove_profile(self):
        """Remove current detection profile"""
        profile = self.profile_var.get()
        if profile != "default" and profile in self.detection_profiles:
            del self.detection_profiles[profile]
            self.profile_var.set("default")
    
    def reset_profile(self):
        """Reset current profile"""
        profile = self.profile_var.get()
        self.detection_profiles[profile] = []
        messagebox.showinfo("Reset", f"Reset profile: {profile}")
    
    def remove_selected(self):
        """Remove selected faces"""
        if self.selected_faces:
            messagebox.showinfo("Remove", f"Removing {len(self.selected_faces)} selected faces")
        else:
            messagebox.showwarning("Warning", "No faces selected")
    
    def browse_parent_folder(self):
        """Browse for parent frame folder"""
        folder = filedialog.askdirectory()
        if folder:
            self.parent_folder_var.set(folder)
    
    def browse_faces_folder(self):
        """Browse for faces folder"""
        folder = filedialog.askdirectory()
        if folder:
            self.faces_folder_var.set(folder)
    
    def import_face_data(self):
        """Import face data"""
        messagebox.showinfo("Import", "Importing face data...")
    
    def embed_mask_polygons(self):
        """Embed mask polygons"""
        messagebox.showinfo("Embed", "Embedding mask polygons...")
    
    def open_xseg_editor(self):
        """Open XSeg editor"""
        messagebox.showinfo("XSeg Editor", "Opening XSeg Editor...")

def main():
    # Get parameters from command line or use defaults
    input_path = sys.argv[1] if len(sys.argv) > 1 else "."
    face_files = sys.argv[2:] if len(sys.argv) > 2 else []
    face_type = "full_face"
    detection_model = "VGGFace2"
    similarity_threshold = 0.6
    
    root = tk.Tk()
    app = MachineVideoEditorGUI(root, input_path, face_files, face_type, detection_model, similarity_threshold)
    root.mainloop()

if __name__ == "__main__":
    main()
