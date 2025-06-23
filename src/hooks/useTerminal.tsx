import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ClaudeSession } from '../types';

// Global terminal instances to persist across component unmounts
interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  buffer: string[]; // Store all outputs as backup
  lastWrittenIndex: number; // Track last written output index
}

const terminalInstances = new Map<string, TerminalInstance>();

// Expose for cleanup
if (typeof window !== 'undefined') {
  (window as any).__terminalInstances = terminalInstances;
}

export const useTerminal = (session: ClaudeSession, projectPath: string, fontSize: number) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // Check if we already have a terminal for this session
    let instance = terminalInstances.get(session.id);
    
    if (!instance) {
      // Create new terminal instance
      console.log(`Creating new terminal for session ${session.id}`);
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
        window.electronAPI.sendSessionCommand(session.id, data);
      });
      
      instance = { 
        terminal: term, 
        fitAddon: fit, 
        buffer: [...session.output],
        lastWrittenIndex: -1
      };
      terminalInstances.set(session.id, instance);
      
      // Write all existing output to the new terminal
      if (session.output.length > 0) {
        console.log(`Writing ${session.output.length} existing outputs to new terminal`);
        for (const output of session.output) {
          term.write(output);
        }
        instance.lastWrittenIndex = session.output.length - 1;
      }
    } else {
      // Reusing existing terminal
      console.log(`Reusing existing terminal for session ${session.id}`);
      // Update font size if it changed
      instance.terminal.options.fontSize = fontSize;
      
      // Check if terminal buffer is out of sync with session output
      if (instance.buffer.length !== session.output.length) {
        console.log(`Terminal buffer out of sync. Buffer: ${instance.buffer.length}, Output: ${session.output.length}`);
        // Clear and rewrite everything
        instance.terminal.clear();
        for (const output of session.output) {
          instance.terminal.write(output);
        }
        instance.buffer = [...session.output];
        instance.lastWrittenIndex = session.output.length - 1;
      }
    }
    
    // Only attach to DOM if not already attached
    if (!instance.terminal.element || instance.terminal.element.parentElement !== terminalRef.current) {
      console.log(`Attaching terminal to DOM for session ${session.id}`);
      instance.terminal.open(terminalRef.current);
    }
    
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
      // Don't dispose or clear - the terminal will be reused
      // The terminal.open() method handles DOM cleanup when attaching to a new element
    };
  }, [session.id, fontSize]);
  
  // Update terminal when session output changes
  useEffect(() => {
    const instance = terminalInstances.get(session.id);
    if (!instance || !session.output.length) return;
    
    // Only write new outputs that haven't been written yet
    const startIndex = instance.lastWrittenIndex + 1;
    if (startIndex < session.output.length) {
      console.log(`Writing outputs ${startIndex} to ${session.output.length - 1} for session ${session.id}`);
      for (let i = startIndex; i < session.output.length; i++) {
        instance.terminal.write(session.output[i]);
      }
      instance.lastWrittenIndex = session.output.length - 1;
      // Update buffer
      instance.buffer = [...session.output];
    }
    
    // Ensure we're scrolled to the bottom to see new output
    instance.terminal.scrollToBottom();
  }, [session.id, session.output]);
  
  // Clear terminal when output is cleared
  useEffect(() => {
    const instance = terminalInstances.get(session.id);
    if (instance && session.output.length === 0) {
      console.log(`Clearing terminal for session ${session.id}`);
      instance.terminal.clear();
      instance.buffer = []; // Clear buffer
      instance.lastWrittenIndex = -1; // Reset tracking
    }
  }, [session.id, session.output.length]);
  
  const clearTerminal = async () => {
    const instance = terminalInstances.get(session.id);
    if (instance) {
      instance.terminal.clear();
      await window.electronAPI.clearSessionOutput(session.id);
    }
  };
  
  const disposeTerminal = () => {
    const instance = terminalInstances.get(session.id);
    if (instance) {
      instance.terminal.dispose();
      terminalInstances.delete(session.id);
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