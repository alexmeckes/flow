import React, { useState, useEffect } from 'react';
import { Project, ProgressState } from '../types';
import { useProjectStore } from '../stores/projectStore';
import { ClaudeTerminal } from './ClaudeTerminal';
import { ProgressIndicator } from './ProgressIndicator';

interface ProjectCardProps {
  project: Project;
  index: number;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, index }) => {
  const [showOutput, setShowOutput] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCursorOpen, setIsCursorOpen] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | undefined>(project.progressState);
  const { setActiveProject, removeProject } = useProjectStore();
  
  // Check if Cursor is open periodically
  useEffect(() => {
    const checkCursorStatus = async () => {
      const isOpen = await window.electronAPI.checkCursorOpen(project.path);
      setIsCursorOpen(isOpen);
    };
    
    // Check immediately
    checkCursorStatus();
    
    // Check every 3 seconds
    const interval = setInterval(checkCursorStatus, 3000);
    
    return () => clearInterval(interval);
  }, [project.path]);
  
  // Listen for progress updates
  useEffect(() => {
    const handleProgress = (projectId: string, newProgressState: ProgressState) => {
      if (projectId === project.id) {
        setProgressState(newProgressState);
      }
    };
    
    window.electronAPI.onProcessProgress(handleProgress);
    
    // Note: We can't remove the listener here because the API doesn't support it
    // This is fine as the listener will just ignore updates for other projects
  }, [project.id]);
  
  const handleOpenInCursor = async () => {
    try {
      await window.electronAPI.openInCursor(project.path);
      // Check status immediately after opening
      setTimeout(async () => {
        const isOpen = await window.electronAPI.checkCursorOpen(project.path);
        setIsCursorOpen(isOpen);
      }, 1000);
    } catch (error) {
      console.error('Failed to open in Cursor:', error);
    }
  };
  
  const handleStart = async () => {
    try {
      await window.electronAPI.startClaudeCode(project.id);
    } catch (error) {
      console.error('Failed to start Claude Code:', error);
    }
  };
  
  const handleStop = async () => {
    try {
      await window.electronAPI.stopClaudeCode(project.id);
    } catch (error) {
      console.error('Failed to stop Claude Code:', error);
    }
  };
  
  const handleRemove = async () => {
    if (confirm(`Remove project "${project.name}"?`)) {
      try {
        // Clean up terminal instance if it exists
        const terminalInstances = (window as any).__terminalInstances;
        if (terminalInstances && terminalInstances.has(project.id)) {
          const instance = terminalInstances.get(project.id);
          instance.terminal.dispose();
          terminalInstances.delete(project.id);
        }
        
        await window.electronAPI.removeProject(project.id);
        removeProject(project.id);
      } catch (error) {
        console.error('Failed to remove project:', error);
      }
    }
  };
  
  // Quick action buttons for common responses
  const handleQuickResponse = async (response: string) => {
    try {
      await window.electronAPI.sendCommand(project.id, response);
    } catch (error) {
      console.error('Failed to send quick response:', error);
    }
  };
  
  const getStatusColor = () => {
    switch (project.status) {
      case 'active': return 'text-claude-success';
      case 'error': return 'text-claude-error';
      default: return 'text-gray-500';
    }
  };
  
  const getStatusIcon = () => {
    switch (project.status) {
      case 'active': return '●';
      case 'error': return '⚠️';
      default: return '○';
    }
  };
  
  return (
    <div 
      className="bg-claude-surface border border-claude-border rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer"
      onClick={() => setActiveProject(project.id)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{index + 1}️⃣</span>
          <h3 className="text-lg font-semibold">{project.name}</h3>
          <span className={`${getStatusColor()}`}>{getStatusIcon()}</span>
          <span className="text-sm text-gray-500 capitalize">[{project.status}]</span>
          {isCursorOpen && (
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
              Cursor
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemove();
          }}
          className="text-gray-500 hover:text-red-500"
        >
          ✕
        </button>
      </div>
      
      <div className="text-sm text-gray-400 mb-2">{project.path}</div>
      
      {project.lastCommand && (
        <div className="text-sm mb-2">
          <span className="text-gray-500">Last command:</span> {project.lastCommand}
        </div>
      )}
      
      <ProgressIndicator progressState={progressState} />
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenInCursor();
          }}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            isCursorOpen 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-claude-border hover:bg-gray-600'
          }`}
        >
          {isCursorOpen ? '✓ Cursor Open' : 'Open in Cursor'}
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowOutput(!showOutput);
            if (!showOutput) {
              setIsMinimized(false);
            }
          }}
          className="px-3 py-1 text-sm bg-claude-border rounded hover:bg-gray-600"
        >
          {showOutput ? 'Hide' : 'View'} Terminal
        </button>
        
        {project.status === 'idle' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            className="px-3 py-1 text-sm bg-claude-success text-white rounded hover:bg-green-600"
          >
            Start
          </button>
        ) : project.status === 'active' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStop();
            }}
            className="px-3 py-1 text-sm bg-claude-warning text-white rounded hover:bg-orange-600"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            className="px-3 py-1 text-sm bg-claude-error text-white rounded hover:bg-red-600"
          >
            Restart
          </button>
        )}
      </div>
      
      {showOutput && (
        <>
          {/* Quick response buttons if we see a prompt */}
          {project.output.some(line => line.includes('Yes, proceed')) && (
            <div className="mt-3 mb-2 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickResponse('1');
                }}
                className="px-3 py-1 text-sm bg-claude-primary text-white rounded hover:bg-blue-600"
              >
                Send "1" (Yes)
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickResponse('2');
                }}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Send "2" (No)
              </button>
            </div>
          )}
          
          <div style={{ display: isMinimized ? 'none' : 'block' }}>
            <ClaudeTerminal 
              project={project} 
              onClose={() => setShowOutput(false)}
              onMinimize={() => setIsMinimized(true)}
            />
          </div>
          {isMinimized && (
            <div className="mt-3 border border-claude-border rounded-lg overflow-hidden">
              <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
                <span className="text-gray-400 text-sm">
                  {project.name} - Terminal (Minimized)
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(false);
                  }}
                  className="text-gray-400 hover:text-white px-2"
                  title="Restore"
                >
                  ⬜
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};