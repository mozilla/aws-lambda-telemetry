/* This Source Code Form is subject to the terms of the Mozilla Public
   License, v. 2.0. If a copy of the MPL was not distributed with this
   file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AWS = require('aws-sdk-promise');
AWS.config.update({region: 'us-west-2'});
var uuid = require('node-uuid');
var Promise = require('promise');
var exec = require('child_process').exec;

var simpledb = new AWS.SimpleDB();
var cloudwatchlogs = new AWS.CloudWatchLogs();

var v2DomainPrefix = "telemetry_v2_";
var logGroupName = "/aws/lambda/telemetry_index_ping";

function exec_promise(command) {
  return new Promise(function(resolve, reject) {
    exec(command, function(error, stdout, stderr) {
      if (error) reject(stderr);
      else resolve(stdout);
    });
  });
}

function logErrorAndFail(context, key, error) {
  var message = "Filename: " + key + " Error: " + error;
  var logStreamName = "Errors_" + uuid.v1();
  var params = {
    logGroupName: logGroupName,
    logStreamName: logStreamName
  }

  return cloudwatchlogs.createLogStream(params).promise().then(function (req) {
    params = {
      logEvents: [{
        message: message,
        timestamp: new Date().getTime()
      }],
      logGroupName: logGroupName,
      logStreamName: logStreamName
    };
    return cloudwatchlogs.putLogEvents(params).promise()
  }).then(function() {
    context.fail(message);
  }, function(error) {
    console.log(error);
    context.fail(message);
  });
}

exports.handler = function(event, context) {
  var srcBucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;
  var params = null;

  exec_promise('python telemetry_schema.py telemetry_v2_schema.json ' + key)
    .then(function(stdout) {
      var dims = JSON.parse(stdout);
      var domain = v2DomainPrefix + dims["submission_date"].substring(0, dims["submission_date"].length - 2);

      params = {"Attributes": [], "DomainName": domain, "ItemName": key};
      for (var prop in dims) {
        params["Attributes"].push({"Name": prop, "Value": dims[prop]});
      }
      return simpledb.putAttributes(params).promise();  // Add file to index
    }).then(function () {
      context.succeed(params);
    }).then(null, function(error) {
      return logErrorAndFail(context, key, error);
    });
};
