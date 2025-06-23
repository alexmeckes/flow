import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { useProjectStore } from '../stores/projectStore';
import { SessionCard } from './SessionCard';

interface ProjectCardProps {
  project: Project;
  index: number;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, index }) => {
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDescription, setNewSessionDescription] = useState('');
  const { activeProjectId, activeSessionId, setActiveProject, setActiveSession, removeProject, getCursorStatus } = useProjectStore();
  
  // Get cursor status from centralized store
  const isCursorOpen = getCursorStatus(project.path);
  
  const handleOpenInCursor = async () => {
    try {
      await window.electronAPI.openInCursor(project.path);
      // The centralized checker will update the status
    } catch (error) {
      console.error('Failed to open in Cursor:', error);
    }
  };
  
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    
    try {
      const newSession = await window.electronAPI.createSession(project.id, newSessionName, newSessionDescription);
      setShowAddSession(false);
      setNewSessionName('');
      setNewSessionDescription('');
      
      // Auto-select the new session if it's the only one or no session is active
      if (newSession && (project.sessions.length === 0 || !activeSessionId)) {
        setActiveSession(newSession.id);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };
  
  const handleRemove = async () => {
    if (confirm(`Remove project "${project.name}"?`)) {
      try {
        // Clean up all session terminal instances
        const terminalInstances = (window as any).__terminalInstances;
        if (terminalInstances) {
          project.sessions.forEach(session => {
            if (terminalInstances.has(session.id)) {
              const instance = terminalInstances.get(session.id);
              instance.terminal.dispose();
              terminalInstances.delete(session.id);
            }
          });
        }
        
        await window.electronAPI.removeProject(project.id);
        removeProject(project.id);
      } catch (error) {
        console.error('Failed to remove project:', error);
      }
    }
  };
  
  const hasActiveSessions = project.sessions.some(s => s.status === 'active');
  const getProjectStatusText = () => {
    const activeCount = project.sessions.filter(s => s.status === 'active').length;
    if (activeCount > 0) {
      return `${activeCount} active session${activeCount > 1 ? 's' : ''}`;
    }
    return 'No active sessions';
  };
  
  return (
    <div 
      className="bg-claude-surface border border-claude-border rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer"
      onClick={() => {
        setActiveProject(project.id);
        // Auto-select first session if available and no session is currently active
        if (project.sessions.length > 0 && (!activeSessionId || !project.sessions.find(s => s.id === activeSessionId))) {
          setActiveSession(project.sessions[0].id);
        }
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{index + 1}️⃣</span>
          <h3 className="text-lg font-semibold">{project.name}</h3>
          <span className="text-sm text-gray-500">({getProjectStatusText()})</span>
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
      
      <div className="text-sm text-gray-400 mb-3">{project.path}</div>
      
      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
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
            setShowAddSession(true);
          }}
          className="px-3 py-1 text-sm bg-claude-primary text-white rounded hover:bg-blue-600"
        >
          + Add Session
        </button>
      </div>
      
      {/* Sessions */}
      <div className="space-y-3">
        {project.sessions.map((session, sessionIndex) => (
          <SessionCard 
            key={session.id} 
            session={session} 
            projectPath={project.path}
            index={sessionIndex} 
          />
        ))}
        
        {project.sessions.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No sessions yet. Click "Add Session" to start.
          </div>
        )}
      </div>
      
      {/* Add Session Modal */}
      {showAddSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-claude-surface rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Session</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Session Name</label>
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                className="w-full bg-claude-bg text-gray-100 px-3 py-2 rounded border border-claude-border focus:border-claude-primary focus:outline-none"
                placeholder="Feature Development"
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <input
                type="text"
                value={newSessionDescription}
                onChange={(e) => setNewSessionDescription(e.target.value)}
                className="w-full bg-claude-bg text-gray-100 px-3 py-2 rounded border border-claude-border focus:border-claude-primary focus:outline-none"
                placeholder="Working on user authentication feature"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddSession(false);
                  setNewSessionName('');
                  setNewSessionDescription('');
                }}
                className="px-4 py-2 bg-claude-border rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateSession();
                }}
                className="px-4 py-2 bg-claude-primary text-white rounded hover:bg-blue-600"
                disabled={!newSessionName.trim()}
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};