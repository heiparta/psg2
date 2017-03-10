"use strict";

const _ = require('lodash');
const db = require('./db');
const errors = require('./errors');
const uuid = require('uuid');

const ModelBase = function () {
  this._isSaved = false;
  this._isPopulated = false;
};

ModelBase.prototype.key = function (id) {
  id = id || this[this.idField];
  return [this.keyPrefix, id].join(":");
};

ModelBase.prototype.load = function (id, options) {
  const self = this;
  options = options || {};
  const key = options.isKey ? id : this.key(id);
  return db.getModel(key)
    .tap(function (item) {
      if (!item) {
        throw new errors.NotFoundError("Object not found: " + self.key(id));
      }
      _.forOwn(self.properties, function (pprops, key) {
        self[key] = item[key];
      });
      self._isSaved = true;
    });
};

// "Unpopulate" all ModelBase-inherited objects by replacing them with their keys
ModelBase.prototype.unpopulate = function () {
  var self = this;
  function keyify (obj) {
    if (_.isArray(obj)) {
      return obj.map(keyify);
    } else if (obj instanceof ModelBase) {
      return obj.key();
    } else {
      return obj;
    }
  }
  _.forOwn(this.properties, function (pprops, p) {
    self[p] = keyify(self[p]);
  });
  this._isPopulated = false;
};

// Populate all ModelBase-inherited objects by replacing them with their keys
ModelBase.prototype.populate = function (props) {
  var self = this;
  props = props || self.properties;

  var promises = [];

  function objectify (obj, Type) {
    if (_.isArray(obj)) {
      return obj.map(function (o) {
        return objectify(o, Type);
      });
    } else if (Type.prototype instanceof ModelBase) {
      var newObject = new Type();
      promises.push(newObject.load(obj, {isKey: true})
        .then(function () {
          return newObject.populate();
        }));
      return newObject;
    } else {
      return obj;
    }
  }
  _.forOwn(props, function (pprops, p) {
    self[p] = objectify(self[p], pprops.type);
  });
  return Promise.all(promises)
    .then(function () {
      self._isPopulated = true;
    });
};

ModelBase.populate = function () {
  // no-op, inherited class must implement
};


ModelBase.prototype.serialize = function () {
  this.unpopulate();
  return _.pick(this, Object.keys(this.properties));
};

ModelBase.prototype.isSaved = function () {
  return Boolean(this._isSaved);
};

ModelBase.prototype.save = function () {
  const self = this;
  const key = [this.keyPrefix, this[this.idField]].join(":");
  const props = this.serialize();
  props.modified = Date.now();

  return db.saveModel(key, props)
    .tap(function () {
      self._isSaved = true;
    });
};

const Player = function (name) {
  this.name = name;
  if (this.name) {
    this.username = name.toLowerCase();
  }
};
Player.prototype = Object.create(ModelBase.prototype);
Player.prototype.keyPrefix = "player";
Player.prototype.idField = "username";
Player.prototype.properties = {
  "name": {type: String, required: true},
  "username": {type: String},
};

Player.prototype.addToSeries = function (series) {
  const seriesKey = `series:${series}`;
  if (!this.isSaved()) {
    throw new errors.NotSavedError("Tried to use non-saved Player");
  }
  return db.addToListProperty(seriesKey, 'players', this.key());
};


const Series = function (name) {
  this.name = name;
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
    if (!this.id) {
      this.id = uuid.v4();
    }
    if (!this.timestamp) {
      this.timestamp = Date.now();
    }
  }
};
Game.prototype = Object.create(ModelBase.prototype);
Game.prototype.keyPrefix = "game";
Game.prototype.idField = "id";
Game.prototype.properties = {
  "id": {type: String},
  "timestamp": {type: Number},
  "series": {type: Series, required: true},
  "teamAway": {type: String, required: true},
  "teamHome": {type: String, required: true},
  "goalsAway": {type: Number, required: true},
  "goalsHome": {type: Number, required: true},
  "playersAway": {type: Player, required: true},
  "playersHome": {type: Player, required: true},
};

module.exports = {
  Series: Series,
  Player: Player,
  Game: Game,
};

