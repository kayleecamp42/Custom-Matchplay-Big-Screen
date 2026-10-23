// Starts both the Match Play API proxy and Vite frontend with one command.
// Uses Node's built-in process tools; no extra package required.
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const processes = [];
let stopping = false;

function start(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });
  processes.push(child);
  child.on('error', (error) => {
    console.error(`[${label}] Could not start: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[${label}] Stopped (${signal || `exit code ${code}`}). Shutting down both services.`);
      stop(code || 1);
    }
  });
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  // Give both child processes time to exit cleanly.
  setTimeout(() => process.exit(exitCode), 400).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('Starting Custom Matchplay Big Screen...');
console.log('Open the local address printed by Vite (normally http://localhost:5173).');
console.log('Press Ctrl+C to stop.');
start('API proxy', [path.join(root, 'server.js')]);
start('Display', [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1']);
