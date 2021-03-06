/*jslint node: true, expr: true */
/* global before, describe, it */
"use strict";
var expect = require("chai").expect;

var auth = require('../src/lib/auth');

var password = "sentme";
var user = "foobar";
var properties = {
  level: "user",
};

describe('Auth', function() {
  it('should save user credentials', function() {
    return auth.saveUser(user, password, properties)
      .then(function (creds) {
        expect(creds.salt).to.be.ok;
        expect(creds.hash).to.be.ok;
      });
  });

  it('should validate user', function() {
    return auth.validateUser(user, password)
      .then(function (userData) {
        expect(userData.level).to.equal(properties.level);
      });
  });

  it('should not validate with wrong pass', function() {
    return auth.validateUser(user, 'incorrect')
      .then(function (result) {
        throw new Error("Should have failed");
      })
      .catch((err) => {
        expect(err.statusCode).to.equal(403);
      });
  });

  it('should create token', function() {
    return auth.createToken(user, 1, properties)
      .then(function (token) {
        return auth.validateToken(token);
      })
      .then(function (data) {
        expect(data.username).to.equal(user);
        expect(data.properties.level).to.equal(properties.level);
      });
  });
});

