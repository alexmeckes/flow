const pty = require('node-pty');

console.log('Testing PTY in isolation...');

try {
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env
  });

  console.log('PTY spawned with PID:', ptyProcess.pid);

  let dataCount = 0;
  ptyProcess.onData((data) => {
    dataCount++;
    if (dataCount <= 5) {
      console.log(`Data ${dataCount}: ${data.length} bytes`);
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log('PTY exited:', { exitCode, signal });
    process.exit(0);
  });

  // Send a simple command
  setTimeout(() => {
    console.log('Sending echo command...');
    ptyProcess.write('echo "Hello PTY"\r');
  }, 1000);

  // Exit after 3 seconds
  setTimeout(() => {
    console.log('Killing PTY...');
    ptyProcess.kill();
  }, 3000);

} catch (error) {
  console.error('Error:', error);
}