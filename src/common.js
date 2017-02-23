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


