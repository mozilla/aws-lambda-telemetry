#!/bin/sh

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

if [ $# -eq 0 ]
then
    echo "No arguments supplied"
    exit 1
fi

cd ..

FILES="telemetry_index_ping.js telemetry_schema.py telemetry_v2_schema.json telemetry_v4_schema.json telemetry_v4_release_schema.json node_modules/ schema/"
FUNCTION_NAME=telemetry_index_ping
METADATA_BUCKET=net-mozaws-prod-us-west-2-pipeline-metadata
INSTANCE_PROFILE=$1

aws s3 cp s3://$METADATA_BUCKET/sources.json sources.json

for source in telemetry telemetry-release
do
    bucket=$(jq -r ".\"$source\" | .bucket" sources.json)
    prefix=$(jq -r ".\"$source\" | .prefix" sources.json)
    dir=schema/$bucket/$prefix

    mkdir -p $dir
    aws s3 cp s3://$METADATA_BUCKET/$prefix/schema.json $dir
done

npm install node-uuid aws-sdk-promise promise
wget -N https://raw.githubusercontent.com/mozilla/telemetry-tools/master/telemetry/telemetry_schema.py
zip -r lambda.zip $FILES

aws lambda delete-function --function-name $FUNCTION_NAME || true

aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime nodejs \
  --role $INSTANCE_PROFILE \
  --handler telemetry_index_ping.handler \
  --description "Index Telemetry files in SimpleDB" \
  --timeout 15 \
  --zip-file fileb://lambda.zip \
  --memory-size 128 \
  --region us-west-2
