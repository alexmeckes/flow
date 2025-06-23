import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { v4 as uuidv4 } from 'uuid';

export const CommandBar: React.FC = () => {
  const [command, setCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    projects, 
    activeProjectId,
    activeSessionId, 
    commandHistory,
    addCommand,
    addToCommandHistory 
  } = useProjectStore();
  
  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeSession = activeProject?.sessions.find(s => s.id === activeSessionId);
  
  // Get all available sessions for autocomplete
  const getAllSessions = () => {
    const sessions: { session: any; project: any; display: string }[] = [];
    projects.forEach(project => {
      project.sessions.forEach(session => {
        sessions.push({
          session,
          project,
          display: `@${session.name} (${project.name})`
        });
      });
    });
    return sessions;
  };
  
  // Get filtered suggestions based on input
  const getSuggestions = () => {
    if (!command.startsWith('@')) return [];
    
    const searchTerm = command.slice(1).toLowerCase();
    const allSessions = getAllSessions();
    
    return allSessions.filter(item => 
      item.session.name.toLowerCase().includes(searchTerm) ||
      item.project.name.toLowerCase().includes(searchTerm)
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    // Hide suggestions when submitting
    setShowSuggestions(false);
    
    // Parse command for @ mentions - now supports @project:session or @session
    const commandParts = command.match(/^@([\w:]+)\s+(.+)$/);
    let targetSessionId = activeSessionId;
    let actualCommand = command;
    
    if (commandParts) {
      const ref = commandParts[1];
      actualCommand = commandParts[2];
      
      // Check if it's project:session format
      if (ref.includes(':')) {
        const [projectPart, sessionPart] = ref.split(':');
        const project = projects.find(p => 
          p.name.toLowerCase().startsWith(projectPart.toLowerCase())
        );
        if (project) {
          const session = project.sessions.find(s => 
            s.name.toLowerCase().startsWith(sessionPart.toLowerCase())
          );
          if (session) {
            targetSessionId = session.id;
          }
        }
      } else {
        // Try to find session by name across all projects
        for (const project of projects) {
          const session = project.sessions.find(s => 
            s.name.toLowerCase().startsWith(ref.toLowerCase())
          );
          if (session) {
            targetSessionId = session.id;
            break;
          }
        }
      }
    }
    
    if (!targetSessionId) {
      console.error('No session selected. Active session:', activeSessionId, 'Target session:', targetSessionId);
      // If no active session but we have a project with sessions, auto-select the first one
      if (activeProject && activeProject.sessions.length > 0) {
        targetSessionId = activeProject.sessions[0].id;
        console.log('Auto-selecting first session:', targetSessionId);
      } else {
        alert('Please select a session first or create one');
        return;
      }
    }
    
    try {
      console.log('Sending command to session:', targetSessionId, 'Command:', actualCommand);
      
      // Send each character of the command individually, like typing
      for (const char of actualCommand) {
        await window.electronAPI.sendSessionCommand(targetSessionId, char);
      }
      
      // Small delay to ensure the command is fully typed before Enter
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Then send Enter
      console.log('Sending Enter key to session:', targetSessionId);
      await window.electronAPI.sendSessionCommand(targetSessionId, '\r');
      
      // Add to history
      addCommand({
        id: uuidv4(),
        projectId: activeProjectId || '',
        sessionId: targetSessionId,
        command: actualCommand,
        timestamp: new Date()
      });
      
      addToCommandHistory(command);
      setCommand('');
      setHistoryIndex(-1);
    } catch (error) {
      console.error('Failed to send command:', error);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const suggestions = getSuggestions();
    
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (e.key === 'Tab') e.preventDefault();
        if (e.key === 'Enter' && suggestions.length > 0) {
          e.preventDefault(); // Prevent form submission when selecting suggestion
        }
        const selected = suggestions[selectedSuggestionIndex];
        if (selected) {
          const parts = command.split(' ');
          parts[0] = `@${selected.session.name}`;
          setCommand(parts.join(' ') + ' ');
          setShowSuggestions(false);
          return;
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    
    // Regular history navigation when no suggestions
    if (!showSuggestions) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setCommand('');
        }
      }
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommand(value);
    setHistoryIndex(-1);
    
    // Show suggestions when typing @
    if (value.includes('@')) {
      setShowSuggestions(true);
      setSelectedSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };
  
  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  const suggestions = getSuggestions();
  
  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-claude-border relative">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">
          {activeSession 
            ? `@${activeProject?.name}:${activeSession.name}` 
            : activeProject 
              ? `@${activeProject.name} (no session)` 
              : 'No project selected'}
        </span>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter command... (use @session or @project:session to target specific session)"
            className="w-full bg-claude-surface text-gray-100 px-3 py-2 rounded border border-claude-border focus:border-claude-primary focus:outline-none"
          />
          
          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-claude-surface border border-claude-border rounded shadow-lg z-50 max-h-60 overflow-y-auto">
              {suggestions.map((item, index) => (
                <div
                  key={`${item.project.id}-${item.session.id}`}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    index === selectedSuggestionIndex
                      ? 'bg-claude-border text-white'
                      : 'hover:bg-claude-bg'
                  }`}
                  onClick={() => {
                    const parts = command.split(' ');
                    parts[0] = `@${item.session.name}`;
                    setCommand(parts.join(' ') + ' ');
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                >
                  <div className="font-medium">{item.display}</div>
                  {item.session.description && (
                    <div className="text-sm text-gray-400">{item.session.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-claude-primary text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-claude-primary"
        >
          Send
        </button>
      </div>
    </form>
  );
};