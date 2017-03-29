"use strict";

const _ = require('lodash');
const AWS = require('aws-sdk');
const Promise = require('bluebird');
AWS.config.setPromisesDependency(Promise);

AWS.config.update({region: "eu-west-1"});
const dynamodb = new AWS.DynamoDB.DocumentClient();
Promise.promisifyAll(dynamodb);

function getTable(tableName) {
  return `${process.env.DEPLOYMENT}-${tableName}`;
}

module.exports.addToListProperty = function (id, propertyName, value) {
  const params = {
    TableName: getTable('models'),
    Key: {
      id: id,
    },
    ConditionExpression: "NOT contains (#pname, :singlevalue)",
    UpdateExpression: "SET #pname = list_append(#pname, :listvalue)",
    ExpressionAttributeNames: {
      "#pname": propertyName,
    },
    ExpressionAttributeValues: {
      ":singlevalue": value,
      ":listvalue": [value],
    },
  };
  return dynamodb.updateAsync(params)
    .catch(function (err) {
      if (err.code === "ConditionalCheckFailedException") {
        // Already exists in the list, all good
        return;
      }
      throw err;
    });
};

module.exports.getModel = function (id, options) {
  options = options || {};
  const params = {
    TableName: getTable(options.tableName || 'models'),
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id,
    },
  };
  if (options.range) {
    // Query one row
    params.KeyConditionExpression += " AND #range = :range";
    params.ExpressionAttributeNames = {"#range": "range"};
    params.ExpressionAttributeValues[":range"] = options.range;
  }
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

module.exports.saveModel = function (item, options) {
  options = options || {};
  if (!options.upsert) {
    options.upsert = 'overwrite'; // Overwrite items by default
  }
  const params = {
    TableName: getTable(options.tableName || 'models'),
    Item: item,
  };
  if (options.upsert !== "overwrite") {
    params.ConditionExpression = "attribute_not_exists(id)";
  }
  console.log("Saving", params);
  return dynamodb.putAsync(params)
    .catch(function (err) {
      if (err.code === "ConditionalCheckFailedException" && options.upsert === "ignore") {
        // Already exists, expected to ignore error
        return;
      }
      throw err;
    });
};

// "increments" is an object with following signature:
// {
//   "attribute": name of the attribute to increment
//   "step": amount to increment
// }
module.exports.incrementFields = function (id, increments) {
  const params = {
    TableName: getTable('models'),
    Key: {id: id},
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {},
    ReturnValues: "ALL_NEW",
  };
  const expressionParts = [];
  _.forEach(increments, function (opts, key) {
    params.ExpressionAttributeNames["#" + key] = key;
    params.ExpressionAttributeValues[":" + key + "step"] = opts.step;
    expressionParts.push(`#${key} :${key}step`);
  });
  params.UpdateExpression = "ADD " + expressionParts.join(', ');
  return dynamodb.update(params).promise()
    .then(function (result) {
      return result.Attributes;
    });
};
