'use strict';

const common = require('./common');
const db = require('./lib/db');
const errors = require('./lib/errors');
const models = require('./lib/models');
const addCORS = common.addCORS;

exports.create = function (event, context, callback) {
  let game;
  return common.parseBody(event.body)
    .then(function (params) {
      if (!params) {
        throw new errors.RequiredPropertyMissingError("Missing property: series");
      }
      game = new models.Game(params);
      return game.populate(); // Populate to verify all keys
    })
    .then(function () {
      return game.save();
    })
    .then(function () {
      // Update player stats
      const winners = game.goalsAway > game.goalsHome ? game.playersAway : game.playersHome;
      const statPromises = game.playersAway.concat(game.playersHome).map(function (p) {
        const params = {
          "statNumberOfGames": {
            "step": 1,
          },
        };
        if (winners.indexOf(p) !== -1) {
          params.statNumberOfWins = {
            "step": 1,
          };
        }
        return db.incrementFields(p, params);
      });
      return Promise.all(statPromises);
    })
    .then(function () {
      return callback(null, addCORS(event, {
        statusCode: 200,
        body: JSON.stringify({data: game.serialize()}),
      }));
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

};

exports.get = function (event, context, callback) {
  const id = decodeURI(event.pathParameters.id);
  const model = new models.Game();
  return model.load(model.key(id))
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

