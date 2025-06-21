import { useEffect } from 'react'
import { useProjectStore } from './stores/projectStore'
import Layout from './components/Layout'
import CommandBar from './components/CommandBar'
import ProjectCard from './components/ProjectCard'

function App() {
  const { projects, activeProjectId, loadState } = useProjectStore()

  useEffect(() => {
    // Load saved state on mount
    loadState()
  }, [loadState])

  return (
    <Layout>
      <div className="flex flex-col h-screen bg-claude-bg">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-claude-border">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-100">Claude Code Mission Control</h1>
          </div>
          <CommandBar />
        </div>

        {/* Projects Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg mb-2">No projects yet</p>
              <p className="text-sm">Click "Add Project" to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index + 1}
                  isActive={project.id === activeProjectId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-claude-border px-6 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                // TODO: Implement project add dialog
                const name = prompt('Project name:')
                const path = prompt('Project path:')
                if (name && path) {
                  useProjectStore.getState().addProject(name, path)
                }
              }}
              className="px-4 py-2 bg-claude-primary text-white rounded hover:bg-blue-600 transition-colors"
            >
              + Add Project
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-200 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default App