FILES="telemetry_index_ping.js telemetry_schema.py telemetry_v2_schema.json"

aws s3 cp s3://telemetry-published-v2/telemetry_schema.json telemetry_v2_schema.json
wget -N https://raw.githubusercontent.com/vitillo/python_moztelemetry/master/moztelemetry/telemetry_schema.py
zip -jr lambda.zip $FILES

aws lambda upload-function \
  --function-name telemetry_index_ping \
  --description "Index Telemetry files in SimpleDB" \
  --function-zip lambda.zip \
  --runtime nodejs \
  --role arn:aws:iam::142069644989:role/lambda_telemetry_index_ping \
  --handler telemetry_index_ping.handler \
  --mode event \
  --timeout 5 \
  --memory-size 128 \
  --region us-west-2
