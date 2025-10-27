# Build and Packaging Guide

This guide explains how to build and package the DeepFaceLab Workflow Editor for distribution.

## Prerequisites

### Required Software
- **Node.js** (v18 or higher)
- **Python 3.8+** (for backend)
- **npm** (comes with Node.js)
- **Git** (for version control)

### Optional Software
- **ImageMagick** (for creating app icons)
- **Conda** (for Python environment management)

## Build Process Overview

The build process consists of several steps:

1. **Frontend Build** - Compile React/TypeScript frontend
2. **Electron Build** - Compile Electron main process
3. **Python Bundle** - Create standalone Python environment
4. **Packaging** - Create platform-specific installers

## Quick Start

### Build Everything
```bash
./build.sh
```

### Clean Build
```bash
./build.sh --clean
```

### Build Specific Components
```bash
# Frontend only
./build.sh --type frontend

# Python bundle only
./build.sh --type python

# Package only (requires previous builds)
./build.sh --type package
```

## Detailed Build Steps

### 1. Frontend Build

The frontend is built using Vite:

```bash
npm run build:react
```

This creates:
- `dist/` - Compiled frontend assets
- Optimized JavaScript bundles
- CSS with TailwindCSS processing

### 2. Electron Build

The Electron main process is compiled with TypeScript:

```bash
npm run build:electron
```

This creates:
- `electron/dist/` - Compiled Electron main process
- TypeScript compiled to JavaScript

### 3. Python Bundle

A standalone Python environment is created:

```bash
npm run build:python
```

This creates:
- `python-bundle/` - Standalone Python environment
- `python-bundle/venv/` - Virtual environment with dependencies
- `python-bundle/backend/` - Backend source code
- `python-bundle/start_backend.sh` - Backend launcher script

### 4. Packaging

Platform-specific installers are created:

```bash
# Current platform
npm run package

# All platforms (requires macOS for universal builds)
npm run package:all

# Specific platforms
npm run package:mac
npm run package:win
npm run package:linux
```

## Platform-Specific Packaging

### macOS
- **Format**: DMG installer
- **Architecture**: x64, ARM64 (Apple Silicon)
- **Requirements**: macOS 10.15+
- **Output**: `dist-electron/DeepFaceLab Workflow Editor-1.0.0.dmg`

### Windows
- **Format**: NSIS installer
- **Architecture**: x64
- **Requirements**: Windows 10+
- **Output**: `dist-electron/DeepFaceLab Workflow Editor Setup 1.0.0.exe`

### Linux
- **Format**: AppImage, DEB package
- **Architecture**: x64
- **Requirements**: Modern Linux distribution
- **Output**: 
  - `dist-electron/DeepFaceLab Workflow Editor-1.0.0.AppImage`
  - `dist-electron/deepface-workflow-editor_1.0.0_amd64.deb`

## Build Configuration

### Electron Builder Configuration

The `package.json` contains the electron-builder configuration:

```json
{
  "build": {
    "appId": "com.deepfacelab.workflow-editor",
    "productName": "DeepFaceLab Workflow Editor",
    "directories": {
      "output": "dist-electron",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "electron/dist/**/*",
      "backend/**/*",
      "DeepFaceLab_Linux/**/*",
      "node_modules/**/*"
    ],
    "extraResources": [
      {
        "from": "DeepFaceLab_Linux",
        "to": "DeepFaceLab_Linux"
      }
    ]
  }
}
```

### Build Assets

Required build assets in `build/` directory:

- `icon.icns` - macOS app icon (512x512)
- `icon.ico` - Windows app icon (256x256)
- `icon.png` - Linux app icon (512x512)
- `dmg-background.png` - macOS DMG background
- `entitlements.mac.plist` - macOS entitlements

## Python Bundling

The Python bundling process creates a standalone environment:

### What's Included
- **Python Runtime** - Complete Python installation
- **Dependencies** - All required packages (FastAPI, Uvicorn, etc.)
- **Backend Code** - Complete backend source code
- **DeepFaceLab** - DeepFaceLab framework and dependencies

