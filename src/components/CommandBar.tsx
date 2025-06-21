import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'

function CommandBar() {
  const [command, setCommand] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { projects, activeProjectId, sendCommand, commandHistory } = useProjectStore()
  
  // Default to active project
  useEffect(() => {
    if (activeProjectId && !selectedProjectId) {
      setSelectedProjectId(activeProjectId)
    }
  }, [activeProjectId, selectedProjectId])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!command.trim() || !selectedProjectId) return
    
    const project = projects.find(p => p.id === selectedProjectId)
    if (!project) return
    
    await sendCommand(selectedProjectId, command)
    setCommand('')
  }
  
  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProjectId(e.target.value)
  }
  
  // Get recent commands for autocomplete
  const recentCommands = commandHistory
    .filter(cmd => cmd.projectId === selectedProjectId)
    .map(cmd => cmd.command)
    .filter((cmd, index, self) => self.indexOf(cmd) === index) // Remove duplicates
    .slice(0, 5)
  
  return (
    <div className="px-6 pb-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <select
          value={selectedProjectId || ''}
          onChange={handleProjectSelect}
          className="px-3 py-2 bg-claude-surface border border-claude-border rounded text-gray-100 focus:outline-none focus:border-claude-primary"
        >
          <option value="" disabled>Select project</option>
          {projects.map((project, index) => (
            <option key={project.id} value={project.id}>
              {index + 1}. {project.name}
            </option>
          ))}
        </select>
        
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter command..."
            data-command-input
            className="w-full px-4 py-2 bg-claude-surface border border-claude-border rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-claude-primary"
            list="recent-commands"
          />
          <datalist id="recent-commands">
            {recentCommands.map((cmd, index) => (
              <option key={index} value={cmd} />
            ))}
          </datalist>
        </div>
        
        <button
          type="submit"
          disabled={!command.trim() || !selectedProjectId}
          className="px-6 py-2 bg-claude-primary text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
      
      <div className="mt-2 text-xs text-gray-500">
        Press Cmd+K to focus • Cmd+1-9 to switch projects
      </div>
    </div>
  )
}

export default CommandBar