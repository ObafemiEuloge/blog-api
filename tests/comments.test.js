'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

const postPointer = (postId) => ({ __type: 'Pointer', className: 'Post', objectId: postId });

describe('Comment rules', () => {
  let api;
  let alice;
  let bob;

  before(async () => {
    api = await startTestServer();
    alice = await api.signUp();
    bob = await api.signUp();
  });

  after(() => api.close());

  async function addComment(user, postId, text = 'Nice post!') {
    return api.request('POST', '/classes/Comment', {
      sessionToken: user.sessionToken,
      body: { post: postPointer(postId), text },
    });
  }

  it('R4: validates the text length with 142', async () => {
    const post = await api.createPost(alice);

    for (const text of ['', '    ', 'x'.repeat(501)]) {
      const { body } = await addComment(bob, post.objectId, text);
      assert.equal(body.code, 142);
    }
  });

  it('R4: rejects a comment on a missing post with 101', async () => {
    const { body } = await addComment(bob, 'doesNotExist');

    assert.equal(body.code, 101);
  });

  it('R4: sets the author to the current user and the ACL', async () => {
    const post = await api.createPost(alice);
    const { body: created } = await api.request('POST', '/classes/Comment', {
      sessionToken: bob.sessionToken,
      body: {
        post: postPointer(post.objectId),
        text: '  Great read  ',
        author: { __type: 'Pointer', className: '_User', objectId: alice.id },
      },
    });
    const { body: comment } = await api.request('GET', `/classes/Comment/${created.objectId}`);

    assert.equal(comment.author.objectId, bob.id);
    assert.equal(comment.text, 'Great read');
    assert.deepEqual(comment.ACL, { '*': { read: true }, [bob.id]: { write: true } });
  });

  it('R5: keeps post.commentsCount up to date on create and delete', async () => {
    const post = await api.createPost(alice);
    const { body: first } = await addComment(bob, post.objectId);
    await addComment(alice, post.objectId);

    assert.equal((await api.getPost(post.objectId)).commentsCount, 2);

    await api.request('DELETE', `/classes/Comment/${first.objectId}`, { sessionToken: bob.sessionToken });

    assert.equal((await api.getPost(post.objectId)).commentsCount, 1);
  });

  it('only the author can delete a comment', async () => {
    const post = await api.createPost(alice);
    const { body: comment } = await addComment(bob, post.objectId);

    // Even the post author cannot delete someone else's comment.
    const { body } = await api.request('DELETE', `/classes/Comment/${comment.objectId}`, {
      sessionToken: alice.sessionToken,
    });

    assert.equal(body.code, 101);
  });

  it('R6: deleting a post deletes its comments and likes', async () => {
    const post = await api.createPost(alice);
    await addComment(bob, post.objectId);
    await addComment(alice, post.objectId);
    await api.callFunction('toggleLike', { postId: post.objectId }, bob);

    const { status } = await api.request('DELETE', `/classes/Post/${post.objectId}`, {
      sessionToken: alice.sessionToken,
    });
    const where = encodeURIComponent(JSON.stringify({ post: postPointer(post.objectId) }));
    const comments = await api.request('GET', `/classes/Comment?where=${where}&count=1&limit=0`);
    const likes = await api.request('GET', `/classes/Like?where=${where}&count=1&limit=0`);

    assert.equal(status, 200);
    assert.equal(comments.body.count, 0);
    assert.equal(likes.body.count, 0);
  });
});
