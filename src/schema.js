'use strict';

/*
 * Database schema and Class-Level Permissions (CLPs), applied by Parse Server at
 * startup through the `schema` option. Nothing has to be created by hand.
 */

const PUBLIC = { '*': true };
const LOGGED_IN = { requiresAuthentication: true };
const NOBODY = {};

const publicRead = {
  find: PUBLIC,
  get: PUBLIC,
  count: PUBLIC,
};

/** Public read, writes reserved to logged-in users (object ACLs narrow writes to the author). */
const authorContentPermissions = {
  ...publicRead,
  create: LOGGED_IN,
  update: LOGGED_IN,
  delete: LOGGED_IN,
  addField: NOBODY,
  protectedFields: {},
};

const pointer = (targetClass) => ({ type: 'Pointer', targetClass });

const definitions = [
  {
    className: '_User',
    classLevelPermissions: {
      // Users are publicly readable so that posts can include their author...
      ...publicRead,
      create: PUBLIC, // sign up
      update: PUBLIC, // restricted to the user itself by the object ACL
      delete: PUBLIC, // same
      addField: NOBODY,
      // ...but their email address is never exposed to other users.
      protectedFields: { '*': ['email'] },
    },
  },
  {
    className: 'Post',
    fields: {
      title: { type: 'String' },
      body: { type: 'String' },
      author: pointer('_User'),
      likesCount: { type: 'Number' },
      commentsCount: { type: 'Number' },
    },
    classLevelPermissions: authorContentPermissions,
  },
  {
    className: 'Comment',
    fields: {
      post: pointer('Post'),
      author: pointer('_User'),
      text: { type: 'String' },
    },
    classLevelPermissions: authorContentPermissions,
  },
  {
    className: 'Like',
    fields: {
      post: pointer('Post'),
      user: pointer('_User'),
    },
    classLevelPermissions: {
      ...publicRead,
      // Likes are only written by Cloud Code (toggleLike) with the master key.
      create: NOBODY,
      update: NOBODY,
      delete: NOBODY,
      addField: NOBODY,
      protectedFields: {},
    },
  },
];

module.exports = {
  definitions,
  // Clients cannot change the schema (no new fields, no CLP changes).
  lockSchemas: true,
  // Keep unknown classes (e.g. internal ones) and never drop data automatically.
  strict: false,
  deleteExtraFields: false,
  recreateModifiedFields: false,
};
