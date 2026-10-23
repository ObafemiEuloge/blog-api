'use strict';

const { requireText, validationError } = require('../lib/validation');
const { publicReadAuthorWrite } = require('../lib/acl');
const { destroyAllPointingTo } = require('../lib/posts');

const TITLE_LENGTH = { min: 3, max: 120 };
const BODY_LENGTH = { min: 1, max: 5000 };

/** Fields owned by the server: clients can never set or change them. */
const SERVER_FIELDS = ['author', 'likesCount', 'commentsCount'];

Parse.Cloud.beforeSave('Post', (request) => {
  const { object: post, original, user, master } = request;

  // R2: trim, then validate.
  post.set('title', requireText(post.get('title'), 'title', TITLE_LENGTH));
  post.set('body', requireText(post.get('body'), 'body', BODY_LENGTH));

  const isCreate = !original;
  if (isCreate) {
    // R3: the author is always the current user; client values are ignored.
    // Master-key calls (seed script) may provide the author explicitly.
    const author = user || (master ? post.get('author') : undefined);
    if (!author) {
      throw validationError('You must be logged in to create a post.');
    }
    post.set('author', author);
    post.set('likesCount', 0);
    post.set('commentsCount', 0);
    post.setACL(publicReadAuthorWrite(author));
    return;
  }

  // R3 on update: counters are maintained by Cloud Code (master key) only.
  if (!master) {
    for (const field of SERVER_FIELDS) {
      post.set(field, original.get(field));
    }
    // The author cannot change who may edit the post either.
    post.setACL(original.getACL());
  }
});

// R6: deleting a post deletes its comments and likes.
Parse.Cloud.afterDelete('Post', async ({ object: post }) => {
  await Promise.all([
    destroyAllPointingTo('Comment', 'post', post),
    destroyAllPointingTo('Like', 'post', post),
  ]);
});
