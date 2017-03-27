"use strict";

const _ = require('lodash');
const db = require('./db');
const errors = require('./errors');
const Promise = require('bluebird');
const uuid = require('uuid');

const ModelBase = function () {
  this._isSaved = false;
  this._isPopulated = false;
};

ModelBase.prototype.key = function (key) {
  key = key || this[this.idField];
  if (key.indexOf(`${this.keyPrefix}:`) !== 0) {
    key = [this.keyPrefix, key].join(":");
  }
  return key;
};

ModelBase.prototype.load = function (key, options) {
  const self = this;
  options = options || {};
  return db.getModel(key)
    .tap(function (item) {
      if (!item) {
        throw new errors.NotFoundError("Object not found: " + key);
      }
      _.forOwn(self.properties, function (pprops, k) {
        self[k] = item[k];
      });
      self._isSaved = true;
    });
};

// "Unpopulate" all ModelBase-inherited objects by replacing them with object representations
ModelBase.prototype.unpopulate = function (options) {
  var self = this;
  options = options || {keyify: false};
  function objectify (obj) {
    if (_.isArray(obj)) {
      return obj.map(objectify);
    } else if (obj instanceof ModelBase) {
      if (options.keyify) {
        return obj.key();
      } else {
        return obj.serialize();
      }
    } else {
      return obj;
    }
  }
  _.forOwn(this.properties, function (pprops, p) {
    self[p] = objectify(self[p]);
  });
  this._isPopulated = false;
};

// Populate all ModelBase-inherited objects by replacing them with instantiated objects of correct subclass
ModelBase.prototype.populate = function (options) {
  var self = this;

  var promises = [];

  function objectify (obj, Type) {
    if (_.isArray(obj)) {
      return obj.map(function (o) {
        return objectify(o, Type);
      });
    } else if (Type.prototype instanceof ModelBase) {
      const newObject = new Type();
      let objectKey = obj; // populate from string.key
      if (obj instanceof Object) {
        objectKey = newObject.key(obj[newObject.idField]); // populate from object's .key property
      }
      promises.push(newObject.load(objectKey)
        .then(function () {
          return newObject.populate(options);
        }));
      return newObject;
    } else {
      return obj;
    }
  }
  _.forOwn(self.properties, function (pprops, p) {
    self[p] = objectify(self[p], pprops.type);
  });
  return Promise.all(promises)
    .then(function () {
      self._isPopulated = true;
    });
};


ModelBase.prototype.serialize = function () {
  this.unpopulate();
  return _.merge({key: this.key()}, _.pick(this, Object.keys(this.properties)));
};

ModelBase.prototype.keyify = function () {
  this.unpopulate({keyify: true});
  return _.merge({key: this.key()}, _.pick(this, Object.keys(this.properties)));
};

ModelBase.prototype.isSaved = function () {
  return Boolean(this._isSaved);
};

ModelBase.prototype.save = function (options) {
  const self = this;
  let props = this.keyify();
  props.modified = Date.now();
  // Filter out calculated fields that not to be saved to DB
  props = _.pickBy(props, function (v, k) {
    if (self.properties[k] && self.properties[k].shallow) {
      return false;
    }
    return true;
  });

  return db.saveModel(this.key(), props, options)
    .tap(function () {
      self._isSaved = true;
    });
};

const Player = function (name) {
  this.name = name;
  if (this.name) {
    this.name = this.name.replace(/^player:/, '');
    this.username = this.name.toLowerCase();
  }
};
Player.prototype = Object.create(ModelBase.prototype);
Player.prototype.keyPrefix = "player";
Player.prototype.idField = "username";
Player.prototype.properties = {
  "name": {type: String, required: true},
  "username": {type: String},
  "statNumberOfGames": {type: Number},
  "statNumberOfWins": {type: Number},
  "statCurrentStreak": {type: Number},
  "statWinPercentage": {type: Number, shallow: true}, // not saved to DB
};

Player.prototype.addToSeries = function (series) {
  const seriesKey = `series:${series}`;
  if (!this.isSaved()) {
    throw new errors.NotSavedError("Tried to use non-saved Player");
  }
  return db.addToListProperty(seriesKey, 'players', this.key());
};

Player.prototype.populate = function () {
  // Customized populate to add stats to player rows that are missing them
  ModelBase.prototype.populate.bind(this)();

  this.statWinPercentage = Math.floor(1000 * (this.statNumberOfWins / (this.statNumberOfGames || 1))) / 10;
};

const Series = function (name) {
  this.name = name;
  if (this.name) {
    this.name = this.name.replace(/^series:/, '');
  }
  this.players = [];
};
Series.prototype = Object.create(ModelBase.prototype);
Series.prototype.keyPrefix = "series";
Series.prototype.idField = "name";
Series.prototype.properties = {
  "name": {type: String, required: true},
  "players": {type: Player},
};

Series.prototype.save = function () {
  var self = this;
  return ModelBase.prototype.save.bind(this)()
    .tap(function (saved) {
      // Now add the saved series to serieslist
      return db.addToListProperty("serieslist", "series_keys", self.key())
        .catch(function (err) {
          // Series list missing, create it and add again
          if (err.code === "ValidationException") {
            return db.saveModel("serieslist", {series_keys: [self.key()], modified: Date.now()});
          }
          throw err;
        });
    });
};

Series.list = function () {
  return db.getModel("serieslist")
    .then(function (item) {
      if (!item) {
        return [];
      }
      return item.series_keys.map(function (s) {
        return _.split(s, ':')[1]; // Remove the "series:" key prefix
      });
    });
};

const Game = function (properties) {
  var self = this;
  if (properties) {
    _.forOwn(this.properties, function (pprops, k) {
      if (pprops.required && properties[k] === undefined) {
        throw new errors.RequiredPropertyMissingError("Missing property: " + k);
      }
      self[k] = properties[k];
    });
    if (self.goalsAway === self.goalsHome) {
        throw new errors.InvalidParamError("Draws are not allowed");
    }
    if (!this.uuid) {
      this.uuid = uuid.v4();
    }
    if (!this.timestamp) {
      this.timestamp = Date.now();
    }
  }
};
Game.prototype = Object.create(ModelBase.prototype);
Game.prototype.keyPrefix = "game";
Game.prototype.idField = "uuid";
Game.prototype.properties = {
  "uuid": {type: String},
  "timestamp": {type: Number},
  "series": {type: Series, required: true},
  "teamAway": {type: String, required: true},
  "teamHome": {type: String, required: true},
  "goalsAway": {type: Number, required: true},
  "goalsHome": {type: Number, required: true},
  "playersAway": {type: Player, required: true},
  "playersHome": {type: Player, required: true},
};

Game.prototype.updatePlayerStats = function () {
  // Update player stats
  const winners = this.goalsAway > this.goalsHome ? this.playersAway : this.playersHome;
  const statPromises = this.playersAway.concat(this.playersHome).map(function (p) {
    const params = {
      "statNumberOfGames": {
        "step": 1,
      },
      "statCurrentStreak": {
        "step": -1,
      },
    };
    if (winners.indexOf(p) !== -1) {
      params.statNumberOfWins = {
        "step": 1,
      };
      params.statCurrentStreak = {
        "step": 1,
      };
    }
    // TODO fix resetting of streaks
    return db.incrementFields(p, params);
  });
  return Promise.all(statPromises);
};

module.exports = {
  Series: Series,
  Player: Player,
  Game: Game,
};

