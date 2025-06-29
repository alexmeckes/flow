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
    addSession,
    removeSession,
    updateSessionOutput,
    updateSessionStatus,
    updateCursorStatus
  } = useProjectStore();
  
  // Set up IPC listeners - no dependencies to ensure they're only set up once
  useEffect(() => {
    console.log('Setting up IPC listeners');
    
    // Get stable references to store methods
    const store = useProjectStore.getState();
    
    // Listen for session output
    const removeOutputListener = window.electronAPI.onSessionOutput((sessionId, projectId, output) => {
      console.log(`Received output for session ${sessionId}: ${output.substring(0, 50)}...`);
      store.updateSessionOutput(projectId, sessionId, output);
    });
    
    // Listen for session status changes
    const removeStatusListener = window.electronAPI.onSessionStatus((sessionId, projectId, status) => {
      console.log(`Received status for session ${sessionId}: ${status}`);
      store.updateSessionStatus(projectId, sessionId, status as any);
    });
    
    // Listen for output cleared events
    const removeClearedListener = window.electronAPI.onSessionOutputCleared((sessionId, projectId) => {
      console.log(`Output cleared for session ${sessionId}`);
    });
    
    // Listen for session created events
    const removeCreatedListener = window.electronAPI.onSessionCreated((projectId, session) => {
      console.log(`Session created for project ${projectId}:`, session);
      store.addSession(projectId, session);
    });
    
    // Listen for session removed events
    const removeRemovedListener = window.electronAPI.onSessionRemoved((projectId, sessionId) => {
      console.log(`Session ${sessionId} removed from project ${projectId}`);
      store.removeSession(projectId, sessionId);
    });
    
    // Cleanup listeners on unmount
    return () => {
      console.log('Cleaning up IPC listeners');
      if (removeOutputListener) removeOutputListener();
      if (removeStatusListener) removeStatusListener();
      if (removeClearedListener) removeClearedListener();
      if (removeCreatedListener) removeCreatedListener();
      if (removeRemovedListener) removeRemovedListener();
    };
  }, []); // Empty dependency array - only run once
  
  // Load saved state - separate effect to run only once
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await window.electronAPI.loadState();
        if (savedState && savedState.projects) {
          console.log(`Loading ${savedState.projects.length} saved projects`);
          savedState.projects.forEach((project: any) => {
            addProject({
              ...project,
              sessions: project.sessions?.map((session: any) => ({
                ...session,
                status: 'idle',
                output: session.output || [],
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt)
              })) || [],
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
  }, []); // Only run once on mount
  
  // Centralized Cursor status checking - single interval for all projects
  useEffect(() => {
    const checkAllCursorStatuses = async () => {
      // Get unique project paths
      const uniquePaths = new Set(projects.map(p => p.path));
      
      // Check each path
      for (const path of uniquePaths) {
        try {
          const isOpen = await window.electronAPI.checkCursorOpen(path);
          updateCursorStatus(path, isOpen);
        } catch (error) {
          console.error(`Error checking cursor status for ${path}:`, error);
          updateCursorStatus(path, false);
        }
      }
    };
    
    // Check immediately
    checkAllCursorStatuses();
    
    // Check every 3 seconds
    const interval = setInterval(checkAllCursorStatuses, 3000);
    
    return () => clearInterval(interval);
  }, [projects, updateCursorStatus]); // Re-run when projects change
  
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddProject(true)}
            className="px-4 py-2 bg-claude-primary text-white rounded hover:bg-blue-600"
          >
            + Add Project
          </button>
          
          {projects.length > 0 && (
            <button
              onClick={async () => {
                console.log('Arrange Windows button clicked');
                try {
                  const button = event.currentTarget as HTMLButtonElement;
                  button.disabled = true;
                  button.textContent = '⊞ Arranging...';
                  
                  const success = await window.electronAPI.arrangeCursorWindows();
                  console.log('arrangeCursorWindows result:', success);
                  
                  if (success) {
                    button.textContent = '✓ Arranged!';
                    console.log('Windows arranged successfully');
                    setTimeout(() => {
                      button.textContent = '⊞ Arrange Windows';
                      button.disabled = false;
                    }, 2000);
                  } else {
                    button.textContent = '⚠️ Permission Required';
                    console.log('Failed to arrange windows - may need accessibility permissions');
                    alert('To arrange windows, please grant accessibility permissions:\n\n1. Open System Settings\n2. Go to Privacy & Security > Accessibility\n3. Add and enable this app');
                    setTimeout(() => {
                      button.textContent = '⊞ Arrange Windows';
                      button.disabled = false;
                    }, 3000);
                  }
                } catch (error) {
                  console.error('Error arranging windows:', error);
                  const button = event.currentTarget as HTMLButtonElement;
                  button.textContent = '❌ Error';
                  setTimeout(() => {
                    button.textContent = '⊞ Arrange Windows';
                    button.disabled = false;
                  }, 2000);
                }
              }}
              className="px-4 py-2 bg-claude-border text-white rounded hover:bg-gray-600 disabled:opacity-50"
              title="Arrange all Cursor windows in a grid"
            >
              ⊞ Arrange Windows
            </button>
          )}
        </div>
        
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