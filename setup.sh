#!/bin/bash
# Quick setup script for DeepFaceLab Workflow Editor

echo "🐍 Setting up DeepFaceLab Workflow Editor..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Install core dependencies
echo "📦 Installing core dependencies..."
pip3 install --user fastapi uvicorn python-socketio python-multipart pydantic python-dotenv psutil

# Verify installation
echo "🔍 Verifying installation..."
python3 -c "import fastapi; print('✅ FastAPI installed successfully')" || echo "❌ FastAPI installation failed"
python3 -c "import uvicorn; print('✅ Uvicorn installed successfully')" || echo "❌ Uvicorn installation failed"
python3 -c "import pydantic; print('✅ Pydantic installed successfully')" || echo "❌ Pydantic installation failed"

echo "🎉 Setup complete! You can now run: npm start"
