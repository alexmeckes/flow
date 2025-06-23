import React, { useState, useEffect } from 'react';
import { ClaudeSession, ProgressState } from '../types';
import { useProjectStore } from '../stores/projectStore';
import { ClaudeTerminal } from './ClaudeTerminal';
import { ProgressIndicator } from './ProgressIndicator';

interface SessionCardProps {
  session: ClaudeSession;
  projectPath: string;
  index: number;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session, projectPath, index }) => {
  const [showOutput, setShowOutput] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasTerminal, setHasTerminal] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | undefined>(session.progressState);
  
  const { activeSessionId, setActiveSession, removeSession } = useProjectStore();
  
  // Check if terminal exists
  useEffect(() => {
    // Check if terminal already exists for this session
    const terminalInstances = (window as any).__terminalInstances;
    if (terminalInstances && terminalInstances.has(session.id)) {
      setHasTerminal(true);
    }
  }, [session.id]);
  
  // Set hasTerminal when output is shown
  useEffect(() => {
    if (showOutput && !hasTerminal) {
      setHasTerminal(true);
    }
  }, [showOutput, hasTerminal]);
  
  // Listen for progress updates
  useEffect(() => {
    const handleProgress = (sessionId: string, projectId: string, newProgressState: ProgressState) => {
      if (sessionId === session.id) {
        setProgressState(newProgressState);
      }
    };
    
    const cleanup = window.electronAPI.onSessionProgress(handleProgress);
    
    // Clean up the listener when component unmounts
    return cleanup;
  }, [session.id]);
  
  const handleStart = async () => {
    try {
      await window.electronAPI.startClaudeSession(session.id);
    } catch (error) {
      console.error('Failed to start Claude session:', error);
    }
  };
  
  const handleStop = async () => {
    try {
      await window.electronAPI.stopClaudeSession(session.id);
    } catch (error) {
      console.error('Failed to stop Claude session:', error);
    }
  };
  
  const handleRemove = async () => {
    if (confirm(`Remove session "${session.name}"?`)) {
      try {
        // Clean up terminal instance if it exists
        const terminalInstances = (window as any).__terminalInstances;
        if (terminalInstances && terminalInstances.has(session.id)) {
          const instance = terminalInstances.get(session.id);
          instance.terminal.dispose();
          terminalInstances.delete(session.id);
        }
        
        await window.electronAPI.removeSession(session.id);
        
        // Clear active session if this was the active one
        if (activeSessionId === session.id) {
          setActiveSession(undefined);
        }
      } catch (error) {
        console.error('Failed to remove session:', error);
      }
    }
  };
  
  const getStatusColor = () => {
    switch (session.status) {
      case 'active': return 'text-claude-success';
      case 'error': return 'text-claude-error';
      default: return 'text-gray-500';
    }
  };
  
  const getStatusIcon = () => {
    switch (session.status) {
      case 'active': return '●';
      case 'error': return '⚠️';
      default: return '○';
    }
  };
  
  const isActive = activeSessionId === session.id;
  
  return (
    <div 
      className={`bg-claude-bg border rounded-lg p-4 transition-colors cursor-pointer ${
        isActive 
          ? 'border-claude-primary ring-2 ring-claude-primary ring-opacity-50' 
          : 'border-claude-border hover:border-gray-600'
      }`}
      onClick={() => setActiveSession(session.id)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{index + 1}️⃣</span>
          <h4 className="text-md font-semibold">{session.name}</h4>
          {isActive && <span className="text-xs bg-claude-primary text-white px-2 py-0.5 rounded">ACTIVE</span>}
          <span className={`${getStatusColor()}`}>{getStatusIcon()}</span>
          <span className="text-sm text-gray-500 capitalize">[{session.status}]</span>
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
      
      {session.description && (
        <div className="text-sm text-gray-400 mb-2">{session.description}</div>
      )}
      
      <ProgressIndicator progressState={progressState} />
      
      <div className="flex gap-2 mt-3">
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
        
        {session.status === 'idle' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
            className="px-3 py-1 text-sm bg-claude-success text-white rounded hover:bg-green-600"
          >
            Start
          </button>
        ) : session.status === 'active' ? (
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
      
      {/* Terminal container - always rendered once opened, just hidden when not showing */}
      {hasTerminal && (
        <div style={{ display: showOutput && !isMinimized ? 'block' : 'none' }}>
          <ClaudeTerminal 
            session={session}
            projectPath={projectPath}
            onClose={() => setShowOutput(false)}
            onMinimize={() => setIsMinimized(true)}
          />
        </div>
      )}
      
      {/* Show minimized bar when terminal is minimized */}
      {showOutput && isMinimized && (
        <div className="mt-3 border border-claude-border rounded-lg overflow-hidden">
          <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
            <span className="text-gray-400 text-sm">
              {session.name} - Terminal (Minimized)
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
    </div>
  );
};