"use strict";

const db = require('./db');

const ModelBase = function () {
  // no-op
};

ModelBase.prototype.get = function (id, options) {
  return db.getModel(id);
};

const Series = function (props) {
  this.name = props.name;
};
Series.prototype = Object.create(ModelBase);

Series.prototype.save = 

Series.list = function () {
  return db.getModel("serieslist")
    .then(function (item) {
      return item ? item.series : [];
    });
};

module.exports = {
  Series: Series,
};

