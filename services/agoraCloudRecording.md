
POST
start
https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//mode/{{mode-type}}/start
Call the start method within five minutes after getting the resource ID to join a channel and start the recording.

If this method call succeeds, you get a recording ID (sid) from the HTTP response body.

Note: Agora Cloud Recording does not support string usernames (User Accounts). Ensure that every user in the channel has an integer UID. When you call the start method, ensure that the UID in the quotation marks is an integer UID, too.

AUTHORIZATION
Basic Auth
Username
{{CustomerID}}

Password
{{CustomerSecret}}

HEADERS
Content-Type
application/json

Body
raw
View More
{
    "cname": "{{AccessChannel}}",
    "uid": "{{RecordingUID}}",
    "clientRequest": {
        "token": "",
        "recordingConfig": {
            "channelType": 0,
            "streamTypes": 2,
            "videoStreamType": 0,
            "streamMode": "standard", //remove before running or it won't work. Standard mode creates a MPD with WebM, removing steamMode creates M3U8 with TS
            "maxIdleTime": 120,
            "subscribeVideoUids": [
                "#allstream#"
            ],
            "subscribeAudioUids": [
                "#allstream#"
            ],
            "subscribeUidGroup": 0
        },
        "storageConfig": {
            "vendor": {{StorageVendor}},
            "region": {{StorageRegion}},
            "bucket": "{{Bucket}}",
            "accessKey": "{{AccessKey}}",
            "secretKey": "{{SecretKey}}"
        }
    }
}
Example Request
start
View More
curl
curl --location -g 'https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//mode/{{mode-type}}/start' \
--header 'Content-Type: application/json' \
--data '{
    "cname": "{{AccessChannel}}",
    "uid": "{{RecordingUID}}",
    "clientRequest": {
        "token": "",
        "recordingConfig": {
            "channelType": 0,
            "streamTypes": 2,
            "videoStreamType": 0,
            "streamMode": "standard", //remove before running or it won'\''t work. Standard mode creates a MPD with WebM, removing steamMode creates M3U8 with TS
            "maxIdleTime": 120,
            "subscribeVideoUids": [
                "#allstream#"
            ],
            "subscribeAudioUids": [
                "#allstream#"
            ],
            "subscribeUidGroup": 0
        },
        "storageConfig": {
            "vendor": {{StorageVendor}},
            "region": {{StorageRegion}},
            "bucket": "{{Bucket}}",
            "accessKey": "{{AccessKey}}",
            "secretKey": "{{SecretKey}}"
        }
    }
}'
Example Response
Body
Headers (0)
No response body
This request doesn't return any response body
POST
stop
https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//sid/{{sid}}/mode/{{mode-type}}/stop
Call the stop method to stop the recording.

If this method call succeeds, you get the M3U8 filename and the current uploading status from the HTTP response body.

Agora Cloud Recording automatically leaves the channel and stops recording when no user is in the channel for more than 30 seconds by default.

AUTHORIZATION
Basic Auth
Username
{{CustomerID}}

Password
{{CustomerSecret}}

HEADERS
Content-Type
application/json;charset=utf-8

Body
raw
{
    "cname": "{{AccessChannel}}",
    "uid": "{{RecordingUID}}",
    "clientRequest": {}
}
Example Request
stop
View More
curl
curl --location -g 'https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//sid/{{sid}}/mode/{{mode-type}}/stop' \
--header 'Content-Type: application/json;charset=utf-8' \
--data '{
    "cname": "{{AccessChannel}}",
    "uid": "{{RecordingUID}}",
    "clientRequest": {}
}'
Example Response
Body
Headers (0)
No response body
This request doesn't return any response body
GET
query
https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//sid/{{sid}}/mode/{{mode-type}}/query
During the recording, you can call the query method to check the recording status multiple times.

If this method call succeeds, you get the M3U8 filename and the current recording status from the HTTP response body.

AUTHORIZATION
Basic Auth
Username
{{CustomerID}}

Password
{{CustomerSecret}}

HEADERS
Content-Type
application/json


POST
updateLayout
https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//sid/{{sid}}/mode/{{mode-type}}/updateLayout
During a recording, you can call this method to update the video mixing layout multiple times.

This method call overrides the existing layout configurations.

For example, if you set the backgroundColor parameter as "#FF0000" (red) when starting a recording and call this method to update the layout without setting the backgroundColor parameter, the background color changes back to black (the default value).

The following parameters are required in the URL.

appid String The App ID used in the channel to be recorded.
resourceid String The resource ID requested by the acquire method.
sid String The recording ID created by the start method.
mode String The recording mode. Supports individual mode (individual) and composite mode (mix).
The following parameters are required in the request body.

cname String Name of the channel to be recorded.
uid String The UID of the recording client. A 32-bit unsigned integer ranging from 1 to (232-1) that is unique in the channel, for example "527841". Do not set it as "0"
clientRequest JSON Object A specific client request. See full details below.
clientRequest requires the following parameters:

