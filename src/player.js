'use strict';

const common = require('./common');
const models = require('./models/index');
const addCORS = common.addCORS;

exports.create = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  if (!name) {
    return callback(null, common.getError(400, new Error("Required parameter(s) missing")));
  }
  const model = new models.Player(name);
  return model.save()
    .then(function () {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({data: model.serialize()}),
      }));
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

};

exports.get = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  const model = new models.Player(name);
  return model.load(name)
    .then(function () {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({
          "data": model.serialize(),
        })
      }));
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });
};

exports.addToSeries = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  const player = new models.Player(name);
  const series = new models.Series(name);
  return common.parseBody(event.body)
    .then(function (params) {
      return Promise.all([
        player.load(name),
        series.load(params.series),
      ]);
    })
    .then(function () {
      return player.addToSeries(series.name);
    })
    .then(function () {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({
          "data": {},
        })
      }));
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

};

