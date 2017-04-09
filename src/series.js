'use strict';

const common = require('./common');
const models = require('./lib/models');
const addCORS = common.addCORS;

exports.create = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  if (!name) {
    return callback(null, common.getError(400, new Error("Required parameter(s) missing")));
  }
  const series = new models.Series(name);
  return series.save()
    .then(function () {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({data: series.serialize()}),
      }));
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

};

exports.get = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  const series = new models.Series();
  return series.load(series.key(name))
    .then(function () {
      return series.populate(); // Populate player data
    })
    .then(function () {
      const params = {};
      if (event.queryStringParameters.stats_days) {
        // Query games newer than X days
        const queryDate = new Date();
        queryDate.setHours(0, 0, 0, 0);
        queryDate.setDate(queryDate.getDate() - (event.queryStringParameters.stats_days - 1));
        params.moreThan = queryDate.getTime();
      }
      return series.getGames(params);
    })
    .then(function (games) {
      series.calculatePlayerStats(games);
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({
          "data": series.serialize(),
        })
      }));
    })
    .catch(function (err) {
      console.trace("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });
};

exports.games = function (event, context, callback) {
  const name = decodeURI(event.pathParameters.name);
  const series = new models.Series();
  return series.load(series.key(name))
    .then(function () {
      return series.getGames({limit: 30});
    })
    .then(function (games) {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({
          "data": games,
        })
      }));
    })
    .catch(function (err) {
      console.trace("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });
};

exports.list = function (event, context, callback) {
  return models.Series.list()
    .then(function (response) {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({
          "data": response,
        })
      }));
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

};

