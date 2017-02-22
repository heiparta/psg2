'use strict';

let models = require('./models/index');
console.log('Loading function');

let getError = function (statusCode, err) {
  let body = {
    "error": err
  };
  return ({
    statusCode: statusCode,
    body: JSON.stringify(body),
  });
};

exports.list = function (event, context, callback) {
  console.log('event', event);

  return models.Series.list()
    .then(function (response) {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          "data": response,
        })
      });
    })
    .catch(function (err) {
      return callback(null, getError(err.statusCode, err, context));
    });

};

exports.list(null, null, function (err, r) {console.log("GRAG", r);});
