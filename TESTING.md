# Testing Guide for DeepFaceLab Workflow Editor

This document describes the testing strategy and how to run tests for the DeepFaceLab Workflow Editor.

## Test Structure

The test suite is organized into three main categories:

### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual components in isolation
- **Scope**: Individual node implementations, utility functions, data structures
- **Dependencies**: Minimal, mostly mocked external dependencies
- **Speed**: Fast (< 1 second per test)

**Files:**
- `test_nodes.py` - Tests for all node types (VideoInput, ExtractFaces, TrainModel, MergeFaces, VideoOutput, XSegEditor)

### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test interactions between components
- **Scope**: Workflow engine, API endpoints, data flow between nodes
- **Dependencies**: Some real components, mocked external services
- **Speed**: Medium (1-10 seconds per test)

**Files:**
- `test_workflow_engine.py` - Tests for workflow execution, validation, parallel processing

### 3. End-to-End Tests (`tests/e2e/`)
- **Purpose**: Test complete workflows from start to finish
- **Scope**: Full face swap workflows, complex multi-node scenarios
- **Dependencies**: Mocked DeepFaceLab calls, real workflow engine
- **Speed**: Slower (10-60 seconds per test)

**Files:**
- `test_complete_workflow.py` - Tests for complete face swap workflows, templates, batch processing

## Running Tests

### Prerequisites

Install test dependencies:
```bash
pip install -r requirements-test.txt
```

### Running All Tests
```bash
python3 run_tests.py
```

### Running Specific Test Types
```bash
# Unit tests only
python3 run_tests.py unit

# Integration tests only  
python3 run_tests.py integration

# End-to-end tests only
python3 run_tests.py e2e
```

### Running with Coverage
```bash
python3 run_tests.py --coverage
```

### Running with Verbose Output
```bash
python3 run_tests.py --verbose
```

### Running Individual Test Files
```bash
# Run specific test file
python3 -m pytest tests/unit/test_nodes.py

# Run specific test class
python3 -m pytest tests/unit/test_nodes.py::TestVideoInputNode

# Run specific test method
python3 -m pytest tests/unit/test_nodes.py::TestVideoInputNode::test_video_input_node_initialization
```

## Test Coverage

The test suite aims for comprehensive coverage of:

### Node Implementations
- ✅ VideoInputNode - Video frame extraction
- ✅ VideoOutputNode - Video creation from frames
- ✅ ExtractNode - Face detection and extraction
- ✅ TrainNode - Model training
- ✅ MergeNode - Face merging
- ✅ XSegNode - XSeg editor integration

### Workflow Engine
- ✅ Workflow validation (cycles, dependencies)
- ✅ Execution order calculation
- ✅ Parallel execution of independent nodes
- ✅ Error handling and recovery
- ✅ Progress tracking and WebSocket updates

### API Endpoints
- ✅ Workflow CRUD operations
- ✅ Node definition retrieval
- ✅ Execution control
- ✅ GPU management
- ✅ Error handling

### Complete Workflows
- ✅ Basic face swap (video → faces → train → merge → video)
- ✅ Face swap with XSeg editing
- ✅ Batch processing workflows
- ✅ Error scenarios and recovery

## Test Data and Mocking

### Mocked Components
- **DeepFaceLab subprocess calls**: All `subprocess.Popen` calls are mocked to avoid requiring actual DeepFaceLab installation
- **File system operations**: Temporary directories are used for test data
- **WebSocket connections**: Mocked for testing real-time updates
- **Database operations**: Mocked for testing persistence

### Test Data
- **Video files**: Mocked as empty files for testing file path handling
- **Image sequences**: Mocked directories for testing batch operations
- **Model files**: Mocked for testing training and merging workflows

## Writing New Tests

### Unit Test Guidelines
```python
class TestNewNode:
    def test_node_initialization(self):
        """Test node initialization with valid parameters"""
        # Arrange
        node_data = WorkflowNode(...)
        
        # Act
        node = NewNode(node_data)
        
        # Assert
        assert node.node_id == "expected_id"
        assert node.parameters == expected_params
    
    @pytest.mark.asyncio
    async def test_node_execution(self):
        """Test node execution with mocked dependencies"""
        # Arrange
        node = NewNode(node_data)
        
        # Act
        with patch('subprocess.Popen') as mock_popen:
            mock_popen.return_value = mock_process
            result = await node.execute(context)
        
        # Assert
        assert result["success"] == True
```

### Integration Test Guidelines
```python
class TestWorkflowIntegration:
    @pytest.mark.asyncio
    async def test_workflow_execution(self):
        """Test complete workflow execution"""
        # Arrange
        workflow = create_test_workflow()
        engine = WorkflowEngine()
        
        # Act
        with patch.object(engine, '_load_workflow') as mock_load:
            mock_load.return_value = workflow
            result = await engine.execute_workflow("test", "execution")
        
        # Assert
        assert result["success"] == True
```

### E2E Test Guidelines
```python
class TestCompleteWorkflow:
    def setup_method(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.workflow = create_complete_workflow()
    
    def teardown_method(self):
        """Clean up test fixtures"""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_complete_face_swap(self):
        """Test complete face swap workflow"""
        # Test the entire workflow from video input to video output
```

## Continuous Integration

The test suite is designed to run in CI environments:

- **No external dependencies**: All external services are mocked
- **Deterministic**: Tests produce consistent results
- **Fast feedback**: Unit tests run quickly for immediate feedback
- **Comprehensive**: Full test suite validates complete functionality

## Debugging Tests

### Running Tests in Debug Mode
```bash
python3 -m pytest tests/unit/test_nodes.py -v -s --pdb
```

### Test Output and Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# In test methods
logger = logging.getLogger(__name__)
logger.debug("Test debug information")
```

### Common Issues
1. **Import errors**: Ensure Python path includes the backend directory
2. **Async test failures**: Use `@pytest.mark.asyncio` decorator
3. **Mock not working**: Check mock target paths and ensure proper patching
4. **File permission errors**: Use temporary directories for test data

## Performance Testing

For performance-critical components, additional benchmarks can be added:

```python
@pytest.mark.benchmark
def test_workflow_execution_performance(benchmark):
    """Benchmark workflow execution performance"""
    result = benchmark(execute_workflow, test_workflow)
    assert result["success"] == True
```

## Future Test Enhancements

- **GPU testing**: Add tests that require actual GPU hardware
- **Load testing**: Test with large workflows and many nodes
- **Memory testing**: Test memory usage with large datasets
- **Network testing**: Test WebSocket performance under load
- **UI testing**: Add tests for frontend components (with Playwright or similar)
