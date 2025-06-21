import { useState } from 'react'
import { Project } from '../types'
import { useProjectStore } from '../stores/projectStore'

interface ProjectCardProps {
  project: Project
  index: number
  isActive: boolean
}

function ProjectCard({ project, index, isActive }: ProjectCardProps) {
  const [showOutput, setShowOutput] = useState(false)
  const { removeProject, setActiveProject } = useProjectStore()
  
  const statusColors = {
    active: 'text-claude-success',
    idle: 'text-gray-400',
    error: 'text-claude-error',
  }
  
  const statusIcons = {
    active: '🟢',
    idle: '⚪',
    error: '🔴',
  }
  
  const handleOpenInCursor = async () => {
    try {
      await window.electronAPI.openInCursor(project.path)
    } catch (error) {
      console.error('Failed to open in Cursor:', error)
    }
  }
  
  const handleRemove = () => {
    if (confirm(`Remove project "${project.name}"?`)) {
      removeProject(project.id)
    }
  }
  
  return (
    <div
      className={`bg-claude-surface border rounded-lg p-4 transition-all ${
        isActive ? 'border-claude-primary ring-2 ring-claude-primary ring-opacity-50' : 'border-claude-border'
      }`}
      onClick={() => setActiveProject(project.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{index}️⃣</span>
          <h3 className="text-lg font-semibold text-gray-100">{project.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${statusColors[project.status]} text-sm font-medium`}>
            {statusIcons[project.status]} {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
      </div>
      
      {/* Path */}
      <p className="text-sm text-gray-400 mb-3 font-mono truncate">{project.path}</p>
      
      {/* Progress bar */}
      {project.status === 'active' && project.progress !== undefined && (
        <div className="mb-3">
          <div className="w-full bg-claude-border rounded-full h-2">
            <div
              className="bg-claude-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Last command */}
      {project.lastCommand && (
        <div className="mb-3">
          <p className="text-sm text-gray-500">Last command:</p>
          <p className="text-sm text-gray-300 font-mono truncate">&gt; {project.lastCommand}</p>
        </div>
      )}
      
      {/* Current status/output */}
      {project.currentOutput && (
        <div className="mb-3">
          <p className="text-sm text-gray-500">Status:</p>
          <p className="text-sm text-gray-300 truncate">{project.currentOutput}</p>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleOpenInCursor()
          }}
          className="flex-1 px-3 py-1 text-sm bg-claude-border text-gray-200 rounded hover:bg-gray-600 transition-colors"
        >
          Open in Cursor
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowOutput(!showOutput)
          }}
          className="flex-1 px-3 py-1 text-sm bg-claude-border text-gray-200 rounded hover:bg-gray-600 transition-colors"
        >
          {showOutput ? 'Hide' : 'View'} Output
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleRemove()
          }}
          className="px-3 py-1 text-sm bg-claude-error text-white rounded hover:bg-red-600 transition-colors"
        >
          ✕
        </button>
      </div>
      
      {/* Output panel */}
      {showOutput && (
        <div className="mt-4 p-3 bg-claude-bg rounded border border-claude-border">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-400">Output Log</p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                // TODO: Implement clear output
              }}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <pre className="text-xs text-gray-300 font-mono overflow-auto max-h-48">
            {project.currentOutput || 'No output yet...'}
          </pre>
        </div>
      )}
    </div>
  )
}

export default ProjectCard