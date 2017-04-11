'use strict';

const common = require('./common');
const auth = require('./lib/auth');
const models = require('./lib/models');

exports.handler = common.createHandler(function (event, context, callback) {
  return common.parseBody(event.body)
    .then(function (body) {
      const username = body.username;
      const password = body.password;
      if (!username || !password) {
        return callback(null, common.getError(400, new Error("Required parameter(s) missing")));
      }
      const player = new models.Player(username);
      return player.load(player.key())
        .then(function () {
          return auth.validateUser(username, password);
        })
        .then(function (data) {
          return auth.createToken(username, 10, data.properties); // TODO perhaps bit more than 10 seconds?
        })
        .then(function (token) {
          return callback(null, {
            statusCode: 200,
            body: JSON.stringify({data: {token: token, user: player.serialize()}}),
          });
        });
    })
    .catch(function (err) {
      console.log("Error in handler:", err);
      return callback(null, common.getError(err.statusCode, err));
    });

});


