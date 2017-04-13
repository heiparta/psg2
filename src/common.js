'use strict';

const _ = require('lodash');
const auth = require('./lib/auth');
const errors = require('./lib/errors');

const allowedOrigins = [
  "https://psg-app.picklane.com",
  "http://localhost:8099",
];

const addCORS = module.exports.addCORS = function (event, response) {
  const origin = event.headers.Origin || event.headers.origin;
  if (allowedOrigins.indexOf(origin) !== -1) {
    response.headers = _.merge({"Access-Control-Allow-Origin": origin}, response.headers);
  }
  return response;
};

module.exports.getError = function (statusCode, err) {
  const body = {
    "error": err
  };
  console.error({err: err, statusCode: statusCode}, "Returning error");
  return ({
    statusCode: statusCode,
    body: JSON.stringify(body),
  });
};

module.exports.parseBody = function (raw) {
  return Promise.resolve()
    .then(function () {
      return JSON.parse(raw);
    });
};

function sendResponse(event, response, callback) {
    if (response instanceof Error) {
      response = module.exports.getError(response.statusCode || 500, response);
    }
    response = addCORS(event, response);
    callback(null, response);
}

module.exports.createAuthorizedHandler = function (func) {
  return function (event, context, callback) {
    const authorization = event.headers.Authorization || "";
    const token = authorization.split(' ')[1];
    if (!token) {
      return sendResponse(event, new errors.UnauthorizedError("Missing authorization token"), callback);
    }
    auth.validateToken(token)
      .then(function (data) {
        context.username = data.username;
        context.userProperties = data.properties;
        func(event, context, function (err, response) {
          sendResponse(event, err || response, callback);
        });
      })
      .catch(function (err) {
        sendResponse(event, err, callback);
      });
  };
};

module.exports.createHandler = function (func) {
  return function (event, context, callback) {
    Promise.resolve()
      .then(function () {
        func(event, context, function (err, response) {
          sendResponse(event, err || response, callback);
        });
      })
      .catch(function (err) {
        sendResponse(event, err, callback);
      });
  };
};
