/*jslint node: true */
"use strict";

const _ = require('lodash');
const crypto = require('crypto');
const db = require('./db');
const errors = require('./errors');
const Promise = require('bluebird');

const pbkdf2 = _.partialRight(Promise.promisify(crypto.pbkdf2), 10000, 512, 'sha512');

module.exports.saveUser = function (user, password, properties) {
  const salt = crypto.randomBytes(32).toString('hex');
  return pbkdf2(password, salt)
    .then(function (hash) {
      hash = hash.toString('hex');
      return db.saveModel({
        id: `credentials:${user}`,
        user: user,
        salt: salt,
        hash: hash,
        data: properties,
      })
      .then(function (hash) {
        return {
          salt: salt,
          hash: hash,
        };
      });
    });
};

module.exports.validateUser = function (user, password) {
  return db.getModel(`credentials:${user}`)
    .then(function (creds) {
      if (creds === null) {
        throw new errors.ForbiddenError('Authentication failed');
      }
      return pbkdf2(password, creds.salt)
        .then(function (hash) {
          hash = hash.toString('hex');
          if (creds.hash !== hash) {
            throw new errors.ForbiddenError('Authentication failed');
          }
          return creds.data;
        });
    });
};

module.exports.createToken = function (user, ttl, properties) {
  const token = crypto.randomBytes(32).toString('hex');
  return db.saveModel({
    id: `token:${token}`,
    username: user,
    ttl: Math.floor(Date.now() / 1000) + (ttl || 365 * 24 * 3600),
    data: properties
  })
  .then(function (hash) {
    return token;
  });
};

module.exports.validateToken = function (token) {
  return db.getModel(`token:${token}`)
    .then(function (data) {
      if (!data.username) {
        throw new errors.ForbiddenError('Invalid token');
      }
      return {
        username: data.username,
        properties: data.data,
      };
    });
};
