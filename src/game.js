'use strict';

const common = require('./common');
const errors = require('./lib/errors');
const models = require('./lib/models');
const addCORS = common.addCORS;

exports.create = function (event, context, callback) {
  let model;
  return common.parseBody(event.body)
    .then(function (params) {
      if (!params) {
        throw new errors.RequiredPropertyMissingError("Missing property: series");
      }
      model = new models.Game(params);
      return model.populate(); // Populate to verify all keys
    })
    .then(function () {
      return model.save();
    })
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

