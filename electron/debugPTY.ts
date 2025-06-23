import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const debugLogPath = path.join(app.getPath('userData'), 'pty-debug.log');
let logStream: fs.WriteStream | null = null;

export function initPTYDebug() {
  try {
    logStream = fs.createWriteStream(debugLogPath, { flags: 'a' });
    debugLog('=== PTY Debug Log Started ===');
    debugLog(`Node version: ${process.version}`);
    debugLog(`Electron version: ${process.versions.electron}`);
    debugLog(`Platform: ${process.platform}`);
    debugLog(`Architecture: ${process.arch}`);
  } catch (error) {
    console.error('Failed to init PTY debug:', error);
  }
}

let logBuffer: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function flushLogs() {
  if (logStream && logBuffer.length > 0) {
    const content = logBuffer.join('\n') + '\n';
    logStream.write(content);
    logBuffer = [];
  }
}

export function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Only console.log for critical messages
  if (message.includes('Error') || message.includes('initialized')) {
    console.log(logMessage, data || '');
  }
  
  if (logStream) {
    let fullMessage = logMessage;
    if (data) {
      fullMessage += ' ' + JSON.stringify(data, null, 2);
    }
    logBuffer.push(fullMessage);
    
    // Batch writes every 100ms
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushLogs();
        flushTimer = null;
      }, 100);
    }
  }
}

export function debugPTYSpawn(shell: string, args: string[], options: any) {
  debugLog('PTY Spawn Request:', {
    shell,
    args,
    options: {
      ...options,
      env: '...' // Don't log full env
    }
  });
}

// High-frequency events that should be throttled
const HIGH_FREQ_EVENTS = ['onData', 'before-emit-output', 'after-emit-output'];
const eventCounters = new Map<string, number>();

export function debugPTYEvent(sessionId: string, event: string, data?: any) {
  // Skip high-frequency events unless in verbose mode
  if (HIGH_FREQ_EVENTS.includes(event) && !process.env.DEBUG_PTY_VERBOSE) {
    // Count them but don't log each one
    const key = `${sessionId}-${event}`;
    eventCounters.set(key, (eventCounters.get(key) || 0) + 1);
    return;
  }
  
  debugLog(`PTY Event [${sessionId}] ${event}:`, data);
}

export function closePTYDebug() {
  if (logStream) {
    // Flush any remaining logs
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushLogs();
    
    // Log event counts
    if (eventCounters.size > 0) {
      debugLog('Event counts:', Object.fromEntries(eventCounters));
    }
    
    debugLog('=== PTY Debug Log Ended ===');
    flushLogs();
    logStream.end();
  }
}