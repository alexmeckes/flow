import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { v4 as uuidv4 } from 'uuid';

export const CommandBar: React.FC = () => {
  const [command, setCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    projects, 
    activeProjectId, 
    commandHistory,
    addCommand,
    addToCommandHistory 
  } = useProjectStore();
  
  const activeProject = projects.find(p => p.id === activeProjectId);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    // Parse command for @ mentions
    const commandParts = command.match(/^@(\w+)\s+(.+)$/);
    let targetProjectId = activeProjectId;
    let actualCommand = command;
    
    if (commandParts) {
      // Find project by name or number
      const projectRef = commandParts[1];
      const projectIndex = parseInt(projectRef) - 1;
      
      if (!isNaN(projectIndex) && projects[projectIndex]) {
        targetProjectId = projects[projectIndex].id;
      } else {
        const project = projects.find(p => 
          p.name.toLowerCase().startsWith(projectRef.toLowerCase())
        );
        if (project) {
          targetProjectId = project.id;
        }
      }
      
      actualCommand = commandParts[2];
    }
    
    if (!targetProjectId) {
      console.error('No project selected');
      return;
    }
    
    try {
      // Send each character of the command individually, like typing
      for (const char of actualCommand) {
        await window.electronAPI.sendCommand(targetProjectId, char);
      }
      // Then send Enter
      await window.electronAPI.sendCommand(targetProjectId, '\r');
      
      // Add to history
      addCommand({
        id: uuidv4(),
        projectId: targetProjectId,
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
  };
  
  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-claude-border">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">
          {activeProject ? `@${activeProject.name}` : 'No project selected'}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command or response... (use @project to target specific project)"
          className="flex-1 bg-claude-surface text-gray-100 px-3 py-2 rounded border border-claude-border focus:border-claude-primary focus:outline-none"
        />
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