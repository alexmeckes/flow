import { app, crashReporter } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function setupCrashReporter() {
  const crashesDir = path.join(app.getPath('userData'), 'crashes');
  
  // Ensure crashes directory exists
  if (!fs.existsSync(crashesDir)) {
    fs.mkdirSync(crashesDir, { recursive: true });
  }

  // Start crash reporter
  crashReporter.start({
    submitURL: 'https://example.com/crash', // Required but won't be used
    uploadToServer: false,
    compress: true,
    ignoreSystemCrashHandler: true
  });

  console.log('Crash reporter started. Crashes will be saved to:', crashesDir);

  // Log crashes
  app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details);
    const crashLog = {
      type: 'render-process-gone',
      reason: details.reason,
      exitCode: details.exitCode,
      timestamp: new Date().toISOString(),
      details
    };
    saveCrashLog(crashLog);
  });

  app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
    const crashLog = {
      processType: 'child-process-gone',
      ...details,
      timestamp: new Date().toISOString()
    };
    saveCrashLog(crashLog);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    const crashLog = {
      type: 'uncaught-exception',
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      timestamp: new Date().toISOString()
    };
    saveCrashLog(crashLog);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    const crashLog = {
      type: 'unhandled-rejection',
      reason: reason instanceof Error ? {
        message: reason.message,
        stack: reason.stack,
        name: reason.name
      } : String(reason),
      timestamp: new Date().toISOString()
    };
    saveCrashLog(crashLog);
  });
}

function saveCrashLog(data: any) {
  try {
    const crashesDir = path.join(app.getPath('userData'), 'crashes');
    const filename = `crash-${Date.now()}.json`;
    const filepath = path.join(crashesDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log('Crash log saved to:', filepath);
  } catch (error) {
    console.error('Failed to save crash log:', error);
  }
}