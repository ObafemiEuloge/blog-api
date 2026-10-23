'use strict';

/**
 * Throws a Parse VALIDATION_ERROR (142).
 * @param {string} message
 */
function validationError(message) {
  return new Parse.Error(Parse.Error.VALIDATION_ERROR, message);
}

/**
 * Trims a text field and checks its length.
 * @param {unknown} value raw value sent by the client
 * @param {string} field field name used in the error message
 * @param {{ min: number, max: number }} bounds inclusive length bounds, after trimming
 * @returns {string} the trimmed value
 */
function requireText(value, field, { min, max }) {
  if (typeof value !== 'string') {
    throw validationError(`${field} must be a string.`);
  }
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw validationError(`${field} must be between ${min} and ${max} characters.`);
  }
  return text;
}

/**
 * Checks that a cloud function parameter is a non-empty objectId string.
 * @param {unknown} value
 * @param {string} field
 */
function requireId(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(`${field} is required.`);
  }
  return value.trim();
}

module.exports = { validationError, requireText, requireId };
