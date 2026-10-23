'use strict';

const path = require('node:path');

// Parse Server creates a ./logs folder when it is first required; log to the console only.
process.env.PARSE_SERVER_LOGS_FOLDER ??= 'null';

const express = require('express');
const { ParseServer } = require('parse-server');
const { loadConfig } = require('./config');
const schema = require('./schema');
const { ensureIndexes } = require('./indexes');

/**
 * Starts an in-memory MongoDB when no DATABASE_URI is provided, so the API runs on a
 * clean machine without any database installed.
 */
async function resolveDatabase(databaseURI) {
  if (databaseURI) {
    return { databaseURI, stop: async () => {} };
  }
  // Lazy-loaded: only needed when no external database is configured.
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongo = await MongoMemoryServer.create();
  return {
    databaseURI: mongo.getUri('blog-app'),
    stop: () => mongo.stop(),
  };
}

function buildParseOptions(config, databaseURI) {
  return {
    appId: config.appId,
    masterKey: config.masterKey,
    databaseURI,
    serverURL: `http://localhost:${config.port}${config.mountPath}`,
    cloud: path.join(__dirname, '..', 'cloud', 'main.js'),
    // Logs go to stdout/stderr only (no ./logs folder); LOG_LEVEL=silent mutes them.
    logsFolder: null,
    logLevel: config.logLevel === 'silent' ? 'error' : config.logLevel,
    silent: config.logLevel === 'silent',
    // Classes, fields and CLPs are created by code at startup.
    schema,
    // Clients may only work with the classes declared by the server.
    allowClientClassCreation: false,
    // New users get a public-read ACL so that posts can include their author.
    enforcePrivateUsers: false,
    // Email stays hidden from other users; a user can still read their own.
    protectedFields: { _User: { '*': ['email'] } },
    protectedFieldsOwnerExempt: true,
    protectedFieldsSaveResponseExempt: false,
    protectedFieldsTriggerExempt: true,
    // Master key only accepted from the local machine.
    masterKeyIps: ['127.0.0.1', '::1'],
    readOnlyMasterKeyIps: ['127.0.0.1', '::1'],
    allowAggregationForReadOnlyMasterKey: false,
    // Opt in now to the safer upcoming defaults (also silences deprecation warnings).
    fileUpload: { allowedFileUrlDomains: [] },
    pages: { encodePageParamHeaders: true },
    requestComplexity: {
      includeDepth: 10,
      includeCount: 100,
      subqueryDepth: 10,
      queryDepth: 10,
      graphQLDepth: 20,
      graphQLFields: 200,
      batchRequestLimit: 100,
    },
    installation: { duplicateDeviceTokenActionEnforceAuth: true },
    enableLiveQueryClassLevelPermissionRoles: true,
  };
}

function listen(app, port) {
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, (error) => (error ? reject(error) : resolve(httpServer)));
  });
}

/**
 * Builds and starts the HTTP server (Express + Parse Server).
 * @param {Partial<ReturnType<typeof loadConfig>>} overrides values that replace the env config (used by tests)
 */
async function startServer(overrides = {}) {
  const config = { ...loadConfig(), ...overrides };
  const database = await resolveDatabase(config.databaseURI);

  const parseServer = new ParseServer(buildParseOptions(config, database.databaseURI));
  await parseServer.start();
  await ensureIndexes(database.databaseURI);

  const app = express();
  app.disable('x-powered-by');
  app.use(config.mountPath, parseServer.app);

  const httpServer = await listen(app, config.port);

  return {
    url: `http://localhost:${config.port}${config.mountPath}`,
    config,
    async close() {
      // handleShutdown closes the HTTP server it is attached to, then the database adapter.
      parseServer.server = httpServer;
      await parseServer.handleShutdown();
      await database.stop();
    },
  };
}

module.exports = { startServer };
