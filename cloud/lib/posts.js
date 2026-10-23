'use strict';

const MASTER = { useMasterKey: true };

/** Builds a Post pointer without fetching it. */
function postPointer(postId) {
  return Parse.Object.extend('Post').createWithoutData(postId);
}

/**
 * Loads a post or throws OBJECT_NOT_FOUND (101).
 * @param {string} postId
 */
async function fetchPostOrFail(postId) {
  try {
    return await new Parse.Query('Post').get(postId, MASTER);
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Post not found.');
    }
    throw error;
  }
}

/**
 * Atomically adds `amount` to a counter of a post.
 * When the post no longer exists (e.g. it is being deleted), there is nothing to update.
 * @param {string} postId
 * @param {'likesCount' | 'commentsCount'} field
 * @param {number} amount
 */
async function incrementPostCounter(postId, field, amount) {
  const post = postPointer(postId);
  post.increment(field, amount);
  try {
    await post.save(null, MASTER);
  } catch (error) {
    if (error.code !== Parse.Error.OBJECT_NOT_FOUND) {
      throw error;
    }
  }
}

/**
 * Deletes every object of `className` whose `field` points to `target`, in batches.
 * @param {string} className
 * @param {string} field
 * @param {Parse.Object} target
 */
async function destroyAllPointingTo(className, field, target) {
  const batchSize = 500;
  const query = new Parse.Query(className).equalTo(field, target).limit(batchSize);
  let batch;
  do {
    batch = await query.find(MASTER);
    if (batch.length > 0) {
      await Parse.Object.destroyAll(batch, MASTER);
    }
  } while (batch.length === batchSize);
}

module.exports = { MASTER, postPointer, fetchPostOrFail, incrementPostCounter, destroyAllPointingTo };
