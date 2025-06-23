#!/usr/bin/env node

// Safe test script that outputs data similar to claude but in a controlled way
console.log('\x1b[2J\x1b[H'); // Clear screen
console.log('\x1b[36m' + '='.repeat(80) + '\x1b[0m');
console.log('\x1b[1mClaude Test Simulator\x1b[0m');
console.log('\x1b[36m' + '='.repeat(80) + '\x1b[0m');
console.log('');
console.log('This is a safe test script to help debug PTY issues.');
console.log('It will output data in a controlled manner.');
console.log('');

// Output some ANSI escape sequences like claude might
const messages = [
  '\x1b[32m✓\x1b[0m Initializing...',
  '\x1b[33m→\x1b[0m Processing request...',
  '\x1b[34m•\x1b[0m Analyzing code...',
  '\x1b[35m♦\x1b[0m Generating response...'
];

let index = 0;
const interval = setInterval(() => {
  if (index < messages.length) {
    console.log(messages[index]);
    index++;
  } else {
    console.log('\n\x1b[32mReady for input:\x1b[0m');
    clearInterval(interval);
    
    // Switch to interactive mode
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      // Echo the character
      process.stdout.write(data);
      
      // Exit on Ctrl+C or Ctrl+D
      if (data[0] === 3 || data[0] === 4) {
        console.log('\n\x1b[31mExiting...\x1b[0m');
        process.exit(0);
      }
      
      // Simulate response on Enter
      if (data[0] === 13) {
        process.stdout.write('\n');
        setTimeout(() => {
          console.log('\x1b[36mProcessing your request...\x1b[0m');
          setTimeout(() => {
            console.log('\x1b[32mDone!\x1b[0m\n');
            console.log('\x1b[32mReady for input:\x1b[0m');
          }, 1000);
        }, 500);
      }
    });
  }
}, 500);

// Handle termination
process.on('SIGTERM', () => {
  console.log('\n\x1b[31mReceived SIGTERM, exiting...\x1b[0m');
  process.exit(0);
});