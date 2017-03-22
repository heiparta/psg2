/*jslint node: true */
"use strict";

const bcrypt = require('bcrypt');
const db = require('./db');
const errors = require('./errors');

module.exports.saveUser = function (user, password, properties) {
  const salt = bcrypt.genSaltSync();
  const hash = bcrypt.hashSync(password, salt);
  return db.saveModel(`credentials:${user}`, {
    user: user,
    salt: salt,
    hash: hash,
    data: properties,
  })
  .then(function () {
    return {
      salt: salt,
      hash: hash,
    };
  });
};

module.exports.validateUser = function (user, password) {
  return db.getModel(`credentials:${user}`)
    .then(function (creds) {
      if (creds === null) {
        throw new errors.ForbiddenError('Authentication failed');
      }
      if (creds.hash !== bcrypt.hashSync(password, creds.salt)) {
        throw new errors.ForbiddenError('Authentication failed');
      }
      return creds.data;
    });
};

