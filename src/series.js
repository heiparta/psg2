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

exports.create = function (event, context, callback) {
  let name = event.pathParameters.name;
  if (!name) {
    return callback(null, getError(400, new Error("Required parameter(s) missing")));
  }
  let series = new models.Series(name);
  return series.save()
    .then(function () {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({data: series.serialize()}),
      });
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, getError(err.statusCode, err));
    });

};

exports.get = function (event, context, callback) {
  let name = event.pathParameters.name;
  let series = new models.Series();
  return series.load(name)
    .then(function () {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          "data": series.serialize(),
        })
      });
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, getError(err.statusCode, err));
    });
};

exports.list = function (event, context, callback) {
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
      console.log("Error in handler:", err);
      return callback(null, getError(err.statusCode, err));
    });

};

