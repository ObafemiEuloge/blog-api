'use strict';

const { requireId } = require('../lib/validation');
const { publicReadOnly } = require('../lib/acl');
const { MASTER, fetchPostOrFail } = require('../lib/posts');

/**
 * Removes the like. Returns false when a concurrent call removed it first.
 * @param {Parse.Object} like
 */
async function removeLike(like) {
  try {
    await like.destroy(MASTER);
    return true;
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      return false;
    }
    throw error;
  }
}

/**
 * Creates the like. Returns false when a concurrent call created it first: the unique
 * index on (post, user) rejects the duplicate, and the end state ("liked") is the same.
 * @param {Parse.Object} post
 * @param {Parse.User} user
 */
async function addLike(post, user) {
  const like = new Parse.Object('Like', { post, user });
  like.setACL(publicReadOnly());
  try {
    await like.save(null, MASTER);
    return true;
  } catch (error) {
    if (error.code === Parse.Error.DUPLICATE_VALUE) {
      return false;
    }
    throw error;
  }
}

/**
 * Atomically adds `amount` to likesCount and returns the new value.
 * Only calls that really created or removed a Like change the counter, so the counter
 * always equals the number of Like rows, even under parallel calls.
 * @param {Parse.Object} post
 * @param {number} amount
 */
async function incrementLikesCount(post, amount) {
  if (amount === 0) {
    // Nothing changed here (a concurrent call did the work): return the fresh value.
    await post.fetch(MASTER);
  } else {
    post.increment('likesCount', amount);
    await post.save(null, MASTER);
  }
  return post.get('likesCount');
}

/**
 * R7: likes the post if the current user has not liked it yet, unlikes it otherwise.
 * @returns {Promise<{ liked: boolean, likesCount: number }>}
 */
Parse.Cloud.define(
  'toggleLike',
  async ({ params, user }) => {
    const postId = requireId(params.postId, 'postId');
    const post = await fetchPostOrFail(postId);

    const existing = await new Parse.Query('Like').equalTo('post', post).equalTo('user', user).first(MASTER);
    let delta = 0;
    if (existing) {
      delta = (await removeLike(existing)) ? -1 : 0;
    } else {
      delta = (await addLike(post, user)) ? 1 : 0;
    }

    const likesCount = await incrementLikesCount(post, delta);
    return { liked: !existing, likesCount };
  },
  // Not logged in -> VALIDATION_ERROR (142).
  { requireUser: true },
);
