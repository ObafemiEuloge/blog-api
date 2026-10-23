'use strict';

const { MongoClient } = require('mongodb');

/*
 * MongoDB indexes that the Parse schema option cannot express.
 * Parse stores a pointer field `post` as the string column `_p_post` ("Post$<objectId>").
 */
const INDEXES = [
  {
    collection: 'Like',
    // One like per (post, user): concurrent toggleLike calls cannot create duplicates.
    keys: { _p_post: 1, _p_user: 1 },
    options: { name: 'unique_like_per_user', unique: true },
  },
  {
    collection: 'Comment',
    // Comments of a post (counters, cascade delete).
    keys: { _p_post: 1 },
    options: { name: 'comment_post' },
  },
  {
    collection: 'Post',
    // Posts of an author (userStats).
    keys: { _p_author: 1 },
    options: { name: 'post_author' },
  },
];

/**
 * Creates the indexes if they do not exist yet (idempotent).
 * @param {string} databaseURI
 */
async function ensureIndexes(databaseURI) {
  const client = new MongoClient(databaseURI);
  try {
    await client.connect();
    const db = client.db();
    for (const { collection, keys, options } of INDEXES) {
      await db.collection(collection).createIndex(keys, options);
    }
  } finally {
    await client.close();
  }
}

module.exports = { ensureIndexes };
