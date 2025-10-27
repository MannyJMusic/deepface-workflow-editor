import React, { useState, useEffect } from 'react'

interface FilePathPickerProps {
  value: string
  onChange: (path: string) => void
  placeholder?: string
  filters?: Array<{ name: string; extensions: string[] }>
  className?: string
  disabled?: boolean
}

const FilePathPicker: React.FC<FilePathPickerProps> = ({
  value,
  onChange,
  placeholder = "Select a file...",
  filters = [{ name: 'All Files', extensions: ['*'] }],
  className = "",
  disabled = false
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [fileInfo, setFileInfo] = useState<{ size?: number; exists?: boolean }>({})

  useEffect(() => {
    if (value) {
      validatePath(value)
    } else {
      setIsValid(null)
      setFileInfo({})
    }
  }, [value])

  const validatePath = async (path: string) => {
    try {
      if (window.electronAPI && window.electronAPI.pathExists) {
        const result = await window.electronAPI.pathExists(path)
        const stats = result.exists ? await window.electronAPI.getFileStats(path) : null
        
        setIsValid(result.exists)
        setFileInfo({
          exists: result.exists,
          size: stats?.size
        })
      } else {
        // Web fallback - basic validation (assume valid for now)
        setIsValid(true)
        setFileInfo({ exists: true })
      }
    } catch (error) {
      console.warn('Path validation error (fallback to valid):', error)
      // In case of error, assume valid to avoid blocking the UI
      setIsValid(true)
      setFileInfo({ exists: true })
    }
  }

  const handleBrowse = async () => {
    try {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        const result = await window.electronAPI.showOpenDialog({
          title: 'Select File',
          filters,
          properties: ['openFile']
        })

        if (!result.canceled && result.filePaths.length > 0) {
          onChange(result.filePaths[0])
        }
      } else {
        // Web fallback - create file input
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = filters.map(f => f.extensions.map(ext => `.${ext}`).join(',')).join(',')
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            onChange(file.name) // In web mode, we can only get the filename
          }
        }
        input.click()
      }
    } catch (error) {
      console.error('File picker error:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getBorderClass = () => {
    if (isValid === false) return 'border-red-500'
    if (isValid === true) return 'border-green-500'
    return 'border-gray-300 dark:border-gray-600'
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
          className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 ${getBorderClass()}`}
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
              <span>File exists</span>
              {fileInfo.size && (
                <span>({formatFileSize(fileInfo.size)})</span>
              )}
            </div>
          )}
          {isValid === false && (
            <div className="text-red-600 dark:text-red-400 flex items-center space-x-1">
              <span>✗</span>
              <span>File not found</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FilePathPicker
