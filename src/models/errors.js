"use strict";

function RequiredPropertyMissingError (message) {
  this.message = message;
  this.statusCode = 400;
}
RequiredPropertyMissingError.prototype = Object.create(Error.prototype);
module.exports.RequiredPropertyMissingError = RequiredPropertyMissingError;

function NotFoundError (message) {
  this.message = message;
  this.statusCode = 404;
}
NotFoundError.prototype = Object.create(Error.prototype);
module.exports.NotFoundError = NotFoundError;

function NotSavedError (message) {
  this.message = message;
  this.statusCode = 500;
}
NotSavedError.prototype = Object.create(Error.prototype);
module.exports.NotSavedError = NotSavedError;
