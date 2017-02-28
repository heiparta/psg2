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
  var key = options.isKey ? id : this.key(id);
  return db.getModel(key)
    .tap(function (item) {
      if (!item) {
        throw new errors.NotFoundError("Object not found: " + self.key(id));
      }
      _.forOwn(self.properties, function (Type, key) {
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
  _.forOwn(this.properties, function (Type, p) {
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
  _.forOwn(props, function (Type, p) {
    self[p] = objectify(self[p], Type);
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
  return _.pick(this, this.properties);
};

ModelBase.prototype.isSaved = function () {
  return Boolean(this._isSaved);
};

ModelBase.prototype.save = function () {
  const self = this;
  const key = [this.keyPrefix, this[this.idField]].join(":");
  const props = this.serialize();
  props.modified = Date.now();

  const populatePromise = this._isPopulated ? this.unpopulate() : Promise.resolve;

  return populatePromise
    .then(function () {
      return db.saveModel(key, props);
    })
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
  "name": String,
  "username": String,
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
  "name": String,
  "players": Player,
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
      return item ? item.series : [];
    });
};

const Game = function (properties) {
  var self = this;
  if (properties) {
    _.forOwn(this.properties, function (v, k) {
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
  "id": String,
  "timestamp": Number,
  "series": Series,
  "teamAway": String,
  "teamHome": String,
  "goalsAway": Number,
  "goalsHome": Number,
  "playersAway": Player,
  "playersHome": Player,
};

module.exports = {
  Series: Series,
  Player: Player,
  Game: Game,
};

