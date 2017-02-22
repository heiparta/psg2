"use strict";

var _ = require('lodash');
const db = require('./db');

let ModelBase = function (a) {
  // no-op
};

ModelBase.prototype.load = function (id, options) {
  let self = this;
  let key = [this.keyPrefix, id].join(":");
  return db.getModel(key)
    .then(function (item) {
      _.forEach(self.properties, function (key) {
        self[key] = item[key];
      });
    });
};

ModelBase.prototype.serialize = function () {
  return _.pick(this, this.properties);
};

ModelBase.prototype.save = function () {
  let key = [this.keyPrefix, this[this.idField]].join(":");
  let props = this.serialize();
  props.modified = Date.now();

  return db.saveModel(key, props)
    .tap(function (saved) {
      console.log("FEAF", saved);
      // Now add the saved series to serieslist
      //return db.addSeriesToList(response);
    });
};

let Series = function (name) {
  this.name = name;
};
Series.prototype = Object.create(ModelBase.prototype);
Series.prototype.keyPrefix = "series";
Series.prototype.idField = "name";
Series.prototype.properties = [
  "name",
];

Series.list = function () {
  return db.getModel("serieslist")
    .then(function (item) {
      return item ? item.series : [];
    });
};

module.exports = {
  Series: Series,
};
