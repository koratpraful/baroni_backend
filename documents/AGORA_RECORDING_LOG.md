# Agora Recording Log File

Recording-only logs are written to **`logs/agora-recording.log`** (created automatically under project root). This file contains **only** Agora cloud recording flow events—no other app logs—so you can trace and fix recording issues easily.

## Flow (RTC token → video call start → recording → call end)

1. **RTC token request** – Client requests token to join the channel.
2. **Recording decision** – Backend decides to start recording (or skip) based on appointment + payment.
3. **Acquire** – Agora `acquire` API to get `resourceId`.
4. **Start** – Agora `start` API to start recording (get `sid`).
5. **Call in progress** – Optional: `reportCallDuration` can also start recording if not already started.
6. **Call end** – `reportCallDuration` with `endCall: true` or **Cancel appointment** → Stop recording.
7. **Stop** – Agora `stop` API; files are uploaded to your storage.

## Log format

Each line:

```
<ISO timestamp> <STEP> <optional JSON context> <optional message>
```

## Step names (RecordingSteps)

| Step | Meaning |
|------|--------|
| `RTC_TOKEN_REQUEST` | Client requested RTC token (channel, userId, uid). |
| `RTC_TOKEN_GENERATED` | Token was generated successfully. |
| `RTC_TOKEN_ERROR` | Token generation failed. |
| `RECORDING_START_REQUESTED` | Recording start triggered from token request (appointment channel). |
| `RECORDING_SKIPPED` | Recording not started (conditions not met or non-appointment channel). |
| `RECORDING_STARTED_FROM_TOKEN` | Recording started successfully from token flow (resourceId, sid saved). |
| `RECORDING_FAILED_FROM_TOKEN` | Recording start failed when triggered from token. |
| `ACQUIRE_START` | Agora acquire API called. |
| `ACQUIRE_SUCCESS` | Resource ID acquired. |
| `ACQUIRE_FAIL` | Acquire failed (see message). |
| `START_RECORDING_REQUEST` | Start recording API called. |
| `START_SUCCESS` | Recording started (sid received). |
| `START_FAIL` | Start recording failed. |
| `STOP_REQUEST` | Stop recording API called. |
| `STOP_SUCCESS` | Recording stopped; file list in response. |
| `STOP_FAIL` | Stop failed (e.g. network, invalid sid). |
| `STOP_NO_DATA` | Stop returned “no recorded data” (channel was empty). |
| `STOP_ALREADY_STOPPED` | Stop returned 404 (session already stopped/expired). |
| `DURATION_REPORT_RECEIVED` | **Every** reportCallDuration request (appointmentId, durationInSeconds, endCall). Use this to see if the backend received `endCall: true` when the user hung up. |
| `REPORT_DURATION` | Not used currently (logic uses RECORDING_LOGIC_*). |
| `RECORDING_LOGIC_CALL_START` | reportCallDuration: call in progress (not end). |
| `RECORDING_LOGIC_CALL_END` | reportCallDuration: call ending (endCall or duration). |
| `RECORDING_START_VIA_DURATION` | Recording started from reportCallDuration (not from token). |
| `RECORDING_STOP_VIA_END_CALL` | Stopping recording because call ended (reportCallDuration endCall). |
| `RECORDING_STOP_SKIPPED` | Backend received endCall but no active recording to stop (resourceId/sid missing or status not recording). |
| `RECORDING_STOP_ON_CANCEL` | Stopping recording because appointment was cancelled. |
| `QUERY_RECORDING` | Query recording status API called. |

## Example: successful flow

```
2025-02-05T10:00:00.000Z RTC_TOKEN_REQUEST {"userId":"...","channel":"appointment_abc123","uid":123} RTC token request
2025-02-05T10:00:00.001Z RECORDING_START_REQUESTED {"appointmentId":"abc123","channel":"appointment_abc123"} starting recording on token request
2025-02-05T10:00:00.002Z ACQUIRE_START {"channel":"appointment_abc123"} acquire resource
2025-02-05T10:00:00.500Z ACQUIRE_SUCCESS {"channel":"appointment_abc123","resourceId":"xxx"} resource acquired
2025-02-05T10:00:00.501Z START_RECORDING_REQUEST {"channel":"appointment_abc123","resourceId":"xxx","mode":"mix"} start recording
2025-02-05T10:00:01.200Z START_SUCCESS {"channel":"appointment_abc123","resourceId":"xxx","sid":"yyy","mode":"mix"} recording started
2025-02-05T10:00:01.201Z RTC_TOKEN_GENERATED {"channel":"appointment_abc123","uid":123} token generated
2025-02-05T10:00:01.202Z RECORDING_STARTED_FROM_TOKEN {"appointmentId":"abc123","channel":"appointment_abc123","resourceId":"xxx","sid":"yyy"} recording started from RTC token flow
...
2025-02-05T10:05:00.000Z RECORDING_LOGIC_CALL_END {"appointmentId":"abc123","durationInSeconds":300,"endCall":true,"shouldEndCall":true} call end path
2025-02-05T10:05:00.001Z RECORDING_STOP_VIA_END_CALL {"appointmentId":"abc123","channel":"appointment_abc123","resourceId":"xxx","sid":"yyy"} stopping recording - call ended
2025-02-05T10:05:00.002Z STOP_REQUEST {"channel":"appointment_abc123","resourceId":"xxx","sid":"yyy","mode":"mix"} stop recording
2025-02-05T10:05:00.800Z STOP_SUCCESS {"channel":"appointment_abc123","resourceId":"xxx","sid":"yyy","filesCount":1} recording stopped
```

## Why is there no STOP in my log? (Recording never stopped)

If you see `RECORDING_STARTED_FROM_TOKEN` and `RECORDING_LOGIC_CALL_START` (duration update) but **no** `RECORDING_LOGIC_CALL_END`, `RECORDING_STOP_VIA_END_CALL`, or `STOP_SUCCESS`, the backend never received “call ended”:

1. **Check `DURATION_REPORT_RECEIVED`**  
   You should see one line per duration request. When the user ends the call, the app must send **one more** request with **`endCall: true`** (and optionally the final `callDuration`).  
   - If you only see `DURATION_REPORT_RECEIVED` with `endCall: false`, the **frontend is not calling the complete-appointment (report duration) API with `endCall: true`** when the user hangs up. Fix: when the user leaves the channel / ends the call, call the same endpoint with `endCall: true`.
2. **Correct API**  
   Same endpoint as “add duration” (e.g. `POST /api/appointments/:id/complete` or your report-call-duration route). Body must include `endCall: true` when the call ends.

## Tips

- **Channel mismatch**: If you see `STOP_NO_DATA` or empty files, check that the **channel name** used when starting recording matches exactly what the client uses to join (e.g. `appointment_<id>` vs raw `id`).
- **Recording not starting**: Look for `RECORDING_SKIPPED` (conditions) or `ACQUIRE_FAIL` / `START_FAIL` (credentials or storage).
- **Duplicate start**: Recording can be started either when the client requests the RTC token or when the first `reportCallDuration` is sent; the log shows which path was used.
- The `logs/` folder and `*.log` files are in `.gitignore`; they are not committed.
