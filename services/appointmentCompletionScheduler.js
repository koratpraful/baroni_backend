import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import Transaction from '../models/Transaction.js';
import { moveEscrowToJackpot } from './starWalletService.js';
import { cancelTransaction } from './transactionService.js';
import NotificationHelper from '../utils/notificationHelper.js';
import { deleteConversationBetweenUsers } from './messagingCleanup.js';
import { stopRecording } from './agoraCloudRecording.js';

/**
 * Parse appointment date and time to get scheduled start time
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in format like "09:30 AM" or "11:10 - 11:15"
 * @returns {Date} Parsed date object
 */
const parseAppointmentStartTime = (dateStr, timeStr) => {
  const [year, month, day] = (dateStr || '').split('-').map((v) => parseInt(v, 10));
  let hours = 0;
  let minutes = 0;
  
  if (typeof timeStr === 'string') {
    // Handle format like "09:30 - 09:50" or "09:30 AM"
    const timePart = timeStr.split('-')[0].trim(); // Get first part if range
    const m = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (m) {
      hours = parseInt(m[1], 10);
      minutes = parseInt(m[2], 10);
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
  }
  
  return new Date(year || 0, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
};

/**
 * Process appointments that should be completed or marked as missed
 * 1. If duration >= 300 seconds (5 minutes) -> mark completed
 * 2. If call duration exists AND 10 minutes passed since scheduled time -> mark completed
 * 3. If 10 minutes passed since scheduled time with NO duration -> mark missed
 * @returns {Promise<Object>} Processing result
 */
export const processCompletedAppointments = async () => {
  try {
    const COMPLETE_DURATION_SECONDS = 300; // 5 minutes (300 seconds)
    const COMPLETE_TIMEOUT_MINUTES = 10; // 10 minutes after scheduled time (if duration exists)
    const RESCHEDULE_TIMEOUT_MINUTES = 10; // 10 minutes after scheduled time (if no duration)
    
    const now = new Date();
    
    // Find appointments that are approved or in_progress
    // Include 'initiated' payment status to handle appointments with incomplete payments
    const appointments = await Appointment.find({
      status: { $in: ['approved', 'in_progress'] },
      paymentStatus: { $in: ['initiated', 'pending', 'completed'] } // Include initiated to cancel if needed
    }).lean();

    console.log(`[AppointmentCompletionScheduler] Checking ${appointments.length} appointments`);

    let completedCount = 0;
    let missedCount = 0;
    let cancelledCount = 0; // Count of appointments cancelled due to initiated payment
    let errorCount = 0;

    for (const appt of appointments) {
      try {
        // Use UTC start time if available, otherwise fall back to parsing local time
        let scheduledStartTime;
        if (appt.utcStartTime) {
          scheduledStartTime = new Date(appt.utcStartTime);
        } else {
          // Fallback: parse from date and time (for backward compatibility with old appointments)
          scheduledStartTime = parseAppointmentStartTime(appt.date, appt.time);
        }
        
        const timeSinceScheduled = now.getTime() - scheduledStartTime.getTime();
        const minutesSinceScheduled = timeSinceScheduled / (60 * 1000);
        
        const hasDuration = typeof appt.callDuration === 'number' && appt.callDuration > 0;
        const durationReached = typeof appt.callDuration === 'number' && appt.callDuration >= COMPLETE_DURATION_SECONDS;
        // If call duration exists AND 10 minutes passed since scheduled time -> mark completed
        const timePassedWithDuration = minutesSinceScheduled >= COMPLETE_TIMEOUT_MINUTES && hasDuration;
        
        console.log(`[AppointmentCompletionScheduler] Processing appointment ${appt._id}:`, {
          status: appt.status,
          callDuration: appt.callDuration || 0,
          hasDuration,
          durationReached,
          minutesSinceScheduled: minutesSinceScheduled.toFixed(2),
          timePassedWithDuration,
          scheduledStartTime: scheduledStartTime.toISOString()
        });
        
        // Case 1: Mark as completed if:
        // - Duration reached 300 seconds (5 minutes), OR
        // - Call duration exists AND 10+ minutes passed since scheduled time
        if (durationReached || timePassedWithDuration) {
          const appointment = await Appointment.findById(appt._id);
          if (!appointment) continue;
          
          // Move escrow to jackpot for the star (MUST happen before marking as completed)
          // This moves the payment from escrow to jackpot when appointment is completed
          try {
            console.log(`[AppointmentCompletionScheduler] Attempting to move escrow to jackpot for appointment ${appointment._id}, star ${appointment.starId}`);
            const escrowResult = await moveEscrowToJackpot(appointment.starId, appointment._id, null);
            if (escrowResult && escrowResult.wallet) {
              console.log(`[AppointmentCompletionScheduler] ✅ Successfully moved escrow to jackpot for star ${appointment.starId}, appointment ${appointment._id}`);
              console.log(`[AppointmentCompletionScheduler] Wallet details - Escrow: ${escrowResult.wallet.escrow}, Jackpot: ${escrowResult.wallet.jackpot}, Amount moved: ${escrowResult.starTransaction?.amount || 'N/A'}`);
            } else {
              console.warn(`[AppointmentCompletionScheduler] ⚠ moveEscrowToJackpot returned unexpected result for appointment ${appointment._id}`);
            }
          } catch (walletError) {
            console.error(`[AppointmentCompletionScheduler] ❌ CRITICAL: Failed to move escrow to jackpot for appointment ${appointment._id}:`, walletError);
            console.error(`[AppointmentCompletionScheduler] Error details:`, {
              errorMessage: walletError.message,
              errorStack: walletError.stack,
              starId: appointment.starId,
              appointmentId: appointment._id,
              paymentStatus: appointment.paymentStatus,
              transactionId: appointment.transactionId
            });
            // Continue with appointment completion even if escrow movement fails
            // This allows the appointment to be marked as completed, but escrow issue needs manual resolution
          }

          // Stop Agora cloud recording if it was started
          if (appointment.recordingResourceId && appointment.recordingSid && (appointment.recordingStatus === 'recording' || appointment.recordingStatus === 'acquired')) {
            try {
              // CRITICAL: Use the EXACT channel name format that was used when starting
              const channelName = `appointment_${appointment._id}`;
              console.log(`[AppointmentCompletionScheduler] ===== STOPPING AGORA RECORDING =====`);
              console.log(`[AppointmentCompletionScheduler] Appointment ID: ${appointment._id}`);
              console.log(`[AppointmentCompletionScheduler] Channel Name: ${channelName}`);
              console.log(`[AppointmentCompletionScheduler] Resource ID: ${appointment.recordingResourceId}`);
              console.log(`[AppointmentCompletionScheduler] SID: ${appointment.recordingSid}`);
              console.log(`[AppointmentCompletionScheduler] Current Status: ${appointment.recordingStatus}`);
              
              const stopResult = await stopRecording(
                appointment.recordingResourceId,
                appointment.recordingSid,
                channelName,
                'mix'
              );
              
              console.log(`[AppointmentCompletionScheduler] Stop Result:`, JSON.stringify({
                success: stopResult.success,
                alreadyStopped: stopResult.alreadyStopped,
                filesCount: stopResult.files?.length || 0,
                error: stopResult.error || null
              }, null, 2));
              
              if (stopResult.success) {
                appointment.recordingStatus = 'stopped';
                appointment.recordingStoppedAt = new Date();
                // Store recording file information (if available)
                if (stopResult.files && Array.isArray(stopResult.files) && stopResult.files.length > 0) {
                  appointment.recordingFiles = stopResult.files.map(file => ({
                    fileName: file.fileName || file.filename || '',
                    trackType: file.trackType || 'audio_and_video',
                    uid: file.uid || '',
                    mixedAllUser: file.mixedAllUser || false,
                    isPlayable: file.isPlayable !== undefined ? file.isPlayable : true,
                    sliceStartTime: file.sliceStartTime || 0
                  }));
                }
                const message = stopResult.alreadyStopped 
                  ? `✅ Recording already stopped (session expired or auto-stopped) for appointment ${appointment._id}`
                  : `✅ Recording stopped successfully for appointment ${appointment._id}`;
                console.log(`[AppointmentCompletionScheduler] ${message}`);
                console.log(`[AppointmentCompletionScheduler] ==========================================`);
              } else {
                console.error(`[AppointmentCompletionScheduler] ❌ FAILED TO STOP RECORDING`);
                console.error(`[AppointmentCompletionScheduler] Error:`, stopResult.error);
                console.error(`[AppointmentCompletionScheduler] Error Code:`, stopResult.errorCode);
                appointment.recordingStatus = 'failed';
              }
            } catch (recordingError) {
              console.error(`[AppointmentCompletionScheduler] ❌ EXCEPTION WHILE STOPPING RECORDING`);
              console.error(`[AppointmentCompletionScheduler] Error:`, recordingError);
              console.error(`[AppointmentCompletionScheduler] Stack:`, recordingError.stack);
              appointment.recordingStatus = 'failed';
            }
          } else {
            console.log(`[AppointmentCompletionScheduler] ⏭️  Skipping recording stop - no active recording found`);
            console.log(`[AppointmentCompletionScheduler] Resource ID: ${appointment.recordingResourceId || 'none'}`);
            console.log(`[AppointmentCompletionScheduler] SID: ${appointment.recordingSid || 'none'}`);
            console.log(`[AppointmentCompletionScheduler] Status: ${appointment.recordingStatus || 'none'}`);
          }

          // Update appointment status
          appointment.status = 'completed';
          appointment.paymentStatus = 'completed';
          appointment.completedAt = new Date();
          appointment.is_appointment_pending = true; // Set to true when completed - fan hasn't given review yet
          await appointment.save();

          // Send completion notification (only if notification cron is enabled)
          const notificationCronEnabled = process.env.NOTIFICATION_CRON === 'true';
          if (notificationCronEnabled) {
            try {
              await NotificationHelper.sendAppointmentNotification('APPOINTMENT_COMPLETED', appointment, { 
                currentUserId: appointment.fanId 
              });
              console.log(`[AppointmentCompletionScheduler] Sent completion notification for appointment ${appointment._id}`);
            } catch (notificationError) {
              console.error(`[AppointmentCompletionScheduler] Error sending completion notification:`, notificationError);
            }
          } else {
            console.log(`[AppointmentCompletionScheduler] ⚠ Notification cron is disabled (NOTIFICATION_CRON=${process.env.NOTIFICATION_CRON || 'not set'}). Skipping completion notification for appointment ${appointment._id}`);
          }

          // Cleanup messages between fan and star after completion
          try {
            await deleteConversationBetweenUsers(appointment.fanId, appointment.starId);
          } catch (_e) {}

          completedCount++;
          console.log(`[AppointmentCompletionScheduler] ✅ Completed appointment ${appointment._id} - Duration: ${appointment.callDuration || 0}s, Time since scheduled: ${minutesSinceScheduled.toFixed(2)} min`);
        }
        // Case 2: Check if appointment should be marked as missed or cancelled
        else if (minutesSinceScheduled >= RESCHEDULE_TIMEOUT_MINUTES && !hasDuration) {
          const appointment = await Appointment.findById(appt._id);
          if (!appointment) continue;
          
          // IMPORTANT: If payment is 'initiated' (payment not completed), cancel instead of marking as missed
          if (appointment.paymentStatus === 'initiated') {
            console.log(`[AppointmentCompletionScheduler] Payment is 'initiated' for appointment ${appointment._id}. Cancelling instead of marking as missed.`);
            
            try {
              // Cancel the transaction if it exists and is pending
              if (appointment.transactionId) {
                try {
                  const transaction = await Transaction.findById(appointment.transactionId);
                  if (transaction && transaction.status === 'pending') {
                    await cancelTransaction(appointment.transactionId);
                    console.log(`[AppointmentCompletionScheduler] Cancelled pending transaction ${appointment.transactionId} for appointment ${appointment._id}`);
                  } else if (transaction && (transaction.status === 'cancelled' || transaction.status === 'refunded')) {
                    console.log(`[AppointmentCompletionScheduler] Transaction ${appointment.transactionId} is already ${transaction.status}, skipping`);
                  }
                } catch (transactionError) {
                  console.error(`[AppointmentCompletionScheduler] Failed to cancel transaction for appointment ${appointment._id}:`, transactionError);
                  // Continue with appointment cancellation even if transaction cancellation fails
                }
              }
              
              // Free the reserved slot
              try {
                await Availability.updateOne(
                  { _id: appointment.availabilityId, userId: appointment.starId, 'timeSlots._id': appointment.timeSlotId },
                  { $set: { 'timeSlots.$.status': 'available' } }
                );
                console.log(`[AppointmentCompletionScheduler] Freed slot for appointment ${appointment._id}`);
              } catch (slotError) {
                console.error(`[AppointmentCompletionScheduler] Failed to free slot for appointment ${appointment._id}:`, slotError);
              }
              
              // Mark appointment as cancelled (not missed) since payment was never completed
              appointment.status = 'cancelled';
              appointment.paymentStatus = 'refunded';
              await appointment.save();
              
              cancelledCount++;
              console.log(`[AppointmentCompletionScheduler] ✅ Cancelled appointment ${appointment._id} (payment was initiated, not completed) - ${minutesSinceScheduled.toFixed(2)} min since scheduled`);
            } catch (cancelError) {
              console.error(`[AppointmentCompletionScheduler] Error cancelling appointment ${appointment._id}:`, cancelError);
              errorCount++;
            }
          } else {
            // Payment is pending or completed, so mark as missed (normal flow)
            
            // Stop Agora cloud recording if it was started (for missed appointments)
            if (appointment.recordingResourceId && appointment.recordingSid && (appointment.recordingStatus === 'recording' || appointment.recordingStatus === 'acquired')) {
              try {
                // CRITICAL: Use the EXACT channel name format that was used when starting
                const channelName = `appointment_${appointment._id}`;
                console.log(`[AppointmentCompletionScheduler] ===== STOPPING AGORA RECORDING (MISSED) =====`);
                console.log(`[AppointmentCompletionScheduler] Appointment ID: ${appointment._id}`);
                console.log(`[AppointmentCompletionScheduler] Channel Name: ${channelName}`);
                console.log(`[AppointmentCompletionScheduler] Resource ID: ${appointment.recordingResourceId}`);
                console.log(`[AppointmentCompletionScheduler] SID: ${appointment.recordingSid}`);
                console.log(`[AppointmentCompletionScheduler] Current Status: ${appointment.recordingStatus}`);
                
                const stopResult = await stopRecording(
                  appointment.recordingResourceId,
                  appointment.recordingSid,
                  channelName,
                  'mix'
                );
                
                console.log(`[AppointmentCompletionScheduler] Stop Result:`, JSON.stringify({
                  success: stopResult.success,
                  alreadyStopped: stopResult.alreadyStopped,
                  filesCount: stopResult.files?.length || 0,
                  error: stopResult.error || null
                }, null, 2));
                
                if (stopResult.success) {
                  appointment.recordingStatus = 'stopped';
                  appointment.recordingStoppedAt = new Date();
                  if (stopResult.files && Array.isArray(stopResult.files) && stopResult.files.length > 0) {
                    appointment.recordingFiles = stopResult.files.map(file => ({
                      fileName: file.fileName || file.filename || '',
                      trackType: file.trackType || 'audio_and_video',
                      uid: file.uid || '',
                      mixedAllUser: file.mixedAllUser || false,
                      isPlayable: file.isPlayable !== undefined ? file.isPlayable : true,
                      sliceStartTime: file.sliceStartTime || 0
                    }));
                  }
                  const message = stopResult.alreadyStopped 
                    ? `✅ Recording already stopped (session expired or auto-stopped) for missed appointment ${appointment._id}`
                    : `✅ Recording stopped successfully for missed appointment ${appointment._id}`;
                  console.log(`[AppointmentCompletionScheduler] ${message}`);
                  console.log(`[AppointmentCompletionScheduler] ==========================================`);
                } else {
                  console.error(`[AppointmentCompletionScheduler] ❌ FAILED TO STOP RECORDING`);
                  console.error(`[AppointmentCompletionScheduler] Error:`, stopResult.error);
                  console.error(`[AppointmentCompletionScheduler] Error Code:`, stopResult.errorCode);
                  appointment.recordingStatus = 'failed';
                }
              } catch (recordingError) {
                console.error(`[AppointmentCompletionScheduler] ❌ EXCEPTION WHILE STOPPING RECORDING`);
                console.error(`[AppointmentCompletionScheduler] Error:`, recordingError);
                console.error(`[AppointmentCompletionScheduler] Stack:`, recordingError.stack);
                appointment.recordingStatus = 'failed';
              }
            } else {
              console.log(`[AppointmentCompletionScheduler] ⏭️  Skipping recording stop (missed) - no active recording found`);
              console.log(`[AppointmentCompletionScheduler] Resource ID: ${appointment.recordingResourceId || 'none'}`);
              console.log(`[AppointmentCompletionScheduler] SID: ${appointment.recordingSid || 'none'}`);
              console.log(`[AppointmentCompletionScheduler] Status: ${appointment.recordingStatus || 'none'}`);
            }
            
            appointment.status = 'missed';
            await appointment.save();
            
            missedCount++;
            console.log(`[AppointmentCompletionScheduler] Marked appointment ${appointment._id} as missed - No duration recorded, ${minutesSinceScheduled.toFixed(2)} min since scheduled`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`[AppointmentCompletionScheduler] Error processing appointment ${appt._id}:`, error);
      }
    }

    return {
      success: true,
      message: `Processed: ${completedCount} completed, ${missedCount} missed, ${cancelledCount} cancelled (initiated payment), ${errorCount} errors`,
      completedCount,
      missedCount,
      cancelledCount,
      errorCount
    };
  } catch (error) {
    console.error('[AppointmentCompletionScheduler] Error in processCompletedAppointments:', error);
    throw error;
  }
};

/**
 * Start the appointment completion scheduler
 * Runs every 1 minute to check for appointments ready to be marked as completed
 */
export const startAppointmentCompletionScheduler = () => {
  // Run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      console.log('[AppointmentCompletionScheduler] Running appointment completion check...');
      const result = await processCompletedAppointments();
      console.log('[AppointmentCompletionScheduler] Completion check completed:', result);
    } catch (error) {
      console.error('[AppointmentCompletionScheduler] Error in scheduled check:', error);
    }
  });

  console.log('[AppointmentCompletionScheduler] Appointment completion scheduler started - checking every 1 minute');
};

/**
 * Stop the appointment completion scheduler
 */
export const stopAppointmentCompletionScheduler = () => {
  cron.getTasks().forEach(task => {
    if (task.name === 'appointment-completion-check') {
      task.stop();
    }
  });
  console.log('[AppointmentCompletionScheduler] Appointment completion scheduler stopped');
};

