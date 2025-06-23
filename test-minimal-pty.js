const pty = require('node-pty');

console.log('Starting minimal PTY test...');

const shell = 'sh';
const ptyProcess = pty.spawn(shell, ['-c', 'echo "Hello World"; sleep 1; echo "Done"'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: process.cwd()
});

console.log('PTY spawned with PID:', ptyProcess.pid);

ptyProcess.onData((data) => {
  console.log('Received:', data);
});

ptyProcess.onExit(({ exitCode }) => {
  console.log('Exit code:', exitCode);
  process.exit(0);
});

setTimeout(() => {
  console.log('Timeout reached, killing process');
  ptyProcess.kill();
}, 5000);