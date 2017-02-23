"use strict";

function NotSavedError (message) {
  this.message = message;
  this.statusCode = 500;
}
NotSavedError.prototype = Object.create(Error.prototype);
module.exports.NotSavedError = NotSavedError;
