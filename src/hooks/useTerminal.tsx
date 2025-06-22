import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Project } from '../types';

// Global terminal instances to persist across component unmounts
const terminalInstances = new Map<string, { terminal: Terminal; fitAddon: FitAddon }>();

// Expose for cleanup
if (typeof window !== 'undefined') {
  (window as any).__terminalInstances = terminalInstances;
}

export const useTerminal = (project: Project, fontSize: number) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // Check if we already have a terminal for this project
    let instance = terminalInstances.get(project.id);
    
    if (!instance) {
      // Create new terminal instance
      console.log(`Creating new terminal for project ${project.id}`);
      const term = new Terminal({
        cursorBlink: true,
        fontSize,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selection: '#4d4d4d',
        },
        convertEol: true,
        scrollback: 10000, // Increase scrollback buffer
      });
      
      const fit = new FitAddon();
      term.loadAddon(fit);
      
      // Handle user input - send it to Claude
      term.onData((data) => {
        window.electronAPI.sendCommand(project.id, data);
      });
      
      instance = { terminal: term, fitAddon: fit };
      terminalInstances.set(project.id, instance);
      
      // Write all existing output to the new terminal
      if (project.output.length > 0) {
        console.log(`Writing ${project.output.length} existing outputs to new terminal`);
        for (const output of project.output) {
          term.write(output);
        }
      }
    } else {
      // Reusing existing terminal
      console.log(`Reusing existing terminal for project ${project.id}`);
      // Update font size if it changed
      instance.terminal.options.fontSize = fontSize;
    }
    
    // Attach to DOM
    instance.terminal.open(terminalRef.current);
    
    // Force a fit after a small delay to ensure proper sizing
    setTimeout(() => {
      instance.fitAddon.fit();
      // Scroll to bottom to show latest output
      instance.terminal.scrollToBottom();
    }, 0);
    
    setTerminal(instance.terminal);
    setFitAddon(instance.fitAddon);
    
    // Handle window resize
    const handleResize = () => instance!.fitAddon.fit();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      // Don't dispose - just detach from DOM
      if (terminalRef.current && terminalRef.current.querySelector('.xterm')) {
        terminalRef.current.innerHTML = '';
      }
    };
  }, [project.id, fontSize]);
  
  // Update terminal when project output changes
  useEffect(() => {
    const instance = terminalInstances.get(project.id);
    if (!instance || !project.output.length) return;
    
    // Get the last output entry
    const lastOutput = project.output[project.output.length - 1];
    
    // Write raw output to terminal
    instance.terminal.write(lastOutput);
    
    // Ensure we're scrolled to the bottom to see new output
    instance.terminal.scrollToBottom();
  }, [project.id, project.output]);
  
  // Clear terminal when output is cleared
  useEffect(() => {
    const instance = terminalInstances.get(project.id);
    if (instance && project.output.length === 0) {
      instance.terminal.clear();
    }
  }, [project.id, project.output.length]);
  
  const clearTerminal = async () => {
    const instance = terminalInstances.get(project.id);
    if (instance) {
      instance.terminal.clear();
      await window.electronAPI.clearProjectOutput(project.id);
    }
  };
  
  const disposeTerminal = () => {
    const instance = terminalInstances.get(project.id);
    if (instance) {
      instance.terminal.dispose();
      terminalInstances.delete(project.id);
    }
  };
  
  return {
    terminalRef,
    terminal,
    fitAddon,
    clearTerminal,
    disposeTerminal
  };
};