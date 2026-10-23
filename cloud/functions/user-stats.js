'use strict';

const { requireId } = require('../lib/validation');
const { MASTER } = require('../lib/posts');

/**
 * Loads a user or throws OBJECT_NOT_FOUND (101).
 * @param {string} userId
 */
async function fetchUserOrFail(userId) {
  try {
    return await new Parse.Query(Parse.User).get(userId, MASTER);
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found.');
    }
    throw error;
  }
}

/**
 * Bonus: public activity summary of a user.
 * @returns {Promise<{ posts: number, comments: number, likesReceived: number }>}
 */
Parse.Cloud.define('userStats', async ({ params }) => {
  const user = await fetchUserOrFail(requireId(params.userId, 'userId'));

  const postsOfUser = new Parse.Query('Post').equalTo('author', user);
  const [posts, comments, likesReceived] = await Promise.all([
    postsOfUser.count(MASTER),
    new Parse.Query('Comment').equalTo('author', user).count(MASTER),
    new Parse.Query('Like').matchesQuery('post', postsOfUser).count(MASTER),
  ]);

  return { posts, comments, likesReceived };
});
