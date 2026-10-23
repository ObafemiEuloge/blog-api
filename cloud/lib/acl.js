'use strict';

/**
 * ACL used for user-owned content: anyone can read, only the author can write.
 * @param {Parse.User | Parse.Pointer | { id: string }} author
 */
function publicReadAuthorWrite(author) {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setWriteAccess(author.id, true);
  return acl;
}

/** ACL for objects only Cloud Code may change: anyone can read, nobody can write. */
function publicReadOnly() {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  return acl;
}

module.exports = { publicReadAuthorWrite, publicReadOnly };
