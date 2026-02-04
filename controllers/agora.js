import { GenerateRtcAgoraToken, GenerateRtmAgoraToken } from "../config/agora.js";
import { ensureUserAgoraKey } from "../utils/agoraKeyGenerator.js";
import { startRecordingForChannel, stopRecording, queryRecording } from "../services/agoraCloudRecording.js";
import Appointment from "../models/Appointment.js";

export const AgoraRtmToken = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const agoraKey = await ensureUserAgoraKey(req.user);
    // RTM requires a string userAccount, not a numeric uid
    const userAccount = String(agoraKey);

    const token = GenerateRtmAgoraToken(userAccount);
    console.log('RTM token:', token);
    res.json({ token });
  } catch (error) {
    console.error('Error generating RTM token:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const AgoraRtcToken = async (req, res) => {
  try {
    const { channel } = req.body;

    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!channel) return res.status(400).json({ error: "Channel is required" });

    const agoraKey = await ensureUserAgoraKey(req.user);
    const uid = Number(agoraKey);

    console.log(`[AgoraRtcToken] ===== RTC TOKEN REQUEST =====`);
    console.log(`[AgoraRtcToken] User ID: ${req.user._id}`);
    console.log(`[AgoraRtcToken] Channel: ${channel}`);
    console.log(`[AgoraRtcToken] UID: ${uid}`);

    // Check if this is an appointment channel
    // Channel can be in format: "appointment_{appointmentId}" OR just "{appointmentId}"
    let appointmentId = null;
    let isAppointmentChannel = false;

    if (channel.startsWith('appointment_')) {
      // Format: appointment_{appointmentId}
      appointmentId = channel.replace('appointment_', '');
      isAppointmentChannel = true;
      console.log(`[AgoraRtcToken] 📞 Appointment channel detected (with prefix) - Appointment ID: ${appointmentId}`);
    } else {
      // Check if channel name is a valid MongoDB ObjectId (24 hex characters)
      const mongoose = await import('mongoose');
      if (mongoose.default.Types.ObjectId.isValid(channel) && channel.length === 24) {
        // Try to find appointment with this ID
        try {
          const appointment = await Appointment.findById(channel).lean();
          if (appointment) {
            appointmentId = channel;
            isAppointmentChannel = true;
            console.log(`[AgoraRtcToken] 📞 Appointment channel detected (direct ID) - Appointment ID: ${appointmentId}`);
          } else {
            console.log(`[AgoraRtcToken] ℹ️  Channel looks like ObjectId but no appointment found - Channel: ${channel}`);
          }
        } catch (err) {
          console.log(`[AgoraRtcToken] ℹ️  Error checking appointment for channel ${channel}:`, err.message);
        }
      }
    }

    if (isAppointmentChannel && appointmentId) {
      try {
        // Find the appointment
        const appointment = await Appointment.findById(appointmentId).lean();

        if (appointment) {
          console.log(`[AgoraRtcToken] ✅ Appointment found - Status: ${appointment.status}, Payment Status: ${appointment.paymentStatus}`);
          console.log(`[AgoraRtcToken] Current Recording Status: ${appointment.recordingStatus || 'none'}`);
          console.log(`[AgoraRtcToken] Has Recording Resource ID: ${!!appointment.recordingResourceId}`);

          // Check if recording should start
          // Recording should start if:
          // 1. Payment is completed (main requirement)
          // 2. Recording not already started/active
          // 3. Appointment is not cancelled/rejected
          // Note: Status can be approved, in_progress, or completed - all are valid for recording
          const isValidStatus = ['approved', 'in_progress', 'completed'].includes(appointment.status);
          const isPaymentCompleted = appointment.paymentStatus === 'completed';
          const isRecordingNotStarted = !appointment.recordingResourceId ||
            (appointment.recordingStatus !== 'recording' && appointment.recordingStatus !== 'acquired');

          const shouldStartRecording = isValidStatus && isPaymentCompleted && isRecordingNotStarted;

          console.log(`[AgoraRtcToken] Should Start Recording: ${shouldStartRecording}`);
          console.log(`[AgoraRtcToken]   - Status check: ${isValidStatus} (status: ${appointment.status})`);
          console.log(`[AgoraRtcToken]   - Payment check: ${isPaymentCompleted} (paymentStatus: ${appointment.paymentStatus})`);
          console.log(`[AgoraRtcToken]   - Recording check: ${isRecordingNotStarted} (hasResourceId: ${!!appointment.recordingResourceId}, status: ${appointment.recordingStatus || 'none'})`);

          if (shouldStartRecording) {
            // CRITICAL: Use the SAME channel name the client is joining (channel from request).
            // Recording must join the same Agora channel as users; otherwise it records an empty channel.
            const recordingChannelName = channel;
            console.log(`[AgoraRtcToken] 🎬 STARTING RECORDING - Channel: ${recordingChannelName} (must match client join)`);

            // Start recording asynchronously (don't block token generation)
            startRecordingForChannel(recordingChannelName, 'mix')
              .then(async (recordingResult) => {
                if (recordingResult.success && recordingResult.resourceId && recordingResult.sid) {
                  await Appointment.findByIdAndUpdate(appointmentId, {
                    $set: {
                      recordingResourceId: recordingResult.resourceId,
                      recordingSid: recordingResult.sid,
                      recordingChannelName: recordingChannelName,
                      recordingStatus: 'recording',
                      recordingStartedAt: new Date()
                    }
                  });
                  console.log(`[AgoraRtcToken] ✅ RECORDING STARTED - ResourceID: ${recordingResult.resourceId}, SID: ${recordingResult.sid}, Channel: ${recordingChannelName}`);
                } else {
                  await Appointment.findByIdAndUpdate(appointmentId, {
                    $set: { recordingStatus: 'failed' }
                  });
                  console.error(`[AgoraRtcToken] ❌ RECORDING FAILED - Error:`, recordingResult.error);
                }
              })
              .catch(async (error) => {
                await Appointment.findByIdAndUpdate(appointmentId, {
                  $set: { recordingStatus: 'failed' }
                });
                console.error(`[AgoraRtcToken] ❌ RECORDING EXCEPTION -`, error.message);
              });
          } else {
            console.log(`[AgoraRtcToken] ⏭️  SKIPPING RECORDING START - Conditions not met`);
          }
        } else {
          console.log(`[AgoraRtcToken] ⚠️  Appointment not found - ID: ${appointmentId}`);
        }
      } catch (appointmentError) {
        console.error(`[AgoraRtcToken] ❌ Error checking appointment:`, appointmentError.message);
        // Continue with token generation even if appointment check fails
      }
    } else {
      console.log(`[AgoraRtcToken] ℹ️  Non-appointment channel - No recording needed`);
    }

    const token = GenerateRtcAgoraToken(uid, channel);
    console.log(`[AgoraRtcToken] ✅ Token generated successfully`);
    console.log(`[AgoraRtcToken] ====================================`);

    res.json({ token });
  } catch (error) {
    console.error('[AgoraRtcToken] ❌ Error generating RTC token:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Simple HTTP test endpoint: start cloud recording for any channel.
 * Admin-only to avoid abuse.
 */
export const testStartCloudRecording = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can call this test API' });
    }

    const { channelName, mode = 'mix' } = req.body || {};
    if (!channelName) {
      return res.status(400).json({ success: false, message: 'channelName is required' });
    }

    console.log('[AgoraTest] Starting cloud recording via test API', { channelName, mode });
    const result = await startRecordingForChannel(channelName, mode);

    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Cloud recording started (test)' : 'Failed to start cloud recording (test)',
      data: {
        channelName,
        mode,
        resourceId: result.resourceId || null,
        sid: result.sid || null,
        raw: result
      }
    });
  } catch (error) {
    console.error('[AgoraTest] Error in testStartCloudRecording:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error in testStartCloudRecording',
      error: error.message
    });
  }
};

