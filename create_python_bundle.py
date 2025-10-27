#!/usr/bin/env python3
"""
Python bundling script for DeepFaceLab Workflow Editor
This script creates a standalone Python environment for the packaged app.
"""
import os
import sys
import subprocess
import shutil
import tempfile
from pathlib import Path
import venv
import zipfile


def create_python_bundle():
    """Create a standalone Python bundle for the Electron app"""
    
    print("Creating Python bundle for DeepFaceLab Workflow Editor...")
    
    # Get the project root directory
    project_root = Path(__file__).parent
    backend_dir = project_root / "backend"
    bundle_dir = project_root / "python-bundle"
    
    # Clean up existing bundle
    if bundle_dir.exists():
        shutil.rmtree(bundle_dir)
    
    bundle_dir.mkdir(exist_ok=True)
    
    # Create a virtual environment
    print("Creating virtual environment...")
    venv_dir = bundle_dir / "venv"
    venv.create(venv_dir, with_pip=True)
    
    # Get the Python executable path
    if sys.platform == "win32":
        python_exe = venv_dir / "Scripts" / "python.exe"
        pip_exe = venv_dir / "Scripts" / "pip.exe"
    else:
        python_exe = venv_dir / "bin" / "python"
        pip_exe = venv_dir / "bin" / "pip"
    
    # Install required packages
    print("Installing Python dependencies...")
    requirements_file = project_root / "requirements.txt"
    
    if requirements_file.exists():
        subprocess.run([
            str(pip_exe), "install", "-r", str(requirements_file)
        ], check=True)
    
    # Copy backend source code
    print("Copying backend source code...")
    backend_bundle_dir = bundle_dir / "backend"
    shutil.copytree(backend_dir, backend_bundle_dir)
    
    # Create a launcher script
    print("Creating launcher script...")
    launcher_content = create_launcher_script(python_exe, backend_bundle_dir)
    
    if sys.platform == "win32":
        launcher_file = bundle_dir / "start_backend.bat"
        with open(launcher_file, 'w') as f:
            f.write(launcher_content)
    else:
        launcher_file = bundle_dir / "start_backend.sh"
        with open(launcher_file, 'w') as f:
            f.write(launcher_content)
        os.chmod(launcher_file, 0o755)
    
    # Create a requirements file for the bundle
    print("Creating bundle requirements...")
    bundle_requirements = bundle_dir / "requirements.txt"
    subprocess.run([
        str(pip_exe), "freeze"
    ], stdout=open(bundle_requirements, 'w'), check=True)
    
    # Create a README for the bundle
    readme_content = f"""# DeepFaceLab Workflow Editor - Python Bundle

This directory contains a standalone Python environment for the DeepFaceLab Workflow Editor.

## Contents

- `venv/` - Python virtual environment with all dependencies
- `backend/` - Backend source code
- `start_backend.{'bat' if sys.platform == 'win32' else 'sh'}` - Backend launcher script
- `requirements.txt` - Frozen requirements for this bundle

## Usage

The Electron app will automatically start the Python backend using the launcher script.

## Manual Usage

To start the backend manually:

### Windows
```cmd
start_backend.bat
```

### macOS/Linux
```bash
./start_backend.sh
```

## Dependencies

This bundle includes all required Python packages:
- FastAPI
- Uvicorn
- WebSocket support
- All DeepFaceLab dependencies

## Version

Created on: {os.popen('date').read().strip()}
Python version: {sys.version}
Platform: {sys.platform}
"""
    
    with open(bundle_dir / "README.md", 'w') as f:
        f.write(readme_content)
    
    print(f"Python bundle created successfully at: {bundle_dir}")
    print(f"Bundle size: {get_directory_size(bundle_dir):.2f} MB")
    
    return bundle_dir


