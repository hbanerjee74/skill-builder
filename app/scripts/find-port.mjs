#!/usr/bin/env node
/**
 * Find an available port by binding to port 0 (OS-assigned).
 * Prints the port number to stdout and exits.
 */
import { createServer } from 'net';

const server = createServer();
server.listen(0, () => {
  const port = server.address().port;
  server.close(() => {
    process.stdout.write(String(port));
  });
});

server.on('error', (err) => {
  console.error('Failed to find available port:', err.message);
  process.exit(1);
});
