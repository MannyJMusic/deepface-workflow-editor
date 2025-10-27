# Setting Up Conda Environment for DeepFaceLab Workflow Editor

## Quick Setup

The startup script needs to know where your conda installation is located. Here's how to configure it:

### Step 1: Find Your Conda Installation

Run these commands to find your conda path:

```bash
# Check if conda is in your PATH
which conda

# Or get the base directory
conda info --base

# Check for standard locations
ls -la ~/miniconda3/etc/profile.d/conda.sh
ls -la ~/anaconda3/etc/profile.d/conda.sh
ls -la /opt/homebrew/miniconda3/etc/profile.d/conda.sh
```

### Step 2: Configure the Startup Script

Choose one of these methods:

#### Method 1: Environment Variables (Recommended for testing)

```bash
export CONDA_PATH="~/miniconda3/etc/profile.d/conda.sh"  # Replace with your path
export CONDA_ENV="deepface-editor"
npm start
```

#### Method 2: Local Configuration File (Recommended for permanent setup)

1. Copy the example config:
   ```bash
   cp start.config.js start.config.local.js
   ```

2. Edit `start.config.local.js` and update:
   ```javascript
   module.exports = {
       condaEnv: 'deepface-editor',
       condaPath: '/path/to/your/conda/etc/profile.d/conda.sh',  // Update this
       pythonExecutable: 'python3'
   };
   ```

3. Now run:
   ```bash
   npm start
   ```

### Step 3: Verify the Conda Environment

Ensure your conda environment has the required packages:

```bash
# Activate your conda environment
conda activate deepface-editor

# Install dependencies if needed
pip install -r requirements.txt

# Verify FastAPI is installed
python -c "import fastapi; print('FastAPI is installed')"
```

## Troubleshooting

### "Conda command not found"

If you see this error, conda is not in your PATH. Add it to your shell configuration:

```bash
# Add to ~/.zshrc (for zsh) or ~/.bash_profile (for bash)
echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "Conda path not configured"

If the script can't find conda, you'll see a message like:
```
Using system Python (conda not configured)
```

To fix this:
1. Find your conda path using the commands in Step 1
2. Configure it using Method 1 or 2 above

### "ModuleNotFoundError: No module named 'fastapi'"

This means the dependencies are not installed in your conda environment:

```bash
conda activate deepface-editor
pip install -r requirements.txt
```

## Configuration Options

You can configure these settings via environment variables:

- `CONDA_PATH`: Path to conda's initialization script
- `CONDA_ENV`: Conda environment name (default: 'deepface-editor')
- `PYTHON_EXECUTABLE`: Python executable to use (default: 'python3')
- `BACKEND_PORT`: Backend port (default: 8001)
- `FRONTEND_PORT`: Frontend port (default: 5173)

Example:
```bash
CONDA_PATH="~/miniconda3/etc/profile.d/conda.sh" CONDA_ENV="deepface-editor" npm start
```

## Verification

After configuration, verify everything works:

```bash
# Start services
npm start

# In another terminal, check status
npm run status

# Check logs if there are issues
cat .backend.log
```

## Common Conda Paths

Common conda installation paths:

- **macOS (Homebrew)**: `/opt/homebrew/miniconda3/etc/profile.d/conda.sh`
- **macOS (User install)**: `~/miniconda3/etc/profile.d/conda.sh`
- **Linux**: `~/miniconda3/etc/profile.d/conda.sh`
- **Anaconda**: `~/anaconda3/etc/profile.d/conda.sh`
