"use strict";

var _ = require('lodash');
const db = require('./db');
const errors = require('./errors');

const ModelBase = function (a) {
  // no-op
};

ModelBase.prototype.key = function (id) {
  id = id || this[this.idField];
  return [this.keyPrefix, id].join(":");
};

ModelBase.prototype.load = function (id, options) {
  const self = this;
  return db.getModel(this.key(id))
    .tap(function (item) {
      console.log("GRGAG", item);
      _.forEach(self.properties, function (key) {
        self[key] = item[key];
      });
    });
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

  return db.saveModel(key, props)
    .tap(function () {
      self._isSaved = true;
    });
};

const Series = function (name) {
  this.name = name;
  this.players = [];
};
Series.prototype = Object.create(ModelBase.prototype);
Series.prototype.keyPrefix = "series";
Series.prototype.idField = "name";
Series.prototype.properties = [
  "name",
  "players",
];

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

const Player = function (name) {
  this.name = name;
  this.username = name.toLowerCase();
};
Player.prototype = Object.create(ModelBase.prototype);
Player.prototype.keyPrefix = "player";
Player.prototype.idField = "username";
Player.prototype.properties = [
  "name",
  "username",
];

Player.prototype.addToSeries = function (series) {
  const seriesKey = `series:${series}`;
  if (!this.isSaved()) {
    throw new errors.NotSavedError("Tried to use non-saved Player");
  }
  return db.addToListProperty(seriesKey, 'players', this.key());
};

module.exports = {
  Series: Series,
  Player: Player,
};


//const series = new Series("ööl");
//series.load().then(function(r) {console.log("FEAF", r);});
//const player = new Player("Junno");
//series.save()
  //.then(function () {
    //return player.save();
  //})
  //.then(function () {
    //player.addToSeries(series.name);
  //});