/**
 * Simple HTTP test endpoint: stop cloud recording using resourceId + sid.
 * Returns file list so you can verify video exists in storage.
 */
export const testStopCloudRecording = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can call this test API' });
    }

    const { resourceId, sid, channelName, mode = 'mix' } = req.body || {};
    if (!resourceId || !sid || !channelName) {
      return res.status(400).json({
        success: false,
        message: 'resourceId, sid and channelName are required'
      });
    }

    console.log('[AgoraTest] Stopping cloud recording via test API', { resourceId, sid, channelName, mode });
    const result = await stopRecording(resourceId, sid, channelName, mode);

    // Optional public base URL so you can click & open video quickly
    const publicBaseUrl = process.env.AGORA_STORAGE_PUBLIC_BASE_URL || null;
    const filesWithUrl = Array.isArray(result.files)
      ? result.files.map((f) => ({
          ...f,
          publicUrl: publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, '')}/${f.fileName}` : null
        }))
      : [];

    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.message || (result.success ? 'Cloud recording stopped (test)' : 'Failed to stop cloud recording (test)'),
      data: {
        channelName,
        mode,
        resourceId,
        sid,
        uploadStatus: result.uploadStatus || null,
        noRecordedData: !!result.noRecordedData,
        files: filesWithUrl,
        raw: result
      }
    });
  } catch (error) {
    console.error('[AgoraTest] Error in testStopCloudRecording:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error in testStopCloudRecording',
      error: error.message
    });
  }
};

/**
 * Simple HTTP test endpoint: query current cloud recording status.
 */
export const testQueryCloudRecording = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can call this test API' });
    }

    const { resourceId, sid, channelName, mode = 'mix' } = req.body || {};
    if (!resourceId || !sid || !channelName) {
      return res.status(400).json({
        success: false,
        message: 'resourceId, sid and channelName are required'
      });
    }

    console.log('[AgoraTest] Querying cloud recording via test API', { resourceId, sid, channelName, mode });
    const result = await queryRecording(resourceId, sid, channelName, mode);

    return res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Cloud recording status fetched (test)' : 'Failed to query cloud recording (test)',
      data: result
    });
  } catch (error) {
    console.error('[AgoraTest] Error in testQueryCloudRecording:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error in testQueryCloudRecording',
      error: error.message
    });
  }
};
