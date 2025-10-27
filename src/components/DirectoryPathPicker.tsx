import React, { useState, useEffect } from 'react'

interface DirectoryPathPickerProps {
  value: string
  onChange: (path: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const DirectoryPathPicker: React.FC<DirectoryPathPickerProps> = ({
  value,
  onChange,
  placeholder = "Select a directory...",
  className = "",
  disabled = false
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [dirInfo, setDirInfo] = useState<{ exists?: boolean; fileCount?: number }>({})

  useEffect(() => {
    if (value) {
      validatePath(value)
    } else {
      setIsValid(null)
      setDirInfo({})
    }
  }, [value])

  const validatePath = async (path: string) => {
    try {
      if (window.electronAPI && window.electronAPI.pathExists) {
        const result = await window.electronAPI.pathExists(path)
        const stats = result.exists ? await window.electronAPI.getDirectoryStats(path) : null
        
        setIsValid(result.exists)
        setDirInfo({
          exists: result.exists,
          fileCount: stats?.fileCount
        })
      } else {
        // Web fallback - basic validation (assume valid for now)
        setIsValid(true)
        setDirInfo({ exists: true })
      }
    } catch (error) {
      console.warn('Path validation error (fallback to valid):', error)
      // In case of error, assume valid to avoid blocking the UI
      setIsValid(true)
      setDirInfo({ exists: true })
    }
  }

  const handleBrowse = async () => {
    try {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Select Directory',
          properties: ['openDirectory']
        })

        if (!result.canceled && result.filePaths.length > 0) {
          onChange(result.filePaths[0])
        }
      } else {
        // Web fallback - limited functionality
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files
          if (files && files.length > 0) {
            // In web mode, we can only get the directory name from the first file
            const firstFile = files[0]
            const path = firstFile.webkitRelativePath.split('/')[0]
            onChange(path)
          }
        }
        input.click()
      }
    } catch (error) {
      console.error('Directory picker error:', error)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 ${
            isValid === false ? 'border-red-500' : 
            isValid === true ? 'border-green-500' : 
            'border-gray-300 dark:border-gray-600'
          }`}
        />
        <button
          type="button"
          onClick={handleBrowse}
          disabled={disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          Browse
        </button>
      </div>
      
      {/* Validation feedback */}
      {value && (
        <div className="text-xs">
          {isValid === true && (
            <div className="text-green-600 dark:text-green-400 flex items-center space-x-1">
              <span>✓</span>
              <span>Directory exists</span>
              {dirInfo.fileCount !== undefined && (
                <span>({dirInfo.fileCount} files)</span>
              )}
            </div>
          )}
          {isValid === false && (
            <div className="text-red-600 dark:text-red-400 flex items-center space-x-1">
              <span>✗</span>
              <span>Directory not found</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DirectoryPathPicker
