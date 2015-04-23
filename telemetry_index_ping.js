/* This Source Code Form is subject to the terms of the Mozilla Public
   License, v. 2.0. If a copy of the MPL was not distributed with this
   file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AWS = require('aws-sdk');
var exec = require('child_process').exec;
var simpledb = new AWS.SimpleDB();

var v2DomainPrefix = "telemetry_v2_";

exports.handler = function(event, context) {
  var srcBucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;

  exec('python telemetry_schema.py telemetry_v2_schema.json ' + key, function callback(error, stdout, stderr){
    if (error) {
      context.fail(stderr);
    }

    var dims = JSON.parse(stdout);
    var domain = v2DomainPrefix + dims["submission_date"].substring(0, dims["submission_date"].length - 2);
    var params = {"Attributes": [], "DomainName": domain, "ItemName": key};

    for (var prop in dims) {
      params["Attributes"].push({"Name": prop, "Value": dims[prop]});
    }

    simpledb.putAttributes(params, function (error) {
      if (error) {
        context.fail(error);
      }

      context.succeed(params);
    });
  });
};
