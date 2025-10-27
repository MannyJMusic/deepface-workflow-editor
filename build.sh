#!/bin/bash
# DeepFaceLab Workflow Editor - Build Script
# This script handles the complete build process for packaging

set -e  # Exit on any error

echo "DeepFaceLab Workflow Editor - Build Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Parse command line arguments
BUILD_TYPE="all"
CLEAN=false
SKIP_PYTHON=false
SKIP_FRONTEND=false
SKIP_ELECTRON=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            BUILD_TYPE="$2"
            shift 2
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --skip-python)
            SKIP_PYTHON=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-electron)
            SKIP_ELECTRON=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --type TYPE        Build type: all, frontend, electron, python, package"
            echo "  --clean            Clean build directories before building"
            echo "  --skip-python      Skip Python bundle creation"
            echo "  --skip-frontend    Skip frontend build"
            echo "  --skip-electron    Skip Electron build"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Build everything"
            echo "  $0 --type frontend    # Build only frontend"
            echo "  $0 --clean            # Clean build and rebuild everything"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_status "Build type: $BUILD_TYPE"

# Clean build directories if requested
if [ "$CLEAN" = true ]; then
    print_status "Cleaning build directories..."
    rm -rf dist/
    rm -rf electron/dist/
    rm -rf dist-electron/
    rm -rf python-bundle/
    rm -rf portable-package/
    print_success "Build directories cleaned"
fi

# Install dependencies
print_status "Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
else
    print_status "Dependencies already installed"
fi

# Build frontend
if [ "$SKIP_FRONTEND" = false ] && ([ "$BUILD_TYPE" = "all" ] || [ "$BUILD_TYPE" = "frontend" ] || [ "$BUILD_TYPE" = "package" ]); then
    print_status "Building frontend..."
    npm run build:react
    print_success "Frontend built successfully"
fi

# Build Electron
if [ "$SKIP_ELECTRON" = false ] && ([ "$BUILD_TYPE" = "all" ] || [ "$BUILD_TYPE" = "electron" ] || [ "$BUILD_TYPE" = "package" ]); then
    print_status "Building Electron..."
    npm run build:electron
    print_success "Electron built successfully"
fi

# Create Python bundle
if [ "$SKIP_PYTHON" = false ] && ([ "$BUILD_TYPE" = "all" ] || [ "$BUILD_TYPE" = "python" ] || [ "$BUILD_TYPE" = "package" ]); then
    print_status "Creating Python bundle..."
    
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed or not in PATH"
        exit 1
    fi
    
    # Create Python bundle
    python3 create_python_bundle.py --bundle-only
    print_success "Python bundle created successfully"
fi

# Package the application
if [ "$BUILD_TYPE" = "package" ] || [ "$BUILD_TYPE" = "all" ]; then
    print_status "Packaging application..."
    
    # Check if electron-builder is available
    if ! command -v npx &> /dev/null; then
        print_error "npx is not available. Please install Node.js"
        exit 1
    fi
    
    # Create icons if they don't exist
    if [ ! -f "build/icon.png" ]; then
        print_warning "App icons not found. Creating placeholder icons..."
        
        # Create a simple placeholder icon using ImageMagick if available
        if command -v convert &> /dev/null; then
            convert -size 512x512 xc:blue -pointsize 72 -fill white -gravity center -annotate +0+0 "DFL" build/icon.png
            print_success "Placeholder icon created"
        else
            print_warning "ImageMagick not found. Please add app icons to build/ directory"
        fi
    fi
    
    # Package for current platform
    print_status "Packaging for current platform..."
    npm run package
    
    print_success "Application packaged successfully!"
    print_status "Packages are available in dist-electron/ directory"
    
    # List created packages
    if [ -d "dist-electron" ]; then
        print_status "Created packages:"
        ls -la dist-electron/
    fi
fi

# Create portable package if requested
if [ "$BUILD_TYPE" = "portable" ] || [ "$BUILD_TYPE" = "all" ]; then
    print_status "Creating portable package..."
    python3 create_python_bundle.py --portable
    print_success "Portable package created successfully!"
fi

print_success "Build completed successfully!"
print_status "Next steps:"
print_status "1. Test the packaged application"
print_status "2. Distribute the installer packages"
print_status "3. Update documentation with installation instructions"
