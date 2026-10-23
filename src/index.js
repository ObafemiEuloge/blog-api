'use strict';

const { loadDotEnv } = require('./config');

loadDotEnv();

const { startServer } = require('./server');

async function main() {
  const server = await startServer();
  console.log(`Blog API ready at ${server.url}`);

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start the server:', error.message);
  process.exit(1);
});
