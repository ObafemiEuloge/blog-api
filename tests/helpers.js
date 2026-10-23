'use strict';

const net = require('node:net');
const crypto = require('node:crypto');
const { startServer } = require('../src/server');

const MASTER_KEY = 'test-master-key';

/** Asks the OS for a free TCP port. */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * Starts a real server on an in-memory database and returns a small REST client.
 * Tests talk to the API over HTTP only, like the black-box grader.
 */
async function startTestServer() {
  const port = await getFreePort();
  const server = await startServer({ port, masterKey: MASTER_KEY, databaseURI: '', logLevel: 'silent' });

  /**
   * Sends a REST request to the API.
   * @param {string} method
   * @param {string} path path under /parse, e.g. "/classes/Post"
   * @param {{ body?: object, sessionToken?: string, master?: boolean }} [options]
   */
  async function request(method, path, { body, sessionToken, master } = {}) {
    const headers = { 'X-Parse-Application-Id': 'blog-app', 'Content-Type': 'application/json' };
    if (sessionToken) headers['X-Parse-Session-Token'] = sessionToken;
    if (master) headers['X-Parse-Master-Key'] = MASTER_KEY;

    const response = await fetch(`${server.url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  /** Signs up a fresh user and returns { id, username, email, sessionToken }. */
  async function signUp() {
    const username = `user_${crypto.randomUUID().slice(0, 8)}`;
    const email = `${username}@example.com`;
    const { body } = await request('POST', '/users', {
      body: { username, password: 'Password123!', email },
    });
    return { id: body.objectId, username, email, sessionToken: body.sessionToken };
  }

  async function createPost(user, fields = {}) {
    const { body } = await request('POST', '/classes/Post', {
      sessionToken: user.sessionToken,
      body: { title: 'Hello world', body: 'First post body', ...fields },
    });
    return body;
  }

  async function getPost(postId) {
    const { body } = await request('GET', `/classes/Post/${postId}`);
    return body;
  }

  async function callFunction(name, params, user) {
    return request('POST', `/functions/${name}`, { body: params, sessionToken: user?.sessionToken });
  }

  return { request, signUp, createPost, getPost, callFunction, close: () => server.close() };
}

module.exports = { startTestServer };
