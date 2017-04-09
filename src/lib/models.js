"use strict";

const _ = require('lodash');
const db = require('./db');
const errors = require('./errors');
const Promise = require('bluebird');

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
  if (!options.table && this.table) {
    options.tableName = this.table;
  }
  return db.getModel(key, options)
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
      let objectKey = obj; // populate from string-key
      if (obj instanceof Object) {
        // FIXME, changed recently, may break tests
        //objectKey = newObject.key(obj[newObject.idField]); // populate from object's .key property
        objectKey = newObject.key(obj.key); // populate from object's .key property
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
  options = options || {};
  if (!options.table && this.table) {
    options.tableName = this.table;
  }
  const self = this;
  let props = this.keyify();
  // Filter out calculated fields that not to be saved to DB
  props = _.pickBy(props, function (v, k) {
    if (!self.properties[k] || self.properties[k].shallow) {
      return false;
    }
    return true;
  });
  props.modified = Date.now();

  if (!props.id) {
    props.id = this.key();
  }
  return db.saveModel(props, options)
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
  "stats": {type: Object, shallow: true}, // not saved to DB
};

Player.prototype.addToSeries = function (series) {
  const seriesKey = `series:${series}`;
  if (!this.isSaved()) {
    throw new errors.NotSavedError("Tried to use non-saved Player");
  }
  return db.addToListProperty(seriesKey, 'players', this.key());
};

Player.prototype.populate = function () {
  ModelBase.prototype.populate.bind(this)();
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
            return db.saveModel({id: "serieslist", series_keys: [self.key()], modified: Date.now()});
          }
          throw err;
        });
    });
};

Series.prototype.getGames = function (params) {
  params = _.merge({descending: true}, params);

  return db.queryModels(`game:${this.name}`, params)
  .then(function (games) {
    games = games.map(function (item) {
      return new Game(item);
    });
    return Promise.all(games.map(function (g) { return g.populate(); }))
      .then(function () {
        return games;
      });
  });
};

Series.prototype.calculatePlayerStats = function (games) {
  const self = this;
  this.players.forEach(function (p) { p.stats = {games: 0, wins: 0, streak: 0}; });
  const endedStreaks = {};

  games.forEach(function (g) {
    const winners = _.map(g.goalsAway > g.goalsHome ? g.playersAway : g.playersHome, 'username');
    const losers = _.map(g.goalsAway > g.goalsHome ? g.playersHome : g.playersAway, 'username');
    self.players.forEach(function (p) {
      if (winners.indexOf(p.username) !== -1) {
        p.stats.wins++;
        p.stats.games++;
        if (!endedStreaks[p.username]) {
          if (p.stats.streak >= 0) {
            // Continue streak
            p.stats.streak++;
          } else {
            // Losing streak ended
            endedStreaks[p.username] = true;
          }
        }
      } else if (losers.indexOf(p.username) !== -1) {
        p.stats.games++;
        if (!endedStreaks[p.username]) {
          if (p.stats.streak <= 0) {
            // Continue streak
            p.stats.streak--;
          } else {
            // Winning streak ended
            endedStreaks[p.username] = true;
          }
        }
      }
    });
  });
  this.players.forEach(function (p) {
    p.stats.winPercentage = Math.floor(1000 * ((p.stats.wins || 0) / (p.stats.games || 1))) / 10;
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
  const self = this;
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
    if (!this.id) {
      const seriesName = this.series.name || this.series.split(':')[1];
      this.id = `game:${seriesName}`;
    }
    if (!this.range) {
      this.range = Date.now();
    }
  }
};
Game.prototype = Object.create(ModelBase.prototype);
Game.prototype.keyPrefix = "game";
Game.prototype.table = "rangemodels";
Game.prototype.properties = {
  "id": {type: String},
  "range": {type: Number},
  "series": {type: Series, required: true},
  "teamAway": {type: String, required: true},
  "teamHome": {type: String, required: true},
  "goalsAway": {type: Number, required: true},
  "goalsHome": {type: Number, required: true},
  "playersAway": {type: Player, required: true},
  "playersHome": {type: Player, required: true},
};

Game.prototype.key = function (key) {
  if (!key) {
    let seriesName = this.series.name || this.series;
    if (seriesName.indexOf("series:") !== 0) {
      seriesName = seriesName.split(":")[1];
    }
    key = `game:${seriesName}:${this.range}`;
  }
  return key;
};

module.exports = {
  Series: Series,
  Player: Player,
  Game: Game,
};