### Bundle Structure
```
python-bundle/
├── venv/                    # Python virtual environment
│   ├── bin/python          # Python executable
│   ├── lib/                # Python libraries
│   └── ...
├── backend/                # Backend source code
│   ├── api/                # FastAPI application
│   ├── core/               # Core functionality
│   └── ...
├── start_backend.sh        # Backend launcher
├── requirements.txt        # Frozen requirements
└── README.md               # Bundle documentation
```

## Portable Package

A portable package can be created for distribution without installers:

```bash
python3 create_python_bundle.py --portable
```

This creates:
- `portable-package/` - Complete portable application
- `portable-package/start_app.sh` - Application launcher
- All dependencies bundled together

## Troubleshooting

### Common Issues

#### 1. Python Bundle Creation Fails
```bash
# Check Python installation
python3 --version

# Install missing dependencies
pip install -r requirements.txt
```

#### 2. Electron Build Fails
```bash
# Clean and rebuild
npm run build:clean

# Check Node.js version
node --version
```

#### 3. Packaging Fails
```bash
# Check electron-builder installation
npx electron-builder --version

# Clean build directories
rm -rf dist-electron/
```

#### 4. Missing Icons
```bash
# Create placeholder icons (requires ImageMagick)
convert -size 512x512 xc:blue -pointsize 72 -fill white -gravity center -annotate +0+0 "DFL" build/icon.png
```

### Build Logs

Build logs are available in:
- `dist-electron/` - Electron builder logs
- `python-bundle/` - Python bundle creation logs
- Console output - Real-time build progress

## Distribution

### Installer Packages

The packaged installers are located in `dist-electron/`:

- **macOS**: DMG file for drag-and-drop installation
- **Windows**: EXE installer with NSIS
- **Linux**: AppImage for universal compatibility, DEB for Debian-based systems

### Installation Instructions

#### macOS
1. Download the DMG file
2. Double-click to mount
3. Drag the app to Applications folder
4. Launch from Applications or Spotlight

#### Windows
1. Download the EXE installer
2. Run as administrator
3. Follow the installation wizard
4. Launch from Start menu or desktop shortcut

#### Linux
1. Download the AppImage file
2. Make executable: `chmod +x *.AppImage`
3. Run: `./DeepFaceLab\ Workflow\ Editor-1.0.0.AppImage`

### Portable Distribution

For users who prefer portable applications:

1. Download the portable package
2. Extract to desired location
3. Run `start_app.sh` (Linux/macOS) or `start_app.bat` (Windows)

## Continuous Integration

### GitHub Actions

Example workflow for automated builds:

```yaml
name: Build and Package
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build application
      run: ./build.sh --type all
    
    - name: Package application
      run: npm run package
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: installer-${{ matrix.os }}
        path: dist-electron/
```

## Performance Optimization

### Build Optimization

- **Tree Shaking** - Unused code is eliminated
- **Code Splitting** - Frontend bundles are split for faster loading
- **Asset Optimization** - Images and fonts are optimized
- **Python Bundle** - Only necessary packages are included

### Runtime Optimization

- **Lazy Loading** - Components load on demand
- **Caching** - API responses and assets are cached
- **Background Processing** - Heavy operations run in background
- **Memory Management** - Efficient memory usage for large workflows

## Security Considerations

### Code Signing

For production releases, consider code signing:

#### macOS
```bash
# Sign the app bundle
codesign --sign "Developer ID Application: Your Name" "DeepFaceLab Workflow Editor.app"

# Notarize for distribution
xcrun notarytool submit "DeepFaceLab Workflow Editor.dmg" --keychain-profile "notarytool"
```

#### Windows
```bash
# Sign the installer
signtool sign /f certificate.p12 /p password "DeepFaceLab Workflow Editor Setup.exe"
```

### Security Features

- **Sandboxing** - Electron app runs in sandboxed environment
- **CSP** - Content Security Policy prevents XSS attacks
- **HTTPS** - All API communications use HTTPS
- **Input Validation** - All user inputs are validated

## Maintenance

### Updating Dependencies

```bash
# Update Node.js dependencies
npm update

# Update Python dependencies
pip install -r requirements.txt --upgrade

# Rebuild after updates
./build.sh --clean
```

### Version Management

Update version in `package.json`:
```json
{
  "version": "1.0.1"
}
```

### Release Process

1. Update version numbers
2. Update changelog
3. Build and test
4. Create release tag
5. Build packages
6. Upload to distribution channels
7. Announce release
