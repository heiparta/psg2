"use strict";

const AWS = require('aws-sdk');
const Promise = require('bluebird');

AWS.config.update({region: "eu-west-1"});
const dynamodb = new AWS.DynamoDB.DocumentClient();
Promise.promisifyAll(dynamodb);

module.exports.addSeriesToList = function (id) {
  var params = {
    TableName: process.env.MODELS_TABLE,
    Item: {
      id: "serieslist",
      modified: Date.now(),
    },
    ReturnValues: "ALL_NEW",
  };
  return dynamodb.updateAsync(params)
    .tap(function (response) {
      console.log("GRGG", response);
    });
};

module.exports.getModel = function (id) {
  var params = {
    TableName: process.env.MODELS_TABLE,
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id,
    },
  };
  console.log("Querying", params);
  return dynamodb.queryAsync(params)
    .then(function (result) {
      if (result.Items.length === 0) {
        return null;
      }
      // Expecting just one model
      return result.Items[0];
    });

};

module.exports.saveModel = function (id, item) {
  item.id = id;
  var params = {
    TableName: process.env.MODELS_TABLE,
    Item: item,
  };
  console.log("Saving", params);
  return dynamodb.putAsync(params);
};


