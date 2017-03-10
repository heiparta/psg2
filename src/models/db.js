"use strict";

const AWS = require('aws-sdk');
const Promise = require('bluebird');

AWS.config.update({region: "eu-west-1"});
const dynamodb = new AWS.DynamoDB.DocumentClient();
Promise.promisifyAll(dynamodb);

module.exports.addToListProperty = function (id, propertyName, value) {
  var params = {
    TableName: process.env.MODELS_TABLE,
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


