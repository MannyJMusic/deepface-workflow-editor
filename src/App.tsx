import { useState, useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import WorkflowCanvas from './components/WorkflowCanvas'
import NodePalette from './components/NodePalette'
import NodeEditor from './components/NodeEditor'
import ExecutionControls from './components/ExecutionControls'
import ProgressMonitor from './components/ProgressMonitor'
import LogViewer from './components/LogViewer'
import GPUMonitor from './components/GPUMonitor'
import ErrorMonitor from './components/ErrorMonitor'
import { NotificationContainer } from './components/ToastNotification'
import { ThemeToggle } from './components/ThemeToggle'
import ViewModeToggle from './components/ViewModeToggle'
import SingleNodeView from './components/SingleNodeView'
import { useNotificationStore } from './stores/notificationStore'
import { useWorkflowStore } from './stores/workflowStore'
import { useThemeStore } from './stores/themeStore'
import { apiClient } from './services/api'

function App() {
  const { selectedNode, updateNodeStatus, setExecution, viewMode, setNodeDefinitions } = useWorkflowStore()
  const { notifications, removeNotification } = useNotificationStore()
  const { setTheme } = useThemeStore()
  const [activeTab, setActiveTab] = useState<'editor' | 'logs' | 'gpu' | 'errors'>('editor')

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-storage')
    if (savedTheme) {
      try {
        const themeData = JSON.parse(savedTheme)
        if (themeData.state?.theme) {
          setTheme(themeData.state.theme)
        }
      } catch (error) {
        console.error('Failed to parse saved theme:', error)
        setTheme('system')
      }
    } else {
      setTheme('system')
    }
  }, [setTheme])

  // Load node definitions on app start
  useEffect(() => {
    const loadNodeDefinitions = async () => {
      try {
        const definitions = await apiClient.getNodeDefinitions()
        setNodeDefinitions(definitions)
      } catch (error) {
        console.error('Failed to load node definitions:', error)
      }
    }
    
    loadNodeDefinitions()
  }, [setNodeDefinitions])

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await apiClient.connectWebSocket()
        
        // Set up WebSocket message handlers
        apiClient.onWebSocketMessage('node_update', (data) => {
          const { node_id, data: updateData } = data
          updateNodeStatus(
            node_id,
            updateData.status,
            updateData.progress,
            updateData.message
          )
        })

        apiClient.onWebSocketMessage('execution_update', (data) => {
          const { data: executionData } = data
          setExecution(executionData)
        })

        apiClient.onWebSocketMessage('log_message', (data) => {
          const { node_id, level, message } = data
          console.log(`[${level}] Node ${node_id}: ${message}`)
        })
      } catch (error) {
        console.warn('Failed to connect to WebSocket, retrying in 5 seconds...', error)
        // Retry connection after 5 seconds
        setTimeout(() => {
          connectWebSocket()
        }, 5000)
      }
    }

    // Wait a bit for the backend to be ready
    const timeoutId = setTimeout(() => {
      connectWebSocket()
    }, 2000)

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId)
      apiClient.disconnectWebSocket()
    }
  }, [updateNodeStatus, setExecution])

  const tabs = [
    { id: 'editor', label: 'Node Editor', icon: '⚙️' },
    { id: 'logs', label: 'Logs', icon: '📋' },
    { id: 'gpu', label: 'GPU Monitor', icon: '🖥️' },
    { id: 'errors', label: 'Error Monitor', icon: '🚨' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'editor':
        return selectedNode ? <NodeEditor /> : (
          <div className="p-4 text-center text-gray-500">
            Select a node to edit its parameters
          </div>
        )
      case 'logs':
        return <LogViewer />
      case 'gpu':
        return <GPUMonitor />
      case 'errors':
        return <ErrorMonitor />
      default:
        return null
    }
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 transition-colors duration-300">
              DeepFaceLab Workflow Editor
            </h1>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <ViewModeToggle />
              <ExecutionControls />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {viewMode === 'workflow' ? (
            <>
              {/* Left Sidebar - Node Palette */}
              <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 transition-colors duration-300">Nodes</h2>
                </div>
                <NodePalette />
              </div>

              {/* Center - Workflow Canvas */}
              <div className="flex-1 flex flex-col">
                <WorkflowCanvas />
              </div>

              {/* Right Sidebar - Tabs */}
              <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300">
                {/* Tab Headers */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="mr-1">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {renderTabContent()}
                </div>
              </div>
            </>
          ) : (
            /* Single Node Mode */
            <SingleNodeView />
          )}
        </div>

        {/* Bottom - Progress Monitor */}
        <ProgressMonitor />
        
        {/* Notifications */}
        <NotificationContainer
          notifications={notifications}
          onClose={removeNotification}
        />
      </div>
    </ReactFlowProvider>
  )
}

export default App
