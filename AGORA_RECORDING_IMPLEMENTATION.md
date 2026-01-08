# Agora Cloud Recording Implementation - Verification & Testing Guide

## ✅ Implementation Summary

Agora Cloud Recording has been successfully integrated into the video call system. All video calls are now automatically recorded when they start and stopped when they end.

## 📋 Files Modified/Created

### 1. **`services/agoraCloudRecording.js`** (NEW)
   - Complete Agora Cloud Recording API service
   - Functions:
     - `acquireResource()` - Acquires recording resource ID
     - `startRecording()` - Starts recording session
     - `stopRecording()` - Stops recording and returns file info
     - `queryRecording()` - Queries recording status
     - `updateLayout()` - Updates recording layout (optional)
     - `startRecordingForChannel()` - Complete flow (acquire + start)

### 2. **`models/Appointment.js`** (MODIFIED)
   - Added recording fields:
     - `recordingResourceId` - Agora resource ID
     - `recordingSid` - Recording session ID
     - `recordingStatus` - Status: 'not_started', 'acquired', 'recording', 'stopped', 'failed'
     - `recordingFiles` - Array of recording file information
     - `recordingStartedAt` - Timestamp when recording started
     - `recordingStoppedAt` - Timestamp when recording stopped

### 3. **`controllers/appointment.js`** (MODIFIED)
   - **Start Recording**: When appointment status changes from `approved` → `in_progress`
   - **Stop Recording**: When appointment is cancelled
   - Prevents duplicate recording starts
   - Error handling: Recording failures don't break appointment flow

### 4. **`services/appointmentCompletionScheduler.js`** (MODIFIED)
   - **Stop Recording**: When appointment is completed (via cron job)
   - Stores recording file information in appointment document

## 🔄 Flow Diagram

```
1. Appointment Approved
   ↓
2. Call Starts (status: approved → in_progress)
   ↓
3. Start Recording
   ├─ Acquire Resource ID
   ├─ Start Recording Session
   └─ Store resourceId, sid, status='recording'
   ↓
4. Call in Progress
   ↓
5. Call Ends (status: completed OR cancelled)
   ↓
6. Stop Recording
   ├─ Stop Recording Session
   ├─ Get File Information
   └─ Store files, status='stopped'
```

## 🔧 Environment Variables Required

Add these to your `.env` file:

```env
# Existing Agora Config
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate

# NEW: Agora Cloud Recording Config
AGORA_CUSTOMER_ID=your_customer_id
AGORA_CUSTOMER_SECRET=your_customer_secret
AGORA_RECORDING_UID=999999  # Default: 999999 (integer UID for recording)

# NEW: Agora Storage Config
AGORA_STORAGE_VENDOR=0  # 0=Qiniu, 1=AWS, 2=Alibaba, 3=Tencent, 4=Kingsoft, 5=Azure, 6=Google, 7=Huawei
AGORA_STORAGE_REGION=0  # Storage region code
AGORA_STORAGE_BUCKET=your_bucket_name
AGORA_STORAGE_ACCESS_KEY=your_access_key
AGORA_STORAGE_SECRET_KEY=your_secret_key
```

## ✅ Features Implemented

1. **Automatic Recording Start**
   - Triggers when appointment status changes to `in_progress`
   - Channel name: `appointment_{appointmentId}`
   - Mode: `mix` (composite mode - single video file)

2. **Automatic Recording Stop**
   - Triggers when appointment is completed (via cron)
   - Triggers when appointment is cancelled
   - Stores recording file information

3. **Error Handling**
   - Recording failures don't break appointment flow
   - Status tracking: 'not_started', 'acquired', 'recording', 'stopped', 'failed'
   - Comprehensive logging for debugging

4. **Duplicate Prevention**
   - Checks if recording already started before starting new one
   - Prevents multiple recording sessions for same appointment

5. **File Information Storage**
   - Stores recording file names, track types, UIDs
   - Stores upload status
   - Accessible via appointment document

## 🧪 Testing Checklist

### Pre-Deployment Testing

- [ ] **Environment Variables**
  - [ ] All required env variables are set
  - [ ] Agora credentials are valid
  - [ ] Storage credentials are valid

