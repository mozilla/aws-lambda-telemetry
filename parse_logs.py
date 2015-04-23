# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import boto.logs
import time

from datetime import datetime

log_group_name = "/aws/lambda/telemetry_index_ping"
region = "us-west-2"
prefix = datetime.now().strftime("%Y/%m/%d/")


def get_streams(log_group_name, prefix):
    next_token = None

    while True:
        description = conn.describe_log_streams(log_group_name, log_stream_name_prefix=prefix, next_token=next_token)

        for stream in description["logStreams"]:
            yield stream["logStreamName"]

        next_token = description.get("nextToken", None)
        if not next_token:
            return


def get_events(stream):
    next_token = None

    while True:
        result = conn.get_log_events(log_group_name, stream, next_token=next_token)

        for event in result["events"]:
            yield event

        next_token = result.get("nextToken", None)
        if not next_token:
            return


if __name__ == "__main__":
    conn = boto.logs.connect_to_region(region)
    events = []

    streams = list(get_streams(log_group_name, prefix))
    for idx, stream in enumerate(get_streams(log_group_name, prefix)):
        for event in get_events(stream):
            if "error" in event["message"].lower():
                utc = datetime.utcfromtimestamp(event["timestamp"]/1000)
                time = utc.strftime("%Y/%m/%d %H:%S")
                events.append((time, event["message"]))
                print event["message"]
