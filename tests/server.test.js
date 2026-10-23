'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

describe('Server setup and permissions', () => {
  let api;
  let alice;
  let bob;

  before(async () => {
    api = await startTestServer();
    alice = await api.signUp();
    bob = await api.signUp();
  });

  after(() => api.close());

  it('exposes a health check', async () => {
    const { status, body } = await api.request('GET', '/health');

    assert.equal(status, 200);
    assert.deepEqual(body, { status: 'ok' });
  });

  it('R1: creates classes, fields and CLPs at startup', async () => {
    const { body: schema } = await api.request('GET', '/schemas/Post', { master: true });
    const { body: likeSchema } = await api.request('GET', '/schemas/Like', { master: true });

    assert.deepEqual(schema.fields.author, { type: 'Pointer', targetClass: '_User' });
    assert.deepEqual(schema.classLevelPermissions.create, { requiresAuthentication: true });
    assert.deepEqual(likeSchema.classLevelPermissions.create, {});
  });

  it('clients cannot create new classes or new fields', async () => {
    const newClass = await api.request('POST', '/classes/Hacker', {
      sessionToken: alice.sessionToken,
      body: { field: 'value' },
    });
    const newField = await api.request('POST', '/classes/Post', {
      sessionToken: alice.sessionToken,
      body: { title: 'Valid title', body: 'Valid body', unknownField: true },
    });

    assert.equal(newClass.body.code, 119);
    assert.ok(newField.body.code, 'creating a new field must fail');
  });

  it('users are publicly readable but their email is hidden from others', async () => {
    const anonymous = await api.request('GET', `/users/${alice.id}`);
    const otherUser = await api.request('GET', `/users/${alice.id}`, { sessionToken: bob.sessionToken });
    const self = await api.request('GET', '/users/me', { sessionToken: alice.sessionToken });

    assert.equal(anonymous.body.username, alice.username);
    assert.equal(anonymous.body.email, undefined);
    assert.equal(otherUser.body.email, undefined);
    assert.equal(self.body.email, alice.email);
  });

  it('posts can include their author without leaking the email', async () => {
    await api.createPost(alice);

    const { body } = await api.request('GET', '/classes/Post?include=author&limit=1');
    const [post] = body.results;

    assert.equal(post.author.username, alice.username);
    assert.equal(post.author.email, undefined);
  });

  it('bonus: userStats returns posts, comments and likes received', async () => {
    const carol = await api.signUp();
    const post = await api.createPost(carol);
    await api.createPost(carol);
    await api.request('POST', '/classes/Comment', {
      sessionToken: carol.sessionToken,
      body: { post: { __type: 'Pointer', className: 'Post', objectId: post.objectId }, text: 'Hi' },
    });
    await api.callFunction('toggleLike', { postId: post.objectId }, bob);

    const { body } = await api.callFunction('userStats', { userId: carol.id });
    const unknown = await api.callFunction('userStats', { userId: 'doesNotExist' });

    assert.deepEqual(body.result, { posts: 2, comments: 1, likesReceived: 1 });
    assert.equal(unknown.body.code, 101);
  });
});
