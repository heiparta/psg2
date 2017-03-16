'use strict';

const _ = require('lodash');

const allowedOrigins = [
  "https://psg-app.picklane.com",
  "http://localhost:8099",
];
module.exports.addCORS = function (event, response) {
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


