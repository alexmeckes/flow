import React, { useEffect, useState } from 'react';
import { CommandBar } from './CommandBar';
import { ProjectCard } from './ProjectCard';
import { useProjectStore } from '../stores/projectStore';

export const Layout: React.FC = () => {
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  
  const { 
    projects, 
    setActiveProject, 
    addProject,
    updateProjectOutput,
    updateProjectStatus 
  } = useProjectStore();
  
  // Set up IPC listeners and load state
  useEffect(() => {
    // Listen for process output
    window.electronAPI.onProcessOutput((projectId, output) => {
      updateProjectOutput(projectId, output);
    });
    
    // Listen for process status changes
    window.electronAPI.onProcessStatus((projectId, status) => {
      updateProjectStatus(projectId, status as any);
    });
    
    // Listen for output cleared events
    window.electronAPI.onProcessOutputCleared((projectId) => {
      // The store already handles this in clearProjectOutput
      console.log(`Output cleared for project ${projectId}`);
    });
    
    // Load saved state
    const loadState = async () => {
      try {
        const savedState = await window.electronAPI.loadState();
        if (savedState && savedState.projects) {
          savedState.projects.forEach((project: any) => {
            addProject({
              ...project,
              status: 'idle',
              output: [],
              createdAt: new Date(project.createdAt),
              updatedAt: new Date(project.updatedAt)
            });
          });
        }
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    };
    
    loadState();
  }, [updateProjectOutput, updateProjectStatus, addProject]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K - Focus command bar
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[type="text"]') as HTMLInputElement;
        input?.focus();
      }
      
      // Cmd+1-9 - Focus project by number
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (projects[index]) {
          setActiveProject(projects[index].id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projects, setActiveProject]);
  
  const handleAddProject = async () => {
    if (!newProjectName || !newProjectPath) return;
    
    try {
      const project = await window.electronAPI.createProject(newProjectName, newProjectPath);
      addProject(project);
      setShowAddProject(false);
      setNewProjectName('');
      setNewProjectPath('');
    } catch (error: any) {
      console.error('Failed to create project:', error);
      alert(error.message || 'Failed to create project. Please check the path and try again.');
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-claude-bg">
      <header className="px-6 py-4 border-b border-claude-border">
        <h1 className="text-2xl font-bold">Claude Code Mission Control</h1>
      </header>
      
      <CommandBar />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-4">Projects</h2>
        </div>
        
        <div className="grid gap-4">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
        
        {projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No projects yet. Click "Add Project" to get started.</p>
          </div>
        )}
      </main>
      
      <footer className="px-6 py-4 border-t border-claude-border flex justify-between items-center">
        <button
          onClick={() => setShowAddProject(true)}
          className="px-4 py-2 bg-claude-primary text-white rounded hover:bg-blue-600"
        >
          + Add Project
        </button>
        
        <div className="text-sm text-gray-500">
          Press <kbd className="px-2 py-1 bg-claude-surface rounded">⌘K</kbd> to focus command bar
        </div>
      </footer>
      
      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-claude-surface rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Project</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-claude-bg text-gray-100 px-3 py-2 rounded border border-claude-border focus:border-claude-primary focus:outline-none"
                placeholder="My Project"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Project Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  className="flex-1 bg-claude-bg text-gray-100 px-3 py-2 rounded border border-claude-border focus:border-claude-primary focus:outline-none"
                  placeholder="/path/to/project"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const path = await window.electronAPI.selectDirectory();
                    if (path) {
                      setNewProjectPath(path);
                      // Auto-fill project name from directory name if empty
                      if (!newProjectName) {
                        const name = path.split('/').pop() || path.split('\\').pop() || '';
                        setNewProjectName(name);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-claude-border rounded hover:bg-gray-600"
                >
                  Browse
                </button>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddProject(false);
                  setNewProjectName('');
                  setNewProjectPath('');
                }}
                className="px-4 py-2 bg-claude-border rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                className="px-4 py-2 bg-claude-primary text-white rounded hover:bg-blue-600"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};