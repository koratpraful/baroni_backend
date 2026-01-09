import {GenerateRtcAgoraToken, GenerateRtmAgoraToken} from "../config/agora.js";
import { ensureUserAgoraKey } from "../utils/agoraKeyGenerator.js";
import { startRecordingForChannel } from "../services/agoraCloudRecording.js";
import Appointment from "../models/Appointment.js";

export const AgoraRtmToken = async (req,res) => {
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
}

export const AgoraRtcToken = async (req,res) => {
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

        // Check if this is an appointment channel (format: appointment_{appointmentId})
        const isAppointmentChannel = channel.startsWith('appointment_');
        
        if (isAppointmentChannel) {
            const appointmentId = channel.replace('appointment_', '');
            console.log(`[AgoraRtcToken] 📞 Appointment channel detected - Appointment ID: ${appointmentId}`);
            
            try {
                // Find the appointment
                const appointment = await Appointment.findById(appointmentId).lean();
                
                if (appointment) {
                    console.log(`[AgoraRtcToken] ✅ Appointment found - Status: ${appointment.status}, Payment Status: ${appointment.paymentStatus}`);
                    console.log(`[AgoraRtcToken] Current Recording Status: ${appointment.recordingStatus || 'none'}`);
                    console.log(`[AgoraRtcToken] Has Recording Resource ID: ${!!appointment.recordingResourceId}`);
                    
                    // Check if recording should start
                    // Recording should start if:
                    // 1. Appointment is approved or in_progress
                    // 2. Payment is completed
                    // 3. Recording not already started
                    const shouldStartRecording = 
                        (appointment.status === 'approved' || appointment.status === 'in_progress') &&
                        appointment.paymentStatus === 'completed' &&
                        (!appointment.recordingResourceId || appointment.recordingStatus !== 'recording');
                    
                    console.log(`[AgoraRtcToken] Should Start Recording: ${shouldStartRecording}`);
                    console.log(`[AgoraRtcToken]   - Status check: ${appointment.status === 'approved' || appointment.status === 'in_progress'}`);
                    console.log(`[AgoraRtcToken]   - Payment check: ${appointment.paymentStatus === 'completed'}`);
                    console.log(`[AgoraRtcToken]   - Recording check: ${!appointment.recordingResourceId || appointment.recordingStatus !== 'recording'}`);
                    
                    if (shouldStartRecording) {
                        console.log(`[AgoraRtcToken] 🎬 STARTING RECORDING - Channel: ${channel}`);
                        
                        // Start recording asynchronously (don't block token generation)
                        startRecordingForChannel(channel, 'mix')
                            .then(async (recordingResult) => {
                                if (recordingResult.success && recordingResult.resourceId && recordingResult.sid) {
                                    await Appointment.findByIdAndUpdate(appointmentId, {
                                        $set: {
                                            recordingResourceId: recordingResult.resourceId,
                                            recordingSid: recordingResult.sid,
                                            recordingStatus: 'recording',
                                            recordingStartedAt: new Date()
                                        }
                                    });
                                    console.log(`[AgoraRtcToken] ✅ RECORDING STARTED - ResourceID: ${recordingResult.resourceId}, SID: ${recordingResult.sid}`);
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
}
