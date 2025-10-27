from fastapi import WebSocket
from typing import List, Dict, Any
import json
import asyncio
from datetime import datetime

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.node_subscriptions: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        # Remove from all node subscriptions
        for node_id, subscribers in self.node_subscriptions.items():
            if websocket in subscribers:
                subscribers.remove(websocket)
        
        print(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        if not self.active_connections:
            return
        
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Error broadcasting message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

    async def send_node_update(self, node_id: str, update_data: Dict[str, Any]):
        """Send update to all subscribers of a specific node"""
        message = json.dumps({
            "type": "node_update",
            "node_id": node_id,
            "data": update_data,
            "timestamp": datetime.now().isoformat()
        })
        
        # Send to all subscribers of this node
        if node_id in self.node_subscriptions:
            disconnected = []
            for websocket in self.node_subscriptions[node_id]:
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    print(f"Error sending node update: {e}")
                    disconnected.append(websocket)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn)

    async def send_execution_update(self, execution_data: Dict[str, Any]):
        """Send workflow execution update to all connected clients"""
        message = json.dumps({
            "type": "execution_update",
            "data": execution_data,
            "timestamp": datetime.now().isoformat()
        })
        await self.broadcast(message)

    async def send_log_message(self, node_id: str, level: str, message: str):
        """Send log message to all subscribers of a specific node"""
        log_data = {
            "type": "log_message",
            "node_id": node_id,
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        message_json = json.dumps(log_data)
        
        # Send to all subscribers of this node
        if node_id in self.node_subscriptions:
            disconnected = []
            for websocket in self.node_subscriptions[node_id]:
                try:
                    await websocket.send_text(message_json)
                except Exception as e:
                    print(f"Error sending log message: {e}")
                    disconnected.append(websocket)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn)

    def subscribe_to_node(self, websocket: WebSocket, node_id: str):
        """Subscribe a websocket to updates from a specific node"""
        if node_id not in self.node_subscriptions:
            self.node_subscriptions[node_id] = []
        
        if websocket not in self.node_subscriptions[node_id]:
            self.node_subscriptions[node_id].append(websocket)

    def unsubscribe_from_node(self, websocket: WebSocket, node_id: str):
        """Unsubscribe a websocket from updates from a specific node"""
        if node_id in self.node_subscriptions:
            if websocket in self.node_subscriptions[node_id]:
                self.node_subscriptions[node_id].remove(websocket)

    async def send_console_log(self, node_id: str, message: str, level: str = "info"):
        """Send console log message for face editor operations"""
        log_data = {
            "type": "console_log",
            "node_id": node_id,
            "level": level,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        message_json = json.dumps(log_data)
        
        # Send to all subscribers of this node
        if node_id in self.node_subscriptions:
            disconnected = []
            for websocket in self.node_subscriptions[node_id]:
                try:
                    await websocket.send_text(message_json)
                except Exception as e:
                    print(f"Error sending console log: {e}")
                    disconnected.append(websocket)
            
            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn)

# Global WebSocket manager instance
websocket_manager = WebSocketManager()
