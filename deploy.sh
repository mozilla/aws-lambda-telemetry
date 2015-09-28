#!/bin/sh

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

FILES="telemetry_index_ping.js telemetry_schema.py telemetry_v2_schema.json telemetry_v4_schema.json telemetry_v4_release_schema.json node_modules/"
FUNCTION_NAME=telemetry_index_ping

npm install node-uuid aws-sdk-promise promise
aws s3 cp s3://telemetry-published-v2/telemetry_schema.json telemetry_v2_schema.json
aws s3 cp s3://net-mozaws-prod-us-west-2-pipeline-metadata/telemetry-2/schema.json telemetry_v4_schema.json
aws s3 cp s3://net-mozaws-prod-us-west-2-pipeline-metadata/telemetry-release/schema.json telemetry_v4_release_schema.json
wget -N https://raw.githubusercontent.com/mozilla/telemetry-tools/master/telemetry/telemetry_schema.py
zip -r lambda.zip $FILES

aws lambda delete-function \
  --function-name $FUNCTION_NAME \

aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime nodejs \
  --role arn:aws:iam::142069644989:role/lambda_telemetry_index_ping \
  --handler telemetry_index_ping.handler \
  --description "Index Telemetry files in SimpleDB" \
  --timeout 10 \
  --zip-file fileb://lambda.zip \
  --memory-size 128 \
  --region us-west-2
