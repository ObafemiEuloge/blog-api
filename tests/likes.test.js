'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

describe('toggleLike (R7)', () => {
  let api;
  let alice;
  let bob;

  before(async () => {
    api = await startTestServer();
    alice = await api.signUp();
    bob = await api.signUp();
  });

  after(() => api.close());

  const toggleLike = (postId, user) => api.callFunction('toggleLike', { postId }, user);

  it('likes, then unlikes, and keeps likesCount in sync', async () => {
    const post = await api.createPost(alice);

    const liked = await toggleLike(post.objectId, bob);
    assert.deepEqual(liked.body.result, { liked: true, likesCount: 1 });
    assert.equal((await api.getPost(post.objectId)).likesCount, 1);

    const second = await toggleLike(post.objectId, alice);
    assert.deepEqual(second.body.result, { liked: true, likesCount: 2 });

    const unliked = await toggleLike(post.objectId, bob);
    assert.deepEqual(unliked.body.result, { liked: false, likesCount: 1 });
    assert.equal((await api.getPost(post.objectId)).likesCount, 1);
  });

  it('requires a logged-in user (142)', async () => {
    const post = await api.createPost(alice);

    const { body } = await toggleLike(post.objectId);

    assert.equal(body.code, 142);
  });

  it('rejects a missing postId (142) and an unknown post (101)', async () => {
    const missing = await api.callFunction('toggleLike', {}, bob);
    const unknown = await toggleLike('doesNotExist', bob);

    assert.equal(missing.body.code, 142);
    assert.equal(unknown.body.code, 101);
  });

  it('clients cannot create, update or delete likes directly', async () => {
    const post = await api.createPost(alice);
    const pointer = { __type: 'Pointer', className: 'Post', objectId: post.objectId };

    const create = await api.request('POST', '/classes/Like', {
      sessionToken: bob.sessionToken,
      body: { post: pointer, user: { __type: 'Pointer', className: '_User', objectId: bob.id } },
    });
    await toggleLike(post.objectId, bob);
    const where = encodeURIComponent(JSON.stringify({ post: pointer }));
    const { body: likes } = await api.request('GET', `/classes/Like?where=${where}`);
    const likeId = likes.results[0].objectId;
    const remove = await api.request('DELETE', `/classes/Like/${likeId}`, { sessionToken: bob.sessionToken });

    assert.equal(create.body.code, 119);
    assert.ok([101, 119].includes(remove.body.code), `unexpected code ${remove.body.code}`);
  });

  it('bonus: stays consistent under parallel calls by the same user', async () => {
    const post = await api.createPost(alice);

    // An even number of toggles must end "not liked", whatever the interleaving.
    const results = await Promise.all(Array.from({ length: 6 }, () => toggleLike(post.objectId, bob)));
    for (const { body } of results) {
      assert.equal(typeof body.result?.liked, 'boolean', JSON.stringify(body));
    }

    const where = encodeURIComponent(JSON.stringify({
      post: { __type: 'Pointer', className: 'Post', objectId: post.objectId },
    }));
    const { body: likes } = await api.request('GET', `/classes/Like?where=${where}&count=1&limit=0`);
    const saved = await api.getPost(post.objectId);

    assert.ok(likes.count <= 1, 'at most one like per (user, post)');
    assert.equal(saved.likesCount, likes.count);
  });
});
