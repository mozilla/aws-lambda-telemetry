/* This Source Code Form is subject to the terms of the Mozilla Public
   License, v. 2.0. If a copy of the MPL was not distributed with this
   file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var AWS = require('aws-sdk-promise');
AWS.config.update({region: 'us-west-2'});
var uuid = require('node-uuid');
var Promise = require('promise');
var exec = require('child_process').exec;
var fs = require('fs');
var assert = require('assert');

var simpledb = new AWS.SimpleDB();
var cloudwatchlogs = new AWS.CloudWatchLogs();
var logGroupName = "/aws/lambda/telemetry_index_ping";
var prodBucket = "net-mozaws-prod-us-west-2-pipeline-data";

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
    };

    return cloudwatchlogs.createLogStream(params).promise().then(function (req) {
        params = {
            logEvents: [{
                message: message,
                timestamp: new Date().getTime()
            }],
            logGroupName: logGroupName,
            logStreamName: logStreamName
        };
        return cloudwatchlogs.putLogEvents(params).promise();
    }).then(function() {
        context.fail(message);
    }, function(error) {
        console.log(error);
        context.fail(message);
    });
}

function mapPrefix2Domain(prefix, submissionDate) {
    prefix = prefix == "telemetry-2" ? "telemetry_v4" : prefix;  // Backwards compatibility
    return prefix + "_" + submissionDate.substring(0, submissionDate.length - 2);
}

exports.handler = function(event, context) {
    var srcBucket = event.Records[0].s3.bucket.name;
    var key = event.Records[0].s3.object.key;
    var path = key.split('/');
    var prefix = path[0];
    var params = null;
    var command = null;
    var prefixes = fs.readdirSync("schema");

    console.log("Bucket: ", srcBucket);
    console.log("Key: ", key);

    if (srcBucket == prodBucket) {
        if (prefixes.indexOf(prefix) != -1) {
            command = "python telemetry_schema.py schema/" + prefix + "/schema.json " + path.slice(1).join("/");
        } else {
            context.succeed(params || "Submission ignored (unknown prefix)");
            return;
        }
    } else {
        context.succeed(params || "Submission ignored (unknown bucket)");
        return;
    }

    exec_promise(command)
        .then(function(stdout) {
            var dims = JSON.parse(stdout);
            dims["lambda"] = "true";

            var domain = mapPrefix2Domain(prefix, dims["submissionDate"]);
            params = {"Attributes": [], "DomainName": domain, "ItemName": key};
            for (var prop in dims) {
                params["Attributes"].push({"Name": prop, "Value": dims[prop]});
            }
            return simpledb.putAttributes(params).promise();  // Add file to index
        }).then(function () {
            context.succeed(params || "Submission ignored (idle-daily)");
        }).then(null, function(error) {
            return logErrorAndFail(context, key, error);
        });
};

if (require.main === module) {
    dummy_prerelease = {
        "Records": [
            {
                "s3": {
                    "object": {
                        "key": "telemetry-2/20150928/telemetry/4/saved_session/Firefox/nightly/44.0a1/20150927150205/20150928035224.316_ip-172-31-25-174"
                    },
                    "bucket": {
                        "name": prodBucket
                    }
                }
            }
        ]
    };

    dummy_release = {
        "Records": [
            {
                "s3": {
                    "object": {
                        "key": "telemetry-release/20150928/telemetry/4/saved_session/Firefox/release/41.0/20150917150946/false/17/0150928070449.834_ip-172-31-43-23"
                    },
                    "bucket": {
                        "name": prodBucket
                    }
                }
            }
        ]
    };

    var dummy_context = {"succeed": function() {console.log.apply(this, arguments)},
                         "fail": function() {console.log.apply(this, arguments) && assert(false)}};
    exports.handler(dummy_prerelease, dummy_context);
    exports.handler(dummy_release, dummy_context);
}
