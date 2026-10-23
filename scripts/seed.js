'use strict';

/*
 * Seeds a running API with demo data through the public REST API, so every business
 * rule (validation, counters, likes) is applied exactly as for real clients.
 *
 * Usage: npm start (in another terminal), then npm run seed
 * Users: alice, bob, carol / Password123!
 */

const BASE_URL = process.env.SEED_URL || `http://localhost:${process.env.PORT || 1337}/parse`;
const PASSWORD = 'Password123!';
const USERNAMES = ['alice', 'bob', 'carol'];

async function call(method, path, { body, sessionToken } = {}) {
  const headers = { 'X-Parse-Application-Id': 'blog-app', 'Content-Type': 'application/json' };
  if (sessionToken) headers['X-Parse-Session-Token'] = sessionToken;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${data.code} ${data.error}`);
  }
  return data;
}

/** Signs up the user, or logs in when it already exists. */
async function getSession(username) {
  try {
    return await call('POST', '/users', {
      body: { username, password: PASSWORD, email: `${username}@example.com` },
    });
  } catch {
    return call('POST', '/login', { body: { username, password: PASSWORD } });
  }
}

async function main() {
  const users = await Promise.all(USERNAMES.map(getSession));

  let posts = 0;
  for (const [index, author] of users.entries()) {
    for (let n = 1; n <= 3; n += 1) {
      const post = await call('POST', '/classes/Post', {
        sessionToken: author.sessionToken,
        body: { title: `${USERNAMES[index]}'s post #${n}`, body: `Demo content number ${n}.` },
      });
      posts += 1;

      // Every other user comments and likes the post.
      for (const reader of users.filter((user) => user !== author)) {
        await call('POST', '/classes/Comment', {
          sessionToken: reader.sessionToken,
          body: { post: { __type: 'Pointer', className: 'Post', objectId: post.objectId }, text: 'Nice post!' },
        });
        await call('POST', '/functions/toggleLike', {
          sessionToken: reader.sessionToken,
          body: { postId: post.objectId },
        });
      }
    }
  }

  console.log(`Seeded ${users.length} users and ${posts} posts with comments and likes.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
