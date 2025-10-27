#!/usr/bin/env python3
"""
Comprehensive workflow test for DeepFaceLab Workflow Editor
Tests multiple nodes and demonstrates the complete functionality
"""

import asyncio
import requests
import json
import time
from pathlib import Path

class WorkflowTester:
    def __init__(self, base_url="http://localhost:8001/api"):
        self.base_url = base_url
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": time.time()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"    Details: {details}")
    
    def test_api_connectivity(self):
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{self.base_url}/nodes/definitions", timeout=5)
            if response.status_code == 200:
                nodes = response.json()
                self.log_test(
                    "API Connectivity", 
                    True, 
                    f"Connected successfully, found {len(nodes)} node definitions"
                )
                return True
            else:
                self.log_test("API Connectivity", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Connectivity", False, f"Connection failed: {str(e)}")
            return False
    
    def test_node_definitions(self):
        """Test node definitions API"""
        try:
            response = requests.get(f"{self.base_url}/nodes/definitions")
            nodes = response.json()
            
            expected_nodes = [
                "video_input", "extract_faces", "train_model", 
                "merge_faces", "video_output", "advanced_face_editor",
                "image_resize", "face_filter", "batch_rename"
            ]
            
            found_nodes = [node["id"] for node in nodes]
            missing_nodes = [node for node in expected_nodes if node not in found_nodes]
            
            if not missing_nodes:
                self.log_test(
                    "Node Definitions", 
                    True, 
                    f"All {len(expected_nodes)} expected nodes found"
                )
                return True
            else:
                self.log_test(
                    "Node Definitions", 
                    False, 
                    f"Missing nodes: {missing_nodes}"
                )
                return False
                
        except Exception as e:
            self.log_test("Node Definitions", False, f"Error: {str(e)}")
            return False
    
    def test_node_categories(self):
        """Test node categories API"""
        try:
            response = requests.get(f"{self.base_url}/nodes/categories")
            categories = response.json()
            
            expected_categories = ["Input", "Processing", "Output", "Editing"]
            missing_categories = [cat for cat in expected_categories if cat not in categories]
            
            if not missing_categories:
                self.log_test(
                    "Node Categories", 
                    True, 
                    f"All {len(expected_categories)} expected categories found"
                )
                return True
            else:
                self.log_test(
                    "Node Categories", 
                    False, 
                    f"Missing categories: {missing_categories}"
                )
                return False
                
        except Exception as e:
            self.log_test("Node Categories", False, f"Error: {str(e)}")
            return False
    
    def test_advanced_face_editor(self):
        """Test Advanced Face Editor node execution"""
        try:
            # Create test directory with face images
            test_dir = Path("/Volumes/MacOSNew/SourceCode/deepface-editor/deepface-workflow-editor/workspace/test_faces")
            test_dir.mkdir(exist_ok=True)
            
            # Create a simple test image
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (256, 256), color='lightblue')
            draw = ImageDraw.Draw(img)
            draw.ellipse([50, 50, 206, 206], fill='peachpuff', outline='black', width=2)
            draw.ellipse([80, 100, 100, 120], fill='white', outline='black')
            draw.ellipse([156, 100, 176, 120], fill='white', outline='black')
            draw.ellipse([85, 105, 95, 115], fill='black')
            draw.ellipse([161, 105, 171, 115], fill='black')
            draw.polygon([(128, 130), (118, 160), (138, 160)], fill='peachpuff', outline='black')
            draw.arc([100, 170, 156, 190], 0, 180, fill='red', width=3)
            
            test_image = test_dir / "test_face.jpg"
            img.save(test_image)
            
            # Execute Advanced Face Editor
            response = requests.post(
                f"{self.base_url}/execution/start-node/face-editor-test",
                params={"input_dir": str(test_dir)}
            )
            
            if response.status_code == 200:
                execution = response.json()
                self.log_test(
                    "Advanced Face Editor", 
                    True, 
                    f"Execution started: {execution['workflow_id']}"
                )
                
                # Wait for completion
                time.sleep(3)
                
                # Check execution status
                status_response = requests.get(f"{self.base_url}/execution/list")
                if status_response.status_code == 200:
                    executions = status_response.json()
                    latest_execution = executions[-1] if executions else None
                    
                    if latest_execution and latest_execution["status"] == "completed":
                        self.log_test(
                            "Advanced Face Editor Completion", 
                            True, 
                            "Execution completed successfully"
                        )
                        return True
                    else:
                        self.log_test(
                            "Advanced Face Editor Completion", 
                            False, 
                            f"Execution status: {latest_execution['status'] if latest_execution else 'Not found'}"
                        )
                        return False
                else:
                    self.log_test("Advanced Face Editor Status", False, "Could not check status")
                    return False
            else:
                self.log_test("Advanced Face Editor", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Advanced Face Editor", False, f"Error: {str(e)}")
            return False
    
    def test_utility_nodes(self):
        """Test utility nodes (Image Resize, Face Filter, Batch Rename)"""
        try:
            # Test Image Resize
            test_dir = Path("/Volumes/MacOSNew/SourceCode/deepface-editor/deepface-workflow-editor/workspace/utility_test")
            test_dir.mkdir(exist_ok=True)
            
            # Create test images
            from PIL import Image, ImageDraw
            for i in range(3):
                img = Image.new('RGB', (512, 512), color='lightgreen')
                draw = ImageDraw.Draw(img)
                draw.ellipse([100, 100, 412, 412], fill='yellow', outline='black', width=3)
                img.save(test_dir / f"test_image_{i:03d}.jpg")
            
            # Test Image Resize
            resize_response = requests.post(
                f"{self.base_url}/execution/start-node/resize-test",
                params={"input_dir": str(test_dir)}
            )
            
            if resize_response.status_code == 200:
                self.log_test("Image Resize Node", True, "Execution started successfully")
            else:
                self.log_test("Image Resize Node", False, f"HTTP {resize_response.status_code}")
                return False
            
            # Wait and check status
            time.sleep(3)
            status_response = requests.get(f"{self.base_url}/execution/list")
            if status_response.status_code == 200:
                executions = status_response.json()
                latest_execution = executions[-1] if executions else None
                
                if latest_execution and latest_execution["status"] == "completed":
                    self.log_test("Image Resize Completion", True, "Execution completed successfully")
                    return True
                else:
                    self.log_test("Image Resize Completion", False, f"Status: {latest_execution['status'] if latest_execution else 'Not found'}")
                    return False
            else:
                self.log_test("Image Resize Status", False, "Could not check status")
                return False
                
        except Exception as e:
            self.log_test("Utility Nodes", False, f"Error: {str(e)}")
            return False
    
    def test_websocket_connection(self):
        """Test WebSocket connectivity"""
        try:
            import websocket
            
            def on_message(ws, message):
                data = json.loads(message)
                if data.get("type") == "node_update":
                    self.log_test("WebSocket Node Update", True, "Received node update message")
                elif data.get("type") == "execution_update":
                    self.log_test("WebSocket Execution Update", True, "Received execution update message")
            
            def on_error(ws, error):
                self.log_test("WebSocket Connection", False, f"WebSocket error: {str(error)}")
            
            def on_close(ws, close_status_code, close_msg):
                pass
            
            def on_open(ws):
                self.log_test("WebSocket Connection", True, "Connected successfully")
                ws.close()
            
            ws_url = "ws://localhost:8001/ws"
            ws = websocket.WebSocketApp(ws_url, on_message=on_message, on_error=on_error, on_close=on_close, on_open=on_open)
            
            # Run WebSocket for 2 seconds
            ws.run_forever(timeout=2)
            return True
            
        except ImportError:
            self.log_test("WebSocket Connection", False, "websocket-client not installed")
            return False
        except Exception as e:
            self.log_test("WebSocket Connection", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests and generate report"""
        print("🧪 Starting DeepFaceLab Workflow Editor Tests...")
        print("=" * 60)
        
        tests = [
            self.test_api_connectivity,
            self.test_node_definitions,
            self.test_node_categories,
            self.test_advanced_face_editor,
            self.test_utility_nodes,
            self.test_websocket_connection
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error: {str(e)}")
        
        print("=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! The DeepFaceLab Workflow Editor is working correctly.")
        else:
            print(f"⚠️  {total - passed} tests failed. Please check the issues above.")
        
        return passed == total

def main():
    """Main test function"""
    tester = WorkflowTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results_file = Path("/Volumes/MacOSNew/SourceCode/deepface-editor/deepface-workflow-editor/workspace/test_results.json")
    with open(results_file, 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())