- [ ] **Recording Start**
  - [ ] Create an appointment
  - [ ] Approve the appointment
  - [ ] Start call (status → in_progress)
  - [ ] Verify recording starts (check logs)
  - [ ] Verify `recordingResourceId` and `recordingSid` are stored
  - [ ] Verify `recordingStatus` = 'recording'

- [ ] **Recording Stop - Completion**
  - [ ] Complete appointment (duration >= 5 min)
  - [ ] Verify recording stops (check logs)
  - [ ] Verify `recordingStatus` = 'stopped'
  - [ ] Verify `recordingFiles` array is populated
  - [ ] Verify `recordingStoppedAt` timestamp is set

- [ ] **Recording Stop - Cancellation**
  - [ ] Start a call (recording should start)
  - [ ] Cancel the appointment
  - [ ] Verify recording stops (check logs)
  - [ ] Verify recording files are stored

- [ ] **Error Handling**
  - [ ] Test with invalid Agora credentials
  - [ ] Verify appointment still works (recording fails gracefully)
  - [ ] Verify `recordingStatus` = 'failed' on error

- [ ] **Edge Cases**
  - [ ] Multiple calls to start recording (should not duplicate)
  - [ ] Stop recording when already stopped (should handle gracefully)
  - [ ] Recording fails to start (appointment should continue)

## 📊 Recording Information Access

Recording information is stored in the Appointment document:

```javascript
{
  recordingResourceId: "resource_id_from_agora",
  recordingSid: "session_id_from_agora",
  recordingStatus: "stopped", // or 'recording', 'failed', etc.
  recordingFiles: [
    {
      fileName: "recording_file.m3u8",
      trackType: "audio_and_video",
      uid: "999999",
      mixedAllUser: true,
      isPlayable: true,
      sliceStartTime: 0
    }
  ],
  recordingStartedAt: ISODate("2025-01-XX..."),
  recordingStoppedAt: ISODate("2025-01-XX...")
}
```

## 🐛 Troubleshooting

### Recording Not Starting
1. Check environment variables are set correctly
2. Check Agora credentials are valid
3. Check logs for error messages
4. Verify `recordingStatus` in appointment document

### Recording Not Stopping
1. Check if `recordingResourceId` and `recordingSid` are present
2. Check logs for stop recording errors
3. Verify appointment status is 'completed' or 'cancelled'

### Files Not Stored
1. Check storage credentials are correct
2. Check storage bucket exists and is accessible
3. Check Agora storage vendor/region settings
4. Query recording status using `queryRecording()` function

## 📝 Logs to Monitor

Look for these log messages:
- `[CompleteAppointment] Starting Agora recording for channel: appointment_xxx`
- `[AgoraRecording] Started recording - SID: xxx, Resource ID: xxx`
- `[AppointmentCompletionScheduler] Stopping Agora recording for appointment xxx`
- `[AgoraRecording] Stopped recording - SID: xxx, Resource ID: xxx`

## 🚀 Deployment Checklist

Before deploying:
- [ ] All environment variables are set in production
- [ ] Agora Cloud Recording is enabled in Agora console
- [ ] Storage bucket is configured and accessible
- [ ] Test recording start/stop in staging environment
- [ ] Monitor logs after deployment
- [ ] Verify first few recordings complete successfully

## ⚠️ Important Notes

1. **Channel Name**: Uses format `appointment_{appointmentId}` - ensure this matches your Agora channel naming convention
2. **Recording UID**: Must be an integer (default: 999999). Ensure it's unique and doesn't conflict with user UIDs
3. **Storage**: Recording files are stored in your configured storage bucket. Ensure bucket has proper permissions
4. **Mode**: Currently using 'mix' mode (composite). For individual recordings, change to 'individual' mode
5. **Error Handling**: Recording failures are logged but don't prevent appointment completion

## 🔗 Related Documentation

- Agora Cloud Recording API: https://documenter.getpostman.com/view/6319646/SVSLr9AM
- Agora Storage Configuration: Check Agora console for storage setup

---

**Status**: ✅ Ready for Deployment
**Last Updated**: 2025-01-XX
**Version**: 1.0

