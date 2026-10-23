'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

describe('Post rules', () => {
  let api;
  let alice;
  let bob;

  before(async () => {
    api = await startTestServer();
    alice = await api.signUp();
    bob = await api.signUp();
  });

  after(() => api.close());

  it('R2: trims the title and body before saving', async () => {
    const post = await api.createPost(alice, { title: '   Trimmed title   ', body: '  Body  ' });
    const saved = await api.getPost(post.objectId);

    assert.equal(saved.title, 'Trimmed title');
    assert.equal(saved.body, 'Body');
  });

  it('R2: rejects invalid title and body lengths with 142', async () => {
    const invalidPayloads = [
      { title: 'ab', body: 'ok' }, // title too short
      { title: '  a  ', body: 'ok' }, // too short once trimmed
      { title: 'x'.repeat(121), body: 'ok' }, // title too long
      { title: 'Valid title', body: '   ' }, // empty body once trimmed
      { title: 'Valid title', body: 'x'.repeat(5001) }, // body too long
      { title: 'Valid title' }, // missing body
    ];

    for (const payload of invalidPayloads) {
      const { body } = await api.request('POST', '/classes/Post', {
        sessionToken: alice.sessionToken,
        body: payload,
      });
      assert.equal(body.code, 142, `expected 142 for ${JSON.stringify(payload).slice(0, 60)}`);
    }
  });

  it('R3: ignores client values for author and counters, and sets the ACL', async () => {
    const post = await api.createPost(alice, {
      author: { __type: 'Pointer', className: '_User', objectId: bob.id },
      likesCount: 99,
      commentsCount: 42,
    });
    const saved = await api.getPost(post.objectId);

    assert.equal(saved.author.objectId, alice.id);
    assert.equal(saved.likesCount, 0);
    assert.equal(saved.commentsCount, 0);
    assert.deepEqual(saved.ACL, { '*': { read: true }, [alice.id]: { write: true } });
  });

  it('R3: the author cannot change author or counters on update', async () => {
    const post = await api.createPost(alice);

    const { status } = await api.request('PUT', `/classes/Post/${post.objectId}`, {
      sessionToken: alice.sessionToken,
      body: {
        title: 'Updated title',
        author: { __type: 'Pointer', className: '_User', objectId: bob.id },
        likesCount: 1000,
        commentsCount: { __op: 'Increment', amount: 5 },
      },
    });
    const saved = await api.getPost(post.objectId);

    assert.equal(status, 200);
    assert.equal(saved.title, 'Updated title');
    assert.equal(saved.author.objectId, alice.id);
    assert.equal(saved.likesCount, 0);
    assert.equal(saved.commentsCount, 0);
  });

  it('only logged-in users can create posts', async () => {
    const { body } = await api.request('POST', '/classes/Post', {
      body: { title: 'Anonymous post', body: 'Should fail' },
    });

    assert.ok([101, 119].includes(body.code), `unexpected code ${body.code}`);
  });

  it('only the author can update or delete a post', async () => {
    const post = await api.createPost(alice);

    const update = await api.request('PUT', `/classes/Post/${post.objectId}`, {
      sessionToken: bob.sessionToken,
      body: { title: 'Hijacked title' },
    });
    const removal = await api.request('DELETE', `/classes/Post/${post.objectId}`, {
      sessionToken: bob.sessionToken,
    });

    assert.equal(update.body.code, 101);
    assert.equal(removal.body.code, 101);
    assert.equal((await api.getPost(post.objectId)).title, 'Hello world');
  });
});