maxResolutionUid (Optional) String. When the layoutType parameter is set as 2 (vertical layout), you can specify the UID of the large video window by this parameter.
mixedVideoLayout (Optional) Number. Sets the video mixing layout. 0, 1, and 2 are the predefined layouts. If you set this parameter as 3, you need to set the layout by the layoutConfig parameter.
0 (Default) Floating layout: The first user in the channel occupies the full canvas. The other users occupy the small regions on top of the canvas, starting from the bottom left corner. The small regions are arranged in the order of the users joining the channel. This layout supports one full-size region and up to four rows of small regions on top with four regions per row, comprising 17 users.
1 Best fit layout: This is a grid layout. The number of columns and rows and the grid size vary depending on the number of users in the channel. This layout supports up to 17 users.
2 Vertical layout: One large region is displayed on the left edge of the canvas, and several smaller regions are displayed along the right edge of the canvas. The space on the right supports up to 2 columns of small regions with 8 regions per column. This layout supports up to 17 users.
3 Customized layout: Set the layoutConfig parameter to customize the layout.
backgroundColor (Optional) String. The background color of the canvas (the display window or screen) in RGB hex value. The string starts with a "#". The default value is "#000000", the black color.
layoutConfig (Optional) JSONArray. An array of the configuration of each user's region. Supports 17 users at most. Each user's region configuration is a JSON object with the following parameters:
uid (Optional) String. The string contains the UID of the user displaying the video in the region. If this parameter is not specified, the configurations apply in the order of the users joining the channel.
x_axis (Mandatory) Float. Relative horizontal position of the top-left corner of the region. The value is between 0.0 (leftmost) and 1.0 (rightmost). x_axis can also be an integer 0 or 1.
y_axis (Mandatory) Float. Relative vertical position of the top-left corner of the region. The value is between 0.0 (top) and 1.0 (bottom). y_axis can also be an integer 0 or 1.
width (Mandatory) Float. Relative width of the region. The value is between 0.0 and 1.0. width can also be an integer 0 or 1.
height (Mandatory) Float. Relative height of the region. The value is between 0.0 and 1.0. height can also be an integer 0 or 1.
alpha (Optional) Float. The transparency of the image. The value is between 0.0 (transparent) and 1.0 (opaque). The default value is 1.0.
render_mode (Optional) Number. The video display mode:
0 (Default) Cropped mode: Uniformly scales the video until it fills the visible boundaries (cropped). One dimension of the video may have clipped contents.
1 Fit mode: Uniformly scales the video until one of its dimension fits the boundary (zoomed to fit). Areas that are not filled due to the disparity in the aspect ratio will be filled with black.
AUTHORIZATION
Basic Auth
Username
{{CustomerID}}

Password
{{CustomerSecret}}

HEADERS
Content-Type
application/json

Body
raw
View More
{
    "cname": "{{AccessChannel}}",
    "uid": "{{RecordingUID}}",
    "clientRequest": {
        "mixedVideoLayout": 3,
        "backgroundColor": "#FF0000",
        "layoutConfig": [
            {
                "uid": "1",
                "x_axis": 0.1,
                "y_axis": 0.1,
                "width": 0.1,
                "height": 0.1,
                "alpha": 1.0,
                "render_mode": 1
            },
            {
                "uid": "2",
                "x_axis": 0.2,
                "y_axis": 0.2,
                "width": 0.1,
                "height": 0.1,
                "alpha": 1.0,
                "render_mode": 1
            }
        ]
    }
}
Example Request
updateLayout
View More
curl
curl --location -g 'https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//sid/{{sid}}/mode/{{mode-type}}/updateLayout' \
--header 'Content-Type: application/json' \
--data '{
    "cname": "{{AccessChannel}}",
    "uid": "{{RecordingUID}}",
    "clientRequest": {
        "mixedVideoLayout": 3,
        "backgroundColor": "#FF0000",
        "layoutConfig": [
            {
                "uid": "1",
                "x_axis": 0.1,
                "y_axis": 0.1,
                "width": 0.1,
                "height": 0.1,
                "alpha": 1.0,
                "render_mode": 1
            },
            {
                "uid": "2",
                "x_axis": 0.2,
                "y_axis": 0.2,
                "width": 0.1,
                "height": 0.1,
                "alpha": 1.0,
                "render_mode": 1
            }
        ]
    }
}'
Example Response
Body
Headers (0)
No response body
This request doesn't return any response body
GET
query
https://api.agora.io/v1/apps/{{APPID}}/cloud_recording/resourceid//sid/{{sid}}/mode/{{mode-type}}/query
During the recording, you can call the query method to check the recording status multiple times.

If this method call succeeds, you get the M3U8 filename and the current recording status from the HTTP response body.

AUTHORIZATION
Basic Auth
Username
{{CustomerID}}

Password
{{CustomerSecret}}

HEADERS
Content-Type
application/json