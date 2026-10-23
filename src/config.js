'use strict';

const crypto = require('node:crypto');

const APP_ID = 'blog-app';
const MOUNT_PATH = '/parse';
const DEFAULT_PORT = 1337;

/**
 * Loads variables from a local `.env` file when one exists.
 * Real environment variables always take precedence over the file.
 */
function loadDotEnv() {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the process environment only.
  }
}

/**
 * Resolves the master key from the environment.
 *
 * The key is never hard-coded and never logged. In production a missing key is a
 * fatal error. In development we fall back to a random, per-process key so that
 * `npm start` still works on a fresh machine; that key is unknown to anyone, so
 * master-only operations stay locked from the outside.
 */
function resolveMasterKey(env) {
  const masterKey = env.PARSE_MASTER_KEY && env.PARSE_MASTER_KEY.trim();
  if (masterKey) {
    return masterKey;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('PARSE_MASTER_KEY is required.');
  }
  console.warn(
    '[config] PARSE_MASTER_KEY is not set: using a random key for this process only. ' +
      'Set it in .env (see .env.example).',
  );
  return crypto.randomBytes(32).toString('hex');
}

function resolvePort(env) {
  const port = Number.parseInt(env.PORT, 10);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

/**
 * Builds the runtime configuration from environment variables.
 * @param {NodeJS.ProcessEnv} env
 */
function loadConfig(env = process.env) {
  return {
    appId: APP_ID,
    mountPath: MOUNT_PATH,
    port: resolvePort(env),
    masterKey: resolveMasterKey(env),
    databaseURI: env.DATABASE_URI ? env.DATABASE_URI.trim() : '',
    logLevel: env.LOG_LEVEL || 'info',
  };
}

module.exports = { APP_ID, MOUNT_PATH, loadDotEnv, loadConfig };
