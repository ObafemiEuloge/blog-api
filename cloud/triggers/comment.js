'use strict';

const { requireText, validationError } = require('../lib/validation');
const { publicReadAuthorWrite } = require('../lib/acl');
const { fetchPostOrFail, incrementPostCounter } = require('../lib/posts');

const TEXT_LENGTH = { min: 1, max: 500 };

Parse.Cloud.beforeSave('Comment', async (request) => {
  const { object: comment, original, user, master } = request;

  // R4: trim, then validate the text.
  comment.set('text', requireText(comment.get('text'), 'text', TEXT_LENGTH));

  const isCreate = !original;
  if (!isCreate) {
    // A comment can be edited, but never moved to another post or author.
    if (!master) {
      comment.set('post', original.get('post'));
      comment.set('author', original.get('author'));
      comment.setACL(original.getACL());
    }
    return;
  }

  const author = user || (master ? comment.get('author') : undefined);
  if (!author) {
    throw validationError('You must be logged in to comment.');
  }

  // R4: the post must exist (101 otherwise).
  const post = comment.get('post');
  if (!post || !post.id) {
    throw validationError('post is required.');
  }
  await fetchPostOrFail(post.id);

  comment.set('author', author);
  comment.setACL(publicReadAuthorWrite(author));
});

// R5: keep post.commentsCount up to date.
Parse.Cloud.afterSave('Comment', async ({ object: comment, original }) => {
  if (original) {
    return; // Edits do not change the number of comments.
  }
  await incrementPostCounter(comment.get('post').id, 'commentsCount', 1);
});

Parse.Cloud.afterDelete('Comment', async ({ object: comment }) => {
  await incrementPostCounter(comment.get('post').id, 'commentsCount', -1);
});
