'use strict';

const common = require('./common');
const models = require('./models/index');

exports.create = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  if (!name) {
    return callback(null, common.getError(400, new Error("Required parameter(s) missing")));
  }
  const model = new models.Player(name);
  return model.save()
    .then(function () {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({data: model.serialize()}),
      });
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

};

exports.get = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  const model = new models.Player();
  return model.load(name)
    .then(function () {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          "data": model.serialize(),
        })
      });
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });
};

exports.addToSeries = function (event, context, callback) {
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
      return callback(null, common.getError(err.statusCode, err));
    });

};

