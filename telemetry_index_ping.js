/* This Source Code Form is subject to the terms of the Mozilla Public
   License, v. 2.0. If a copy of the MPL was not distributed with this
   file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AWS = require('aws-sdk');
var exec = require('child_process').exec;
var uuid = require('node-uuid');
var simpledb = new AWS.SimpleDB();
var cloudwatchlogs = new AWS.CloudWatchLogs();

var v2DomainPrefix = "telemetry_v2_";
var logGroupName = "/aws/lambda/telemetry_index"

function formatError(key, error){
  return "Filename: " + key + " Error: " + error;
}

function logErrorAndExit(context, key, error) {
  var message = formatError(key, error);
  var logStreamName = "Errors_" + uuid.v1();
  var params = {
    logGroupName: logGroupName,
    logStreamName: logStreamName
  }

  cloudwatchlogs.createLogStream(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      context.fail(message);
      return;
    }

    params = {
      logEvents: [{
        message: message,
        timestamp: new Date().getTime()
      }],
      logGroupName: logGroupName,
      logStreamName: logStreamName
    };

    cloudwatchlogs.putLogEvents(params, function(err, data) {
      if (err) {
        console.log(err, err.stack);
      }

      context.fail(message);
    });
  });
}

exports.handler = function(event, context) {
  var srcBucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;

  exec('python telemetry_schema.py telemetry_v2_schema.json ' + key, function callback(error, stdout, stderr){
    if (error) {
      return logErrorAndExit(context, key, stderr);
    }

    var dims = JSON.parse(stdout);
    var domain = v2DomainPrefix + dims["submission_date"].substring(0, dims["submission_date"].length - 2);

    // Ensure domain exists
    simpledb.createDomain({"DomainName": domain}, function(error, data) {
      /*if (error) {
        return logErrorAndExit(context, key, error);
      }*/

      // Add file to index
      var params = {"Attributes": [], "DomainName": domain, "ItemName": key};
      for (var prop in dims) {
        params["Attributes"].push({"Name": prop, "Value": dims[prop]});
      }

      simpledb.putAttributes(params, function (error) {
        if (error) {
          return logErrorAndExit(context, key, error);
        }

        context.succeed(params);
      });
    });
  });
};