def create_launcher_script(python_exe, backend_dir):
    """Create a launcher script for the backend"""
    
    if sys.platform == "win32":
        script_content = f"""@echo off
REM DeepFaceLab Workflow Editor - Backend Launcher
echo Starting DeepFaceLab Workflow Editor Backend...

cd /d "{backend_dir}"
"{python_exe}" api/main.py

pause
"""
    else:
        script_content = f"""#!/bin/bash
# DeepFaceLab Workflow Editor - Backend Launcher
echo "Starting DeepFaceLab Workflow Editor Backend..."

cd "{backend_dir}"
"{python_exe}" api/main.py
"""
    
    return script_content


def get_directory_size(directory):
    """Get the size of a directory in MB"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(directory):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if os.path.exists(filepath):
                total_size += os.path.getsize(filepath)
    return total_size / (1024 * 1024)  # Convert to MB


def create_portable_package():
    """Create a portable package that can be distributed"""
    
    print("Creating portable package...")
    
    project_root = Path(__file__).parent
    bundle_dir = project_root / "python-bundle"
    
    if not bundle_dir.exists():
        print("Python bundle not found. Creating it first...")
        bundle_dir = create_python_bundle()
    
    # Create portable package
    portable_dir = project_root / "portable-package"
    if portable_dir.exists():
        shutil.rmtree(portable_dir)
    
    portable_dir.mkdir(exist_ok=True)
    
    # Copy necessary files
    print("Copying files to portable package...")
    
    # Copy Python bundle
    shutil.copytree(bundle_dir, portable_dir / "python-bundle")
    
    # Copy DeepFaceLab
    dfl_source = project_root / "DeepFaceLab_Linux"
    if dfl_source.exists():
        shutil.copytree(dfl_source, portable_dir / "DeepFaceLab_Linux")
    
    # Copy frontend build
    dist_dir = project_root / "dist"
    if dist_dir.exists():
        shutil.copytree(dist_dir, portable_dir / "dist")
    
    # Copy Electron build
    electron_dist = project_root / "electron" / "dist"
    if electron_dist.exists():
        shutil.copytree(electron_dist, portable_dir / "electron")
    
    # Create a launcher script for the portable package
    launcher_content = create_portable_launcher()
    
    if sys.platform == "win32":
        launcher_file = portable_dir / "start_app.bat"
        with open(launcher_file, 'w') as f:
            f.write(launcher_content)
    else:
        launcher_file = portable_dir / "start_app.sh"
        with open(launcher_file, 'w') as f:
            f.write(launcher_content)
        os.chmod(launcher_file, 0o755)
    
    print(f"Portable package created at: {portable_dir}")
    print(f"Package size: {get_directory_size(portable_dir):.2f} MB")
    
    return portable_dir


def create_portable_launcher():
    """Create a launcher script for the portable package"""
    
    if sys.platform == "win32":
        script_content = """@echo off
REM DeepFaceLab Workflow Editor - Portable Launcher
echo Starting DeepFaceLab Workflow Editor...

REM Start backend
start "Backend" cmd /c "cd python-bundle && start_backend.bat"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend (if available)
if exist "dist\\index.html" (
    start "Frontend" cmd /c "cd dist && python -m http.server 5173"
)

echo DeepFaceLab Workflow Editor started!
echo Backend: http://localhost:8001
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul
"""
    else:
        script_content = """#!/bin/bash
# DeepFaceLab Workflow Editor - Portable Launcher
echo "Starting DeepFaceLab Workflow Editor..."

# Start backend
cd python-bundle
./start_backend.sh &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend (if available)
if [ -f "../dist/index.html" ]; then
    cd ../dist
    python3 -m http.server 5173 &
    FRONTEND_PID=$!
fi

echo "DeepFaceLab Workflow Editor started!"
echo "Backend: http://localhost:8001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for user interrupt
trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit' INT
wait
"""
    
    return script_content


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create Python bundle for DeepFaceLab Workflow Editor")
    parser.add_argument("--portable", action="store_true", help="Create portable package")
    parser.add_argument("--bundle-only", action="store_true", help="Create only Python bundle")
    
    args = parser.parse_args()
    
    try:
        if args.portable:
            create_portable_package()
        elif args.bundle_only:
            create_python_bundle()
        else:
            print("Creating Python bundle...")
            create_python_bundle()
            print("\nTo create a portable package, run with --portable flag")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
