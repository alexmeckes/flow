import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export function setupAdvancedCrashHandler() {
  const crashDir = path.join(app.getPath('userData'), 'crashes');
  
  // Ensure crash directory exists
  if (!fs.existsSync(crashDir)) {
    fs.mkdirSync(crashDir, { recursive: true });
  }

  // Handle SIGSEGV
  process.on('SIGSEGV', () => {
    const crashFile = path.join(crashDir, `sigsegv-${Date.now()}.json`);
    const crashData = {
      type: 'SIGSEGV',
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        v8Version: process.versions.v8,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      stack: new Error().stack,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        USE_TEST_CLAUDE: process.env.USE_TEST_CLAUDE,
        USE_SAFE_PTY_TEST: process.env.USE_SAFE_PTY_TEST
      }
    };
    
    try {
      fs.writeFileSync(crashFile, JSON.stringify(crashData, null, 2));
      console.error(`SIGSEGV crash data saved to: ${crashFile}`);
    } catch (e) {
      console.error('Failed to save SIGSEGV data:', e);
    }
    
    // Force exit to prevent hang
    process.exit(139); // 128 + 11 (SIGSEGV)
  });

  // Handle SIGBUS
  process.on('SIGBUS', () => {
    const crashFile = path.join(crashDir, `sigbus-${Date.now()}.json`);
    const crashData = {
      type: 'SIGBUS',
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        memory: process.memoryUsage()
      }
    };
    
    try {
      fs.writeFileSync(crashFile, JSON.stringify(crashData, null, 2));
    } catch (e) {
      console.error('Failed to save SIGBUS data:', e);
    }
    
    process.exit(138); // 128 + 10 (SIGBUS)
  });

  // Monitor memory usage
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    
    if (heapUsedMB > 500) { // Warn if heap usage exceeds 500MB
      console.warn(`High memory usage: Heap ${heapUsedMB}MB/${heapTotalMB}MB, RSS: ${rssMB}MB`);
    }
  }, 5000);

  console.log(`Advanced crash handler initialized. Crash logs will be saved to: ${crashDir}`);
}