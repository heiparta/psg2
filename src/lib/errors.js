"use strict";

function RequiredPropertyMissingError (message) {
  this.message = message;
  this.statusCode = 400;
}
RequiredPropertyMissingError.prototype = Object.create(Error.prototype);
module.exports.RequiredPropertyMissingError = RequiredPropertyMissingError;

function InvalidParamError (message) {
  this.message = message;
  this.statusCode = 400;
}
InvalidParamError.prototype = Object.create(Error.prototype);
module.exports.InvalidParamError = InvalidParamError;

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