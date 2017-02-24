'use strict';

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


