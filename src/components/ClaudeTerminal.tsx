import React, { useState } from 'react';
import { Project } from '../types';
import { useTerminal } from '../hooks/useTerminal';
import '@xterm/xterm/css/xterm.css';

interface ClaudeTerminalProps {
  project: Project;
  onClose?: () => void;
  onMinimize?: () => void;
}

export const ClaudeTerminal: React.FC<ClaudeTerminalProps> = ({ project, onClose, onMinimize }) => {
  const [fontSize, setFontSize] = useState(14);
  const { terminalRef, clearTerminal } = useTerminal(project, fontSize);
  
  return (
    <div className="mt-3 border border-claude-border rounded-lg overflow-hidden">
      {/* Terminal Header */}
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-gray-400 text-sm font-mono">
            {project.name} - Claude Terminal
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Font Size Controls */}
          <button
            onClick={() => {
              setFontSize(Math.max(10, fontSize - 2));
            }}
            className="text-gray-400 hover:text-white px-2"
            title="Decrease font size"
          >
            A-
          </button>
          <span className="text-gray-400 text-xs">{fontSize}px</span>
          <button
            onClick={() => {
              setFontSize(Math.min(24, fontSize + 2));
            }}
            className="text-gray-400 hover:text-white px-2"
            title="Increase font size"
          >
            A+
          </button>
          
          <div className="w-px h-4 bg-gray-600"></div>
          
          {/* Action Buttons */}
          <button
            onClick={clearTerminal}
            className="text-gray-400 hover:text-white px-2"
            title="Clear terminal"
          >
            Clear
          </button>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="text-gray-400 hover:text-white px-2"
              title="Minimize"
            >
              _
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white px-2"
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      {/* Terminal Container */}
      <div 
        ref={terminalRef}
        className="bg-black"
        style={{ height: '500px' }}
      />
      
      {/* Status Bar */}
      <div className="bg-gray-900 px-4 py-1 text-xs text-gray-400 border-t border-gray-700">
        <div className="flex justify-between">
          <span>Status: {project.status}</span>
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};