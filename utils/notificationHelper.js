import notificationService from '../services/notificationService.js';
import  User  from '../models/User.js';

class NotificationHelper {
  /**
   * Validate if user can receive notifications
   * @param {string} userId - User ID to validate
   * @returns {Object} Validation result with details
   */
  static async validateUserNotificationSettings(userId) {
    try {
      const user = await User.findById(userId).select('name pseudo deviceType fcmToken apnsToken voipToken appNotification isDev');
      
      if (!user) {
        return {
          canReceive: false,
          reason: 'User not found',
          details: { userId }
        };
      }

      if (user.appNotification === false) {
        return {
          canReceive: false,
          reason: 'User has notifications disabled',
          details: { 
            userId, 
            appNotification: user.appNotification,
            name: user.name,
            pseudo: user.pseudo
          }
        };
      }

      if (!user.fcmToken && !user.apnsToken && !user.voipToken) {
        // Log as info (not error) since this is expected for users without devices or who haven't enabled notifications
        console.log(`[NotificationValidation] User ${userId} has no push tokens (deviceType: ${user.deviceType || 'unknown'}) - skipping notification`);
        return {
          canReceive: false,
          reason: 'No push tokens found',
          details: { 
            userId,
            hasFcmToken: !!user.fcmToken,
            hasApnsToken: !!user.apnsToken,
            hasVoipToken: !!user.voipToken,
            deviceType: user.deviceType
          }
        };
      }

      return {
        canReceive: true,
        reason: 'User can receive notifications',
        details: {
          userId,
          name: user.name,
          pseudo: user.pseudo,
          deviceType: user.deviceType,
          appNotification: user.appNotification,
          hasFcmToken: !!user.fcmToken,
          hasApnsToken: !!user.apnsToken,
          hasVoipToken: !!user.voipToken,
          isDev: user.isDev
        }
      };
    } catch (error) {
      return {
        canReceive: false,
        reason: 'Error validating user settings',
        details: { userId, error: error.message }
      };
    }
  }

  /**
   * Send appointment-related notifications
   */
  static async sendAppointmentNotification(type, appointment, additionalData = {}) {
    // Log to track if this function is being called multiple times for the same appointment
    console.log(`[AppointmentNotification] ===== Sending ${type} notification =====`);
    console.log(`[AppointmentNotification] Appointment ID: ${appointment._id}`);
    console.log(`[AppointmentNotification] Star ID: ${appointment.starId}`);
    console.log(`[AppointmentNotification] Fan ID: ${appointment.fanId}`);
    console.log(`[AppointmentNotification] Current User ID: ${additionalData.currentUserId || 'not provided'}`);
    
    const templates = notificationService.constructor.getNotificationTemplates();
    const baseTemplate = templates[type];

    if (!baseTemplate) {
      console.error(`Notification template not found for type: ${type}`);
      return;
    }

    // Try to fetch minimal user info for personalized messages
    let fanName = 'Fan';
    let starName = 'Star';
    try {
      const users = await User.find({ _id: { $in: [appointment.fanId, appointment.starId] } }).select('name');
      for (const u of users) {
        if (String(u._id) === String(appointment.fanId)) fanName = u.name || fanName;
        if (String(u._id) === String(appointment.starId)) starName = u.name || starName;
      }
    } catch (_e) {}

    // Check if appointment is in the past
    const isPastAppointment = appointment.startTime && new Date(appointment.startTime) < new Date();
    
    const data = {
      type: baseTemplate.type,
      appointmentId: appointment._id.toString(),
      starId: appointment.starId?.toString?.() || String(appointment.starId || ''),
      fanId: appointment.fanId?.toString?.() || String(appointment.fanId || ''),
      starName,
      fanName,
      navigateTo: 'appointment',
      eventType: type,
      isMessage: false, // Default to false, will be set to true only on approval
      ...additionalData
    };

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    // Extract starId and fanId properly (handle both populated objects and IDs)
    const starId = appointment.starId?._id 
      ? String(appointment.starId._id) 
      : (appointment.starId?.toString?.() || String(appointment.starId || ''));
    
    const fanId = appointment.fanId?._id 
      ? String(appointment.fanId._id) 
      : (appointment.fanId?.toString?.() || String(appointment.fanId || ''));

    // Update data with proper string IDs
    data.starId = starId;
    data.fanId = fanId;

    // Fan message
    const fanTemplate = {
      ...baseTemplate
    };
    if (type === 'APPOINTMENT_CREATED') {
      // For fan, use different message
      fanTemplate.title = {
        en: 'Request Submitted',
        fr: 'Demande soumise'
      };
      fanTemplate.body = {
        en: "Your request is now on star's side for validation. please wait.",
        fr: 'Votre demande est maintenant du côté de la star pour validation. Veuillez patienter.'
      };
    }

    // Star message
    const starTemplate = {
      ...baseTemplate
    };
    if (type === 'APPOINTMENT_CREATED') {
      starTemplate.title = {
        en: 'New Appointment Request',
        fr: 'Nouvelle demande de rendez-vous'
      };
      starTemplate.body = {
        en: `You have a new appointment request from ${fanName}.`,
        fr: `Vous avez une nouvelle demande de rendez-vous de ${fanName}.`
      };
    }

    // For APPOINTMENT_REMINDER, send to both star and fan regardless of currentUserId
    // For other types, send to star if star is not the current user
    const shouldSendToStar = type === 'APPOINTMENT_REMINDER' || 
                            (starId && String(starId) !== String(currentUserId));
    
    if (starId && shouldSendToStar) {
      console.log(`[AppointmentNotification] Processing ${type} notification for star`, appointment.starId);
      console.log(`[AppointmentNotification] Using starId: ${starId}`);
      
      // Validate star's notification settings before sending (pass string ID, not object)
      const starValidation = await this.validateUserNotificationSettings(starId);
      console.log(`[AppointmentNotification] Star validation for user ${starId}:`, starValidation);
      
      if (!starValidation.canReceive) {
        // Only log as warning if it's not just missing tokens (which is expected)
        if (starValidation.reason !== 'No push tokens found') {
          console.warn(`[AppointmentNotification] ⚠ Skipping notification to star ${starId}: ${starValidation.reason}`);
          console.warn(`[AppointmentNotification] Star validation details:`, starValidation.details);
        } else {
          console.log(`[AppointmentNotification] ℹ Skipping notification to star ${starId}: ${starValidation.reason} (expected if user has no device tokens)`);
        }
      } else {
        const starNote = { ...starTemplate };
        if (type === 'APPOINTMENT_REMINDER') {
          const minutesUntil = additionalData.minutesUntil || 10;
          if (additionalData.isStartTime || additionalData.isStartingNow) {
            starNote.title = {
              en: 'Appointment Starting Now',
              fr: 'Le rendez-vous commence maintenant'
            };
            starNote.body = {
              en: `Your appointment with ${fanName} is starting now! Please join.`,
              fr: `Votre rendez-vous avec ${fanName} commence maintenant ! Veuillez rejoindre.`
            };
            console.log(`[AppointmentNotification] Sending START notification to star ${starId} (${fanName})`);
          } else {
            starNote.title = {
              en: 'Appointment Reminder',
              fr: 'Rappel de rendez-vous'
            };
            starNote.body = {
              en: `Your appointment with ${fanName} starts in ${minutesUntil} minutes.`,
              fr: `Votre rendez-vous avec ${fanName} commence dans ${minutesUntil} minutes.`
            };
            console.log(`[AppointmentNotification] Sending reminder to star ${starId} (${fanName})`);
          }
        } else if (type === 'APPOINTMENT_CANCELLED' && String(currentUserId) === String(fanId)) {
          starNote.title = {
            en: 'Appointment Cancelled',
            fr: 'Rendez-vous annulé'
          };
          starNote.body = {
            en: `${fanName} has cancelled the appointment.`,
            fr: `${fanName} a annulé le rendez-vous.`
          };
        } else if (type === 'APPOINTMENT_RESCHEDULED') {
          // Get new appointment details for reschedule notification
          const newDate = appointment.date || '';
          const newTime = appointment.time || '';
          starNote.title = {
            en: 'Appointment Rescheduled',
            fr: 'Rendez-vous reprogrammé'
          };
          starNote.body = {
            en: `${fanName} has rescheduled the appointment${newDate || newTime ? ` to ${newDate} ${newTime}` : ''}.`,
            fr: `${fanName} a reprogrammé le rendez-vous${newDate || newTime ? ` au ${newDate} ${newTime}` : ''}.`
          };
          console.log(`[AppointmentNotification] Sending reschedule notification to star ${starId} (${fanName})`);
        }
        
        try {
          const result = await notificationService.sendToUser(starId, starNote, data, {
            relatedEntity: { type: 'appointment', id: appointment._id }
          });
          console.log(`[AppointmentNotification] ✓ Star notification sent successfully:`, {
            userId: starId,
            success: result?.success,
            notificationId: result?.notificationId
          });
        } catch (sendError) {
          console.error(`[AppointmentNotification] ✗ Failed to send notification to star ${starId}:`, sendError);
          throw sendError;
        }
      }
    }

    // For APPOINTMENT_REMINDER, send to both star and fan regardless of currentUserId
    // BUT skip fan if skipFan flag is set (to prevent duplicate notifications)
    // For other types, send to fan if fan is not the current user and it's not an appointment creation
    const skipFan = additionalData.skipFan === true; // Flag to skip fan notification (prevents duplicate)
    const shouldSendToFan = !skipFan && (
      type === 'APPOINTMENT_REMINDER' ||
      (fanId && 
       String(fanId) !== String(currentUserId) && 
       type !== 'APPOINTMENT_CREATED')
    );
    
    if (fanId && shouldSendToFan) {
      console.log(`[AppointmentNotification] Processing ${type} notification for fan`, appointment.fanId);
      console.log(`[AppointmentNotification] Using fanId: ${fanId}`);
      
      // Validate fan's notification settings before sending (pass string ID, not object)
      const fanValidation = await this.validateUserNotificationSettings(fanId);
      console.log(`[AppointmentNotification] Fan validation for user ${fanId}:`, fanValidation);
      
      if (!fanValidation.canReceive) {
        // Only log as warning if it's not just missing tokens (which is expected)
        if (fanValidation.reason !== 'No push tokens found') {
          console.warn(`[AppointmentNotification] ⚠ Skipping notification to fan ${fanId}: ${fanValidation.reason}`);
          console.warn(`[AppointmentNotification] Fan validation details:`, fanValidation.details);
        } else {
          console.log(`[AppointmentNotification] ℹ Skipping notification to fan ${fanId}: ${fanValidation.reason} (expected if user has no device tokens)`);
        }
        // Don't return - we still want to continue with other logic (e.g., star notification)
      } else {
        // Customize fan template based on action type
        if (type === 'APPOINTMENT_APPROVED' || type === 'APPOINTMENT_ACCEPTED') {
          fanTemplate.title = {
            en: 'Appointment Approved',
            fr: 'Rendez-vous approuvé'
          };
          fanTemplate.body = {
            en: `${starName} has approved your appointment request.`,
            fr: `${starName} a approuvé votre demande de rendez-vous.`
          };
          // Set isMessage to true when appointment is accepted
          data.isMessage = true;
        } else if (type === 'APPOINTMENT_REJECTED') {
          fanTemplate.title = {
            en: 'Appointment Rejected',
            fr: 'Rendez-vous rejeté'
          };
          fanTemplate.body = {
            en: `${starName} has rejected your appointment request.`,
            fr: `${starName} a rejeté votre demande de rendez-vous.`
          };
          // For iOS devices, we need to send special payload to cut/reject the call
          // This will be handled in notificationService based on deviceType
          // Only set isRejectCall for iOS to cut the call, not for Android
          // Android should receive normal notification only
          data.isRejectCall = true; // Flag to indicate this is a call rejection (for iOS only)
          data.isAppointmentReject = true; // Flag to prevent VoIP call notification on Android
        } else if (type === 'APPOINTMENT_CANCELLED') {
          fanTemplate.title = {
            en: 'Appointment Cancelled',
            fr: 'Rendez-vous annulé'
          };
          // Notify fan only when cancelled by star
          if (String(currentUserId) === String(starId)) {
            fanTemplate.body = {
              en: `${starName} has cancelled your appointment.`,
              fr: `${starName} a annulé votre rendez-vous.`
            };
          } else {
            // If fan cancelled themselves, don't notify the fan
            return;
          }
        } else if (type === 'APPOINTMENT_COMPLETED') {
          fanTemplate.title = {
            en: 'Appointment Completed',
            fr: 'Rendez-vous terminé'
          };
          fanTemplate.body = {
            en: `Your appointment with ${starName} has been completed.`,
            fr: `Votre rendez-vous avec ${starName} a été terminé.`
          };
          // Set isMessage to false when appointment is completed
          data.isMessage = false;
        } else if (type === 'APPOINTMENT_REMINDER') {
          const minutesUntil = additionalData.minutesUntil || 10;
          if (additionalData.isStartTime || additionalData.isStartingNow) {
            fanTemplate.title = {
              en: 'Appointment Starting Now',
              fr: 'Le rendez-vous commence maintenant'
            };
            fanTemplate.body = {
              en: `Your appointment with ${starName} is starting now! Please join.`,
              fr: `Votre rendez-vous avec ${starName} commence maintenant ! Veuillez rejoindre.`
            };
            console.log(`[AppointmentNotification] Sending START notification to fan ${fanId} (${starName})`);
          } else {
            fanTemplate.title = {
              en: 'Appointment Reminder',
              fr: 'Rappel de rendez-vous'
            };
            fanTemplate.body = {
              en: `Your appointment with ${starName} starts in ${minutesUntil} minutes.`,
              fr: `Votre rendez-vous avec ${starName} commence dans ${minutesUntil} minutes.`
            };
            console.log(`[AppointmentNotification] Sending reminder to fan ${fanId} (${starName})`);
          }
        }
        
        try {
          const result = await notificationService.sendToUser(fanId, fanTemplate, data, {
            relatedEntity: { type: 'appointment', id: appointment._id }
          });
          console.log(`[AppointmentNotification] ✓ Fan notification sent successfully:`, {
            userId: fanId,
            success: result?.success,
            notificationId: result?.notificationId
          });
        } catch (sendError) {
          console.error(`[AppointmentNotification] ✗ Failed to send notification to fan ${fanId}:`, sendError);
          throw sendError;
        }
      }
    } else if (type === 'APPOINTMENT_CREATED') {
      // For APPOINTMENT_CREATED, notification to star is handled in the main logic above
      // This section is only for fan notifications or special cases
      console.log('[AppointmentNotification] APPOINTMENT_CREATED processed - star notification handled in main logic', {
        appointmentId: appointment._id?.toString?.() || String(appointment._id || ''),
        userId: appointment.starId?.toString?.() || String(appointment.starId || '')
      });
    }
  }

  /**
   * Send video call reminder
   */
  static async sendVideoCallReminder(appointment, additionalData = {}) {
    const templates = notificationService.constructor.getNotificationTemplates();
    const template = templates.VIDEO_CALL_REMINDER;

    // Check if appointment is in the past
    const isPastAppointment = appointment.startTime && new Date(appointment.startTime) < new Date();

    const data = {
      type: template.type,
      appointmentId: appointment._id.toString(),
      starName: appointment.starName || 'Star',
      fanName: appointment.fanName || 'Fan',
      isMessage: false // Default to false, will be set to true only on approval
    };

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    // Customize message for each user
    const fanTemplate = {
      ...template,
      body: `Your video call with ${appointment.starName || 'Star'} begins in 10 minutes. Please check your network and be ready to join.`
    };

    const starTemplate = {
      ...template,
      body: `Your video call with ${appointment.fanName || 'Fan'} begins in 10 minutes. Please check your network and be ready to join.`
    };

    // Send to fan if fan is not the current user
    if (appointment.fanId && String(appointment.fanId) !== String(currentUserId)) {
      await notificationService.sendToUser(appointment.fanId, fanTemplate, data, {
        relatedEntity: { type: 'appointment', id: appointment._id }
      });
    }

    // Send to star if star is not the current user
    if (appointment.starId && String(appointment.starId) !== String(currentUserId)) {
      const result = await notificationService.sendToUser(appointment.starId, starTemplate, data, {
        relatedEntity: { type: 'appointment', id: appointment._id }
      });
      console.log('[AppointmentNotification] sent to star', {
        appointmentId: appointment._id?.toString?.() || String(appointment._id || ''),
        userId: appointment.starId?.toString?.() || String(appointment.starId || ''),
        template: { title: starTemplate.title, body: starTemplate.body },
        data,
        result
      });
    }
  }

  /**
   * Send payment notifications
   */
  static async sendPaymentNotification(type, transaction, additionalData = {}) {
    const templates = notificationService.constructor.getNotificationTemplates();
    const baseTemplate = templates[type];

    if (!baseTemplate) {
      console.error(`Notification template not found for type: ${type}`);
      return;
    }

    // Fetch names of payer and receiver
    let payerName = 'User';
    let receiverName = 'User';
    try {
      const users = await User.find({ _id: { $in: [transaction.payerId, transaction.receiverId] } }).select('name');
      for (const u of users) {
        if (String(u._id) === String(transaction.payerId)) payerName = u.name || payerName;
        if (String(u._id) === String(transaction.receiverId)) receiverName = u.name || receiverName;
      }
    } catch (_e) {}

    const data = {
      type: baseTemplate.type,
      transactionId: transaction._id.toString(),
      amount: transaction.amount,
      payerName,
      receiverName,
      ...additionalData
    };

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    // Dynamic titles/bodies based on transaction context
    const tType = transaction.type;
    const meta = transaction.metadata || transaction.meta || {};
    const amountStr = typeof transaction.amount === 'number' ? transaction.amount.toString() : transaction.amount;
    const currency = meta.currency || 'coins';

    let template = { ...baseTemplate };
    if (tType === 'live_show_attendance_payment') {
      const showTitle = meta.showTitle ? `"${meta.showTitle}"` : 'Live Show';
      template = {
        ...baseTemplate,
        title: {
          en: 'Live Show booked',
          fr: 'Émission en direct réservée'
        },
        body: {
          en: `You booked ${showTitle}${amountStr ? ` • ${amountStr} ${currency}` : ''}.`,
          fr: `Vous avez réservé ${showTitle}${amountStr ? ` • ${amountStr} ${currency}` : ''}.`
        }
      };
    } else if (tType === 'live_show_hosting_payment') {
      const showTitle = meta.showTitle ? `"${meta.showTitle}"` : 'your Live Show';
      template = {
        ...baseTemplate,
        title: {
          en: 'Hosting fee paid',
          fr: 'Frais d\'hébergement payés'
        },
        body: {
          en: `Your hosting fee for ${showTitle} was paid${amountStr ? ` • ${amountStr} ${currency}` : ''}.`,
          fr: `Vos frais d'hébergement pour ${showTitle} ont été payés${amountStr ? ` • ${amountStr} ${currency}` : ''}.`
        }
      };
    } else if (type === 'PAYMENT_SUCCESS') {
      template = {
        ...baseTemplate,
        title: {
          en: 'Payment successful',
          fr: 'Paiement réussi'
        },
        body: {
          en: `Payment completed${amountStr ? ` • ${amountStr} ${currency}` : ''}.`,
          fr: `Paiement terminé${amountStr ? ` • ${amountStr} ${currency}` : ''}.`
        }
      };
    } else if (type === 'PAYMENT_FAILED') {
      template = {
        ...baseTemplate,
        title: {
          en: 'Payment failed',
          fr: 'Échec du paiement'
        },
        body: {
          en: 'Your payment could not be processed. Please try again.',
          fr: 'Votre paiement n\'a pas pu être traité. Veuillez réessayer.'
        }
      };
    }

    // Send to the user who made the payment if they are not the current user
    if (transaction.userId && String(transaction.userId) !== String(currentUserId)) {
      await notificationService.sendToUser(transaction.userId, template, data, {
        relatedEntity: { type: 'transaction', id: transaction._id }
      });
    }
  }

  /**
   * Send rating notifications
   */
  static async sendRatingNotification(type, rating, additionalData = {}) {
    const templates = notificationService.constructor.getNotificationTemplates();
    const template = templates[type];

    if (!template) {
      console.error(`Notification template not found for type: ${type}`);
      return;
    }

    // Extract reviewerId and starId (Review model uses reviewerId, not fanId)
    const reviewerId = rating.reviewerId?._id ? String(rating.reviewerId._id) : (rating.reviewerId?.toString?.() || String(rating.reviewerId || ''));
    const starId = rating.starId?._id ? String(rating.starId._id) : (rating.starId?.toString?.() || String(rating.starId || ''));

    // Fetch names
    let fanName = 'Fan';
    let starName = 'Star';
    try {
      const userIds = [reviewerId, starId].filter(id => id);
      if (userIds.length > 0) {
        const users = await User.find({ _id: { $in: userIds } }).select('name pseudo');
        for (const u of users) {
          const userId = String(u._id);
          if (userId === reviewerId) fanName = u.name || u.pseudo || fanName;
          if (userId === starId) starName = u.name || u.pseudo || starName;
        }
      }
    } catch (_e) {
      console.error('Error fetching user names for rating notification:', _e);
    }

    // Determine review type for personalized message
    const reviewType = rating.reviewType || '';
    const reviewTypeText = reviewType === 'appointment' ? 'appointment' : 
                          reviewType === 'dedication' ? 'dedication' : 
                          reviewType === 'live_show' ? 'live show' : 'service';

    // Build personalized notification message
    const notificationTitle = {
      en: 'New Review Received',
      fr: 'Nouvelle note reçue'
    };
    const reviewTypeTextFr = reviewType === 'appointment' ? 'rendez-vous' : 
                              reviewType === 'dedication' ? 'dédicace' : 
                              reviewType === 'live_show' ? 'émission en direct' : 'service';
    const notificationBody = {
      en: `${fanName} has left you a ${rating.rating}-star review for your ${reviewTypeText}${rating.comment ? ' with a comment' : ''}.`,
      fr: `${fanName} vous a laissé une note de ${rating.rating} étoiles pour votre ${reviewTypeTextFr}${rating.comment ? ' avec un commentaire' : ''}.`
    };

    const data = {
      type: template.type,
      ratingId: rating._id.toString(),
      fanName,
      starName,
      rating: rating.rating,
      reviewType: reviewType,
      ...additionalData
    };

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    // Send to the star who received the rating if star is not the current user
    if (starId && String(starId) !== String(currentUserId)) {
      const starNotification = {
        title: notificationTitle,
        body: notificationBody,
        type: template.type
      };
      
      try {
        const result = await notificationService.sendToUser(starId, starNotification, data, {
          relatedEntity: { type: 'rating', id: rating._id }
        });
        console.log(`[RatingNotification] ✓ Star notification sent successfully:`, {
          userId: starId,
          starName,
          fanName,
          rating: rating.rating,
          reviewType,
          success: result?.success,
          notificationId: result?.notificationId
        });
      } catch (sendError) {
        console.error(`[RatingNotification] ✗ Failed to send notification to star ${starId}:`, sendError);
        throw sendError;
      }
    }

    // Send to the fan who gave the rating (for thanks message) if fan is not the current user
    if (type === 'RATING_THANKS' && reviewerId && String(reviewerId) !== String(currentUserId)) {
      await notificationService.sendToUser(reviewerId, template, data, {
        relatedEntity: { type: 'rating', id: rating._id }
      });
    }
  }

  /**
   * Send live show notifications
   */
  static async sendLiveShowNotification(type, liveShow, additionalData = {}) {
    const templates = notificationService.constructor.getNotificationTemplates();
    const baseTemplate = templates[type];

    if (!baseTemplate) {
      console.error(`Notification template not found for type: ${type}`);
      return;
    }

    // Fetch star name properly
    let starName = 'Star';
    try {
      if (liveShow.starId) {
        const star = await User.findById(liveShow.starId).select('name pseudo');
        starName = star?.name || star?.pseudo || starName;
      }
    } catch (_e) {}

    const data = {
      type: baseTemplate.type,
      liveShowId: liveShow._id.toString(),
      starId: liveShow.starId?._id?.toString?.() || liveShow.starId?.toString?.() || String(liveShow.starId || ''),
      starName,
      pushType: 'VoIP',
      navigateTo: 'live_show',
      eventType: type,
      ...additionalData
    };

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    // Build dynamic, descriptive title/body
    
    const showTitle = liveShow?.sessionTitle ? `"${liveShow.sessionTitle}"` : 'a live show';
    const dateStr = liveShow?.date ? new Date(liveShow.date).toLocaleString() : undefined;

    let template = { ...baseTemplate };
    switch (type) {
      case 'LIVE_SHOW_CREATED':
        template = {
          ...baseTemplate,
          title: `${starName} scheduled a Live Show`,
          body: `${starName} created ${showTitle}${dateStr ? ` on ${dateStr}` : ''}. Tap to view.`
        };
        break;
      case 'LIVE_SHOW_STARTING':
        template = {
          ...baseTemplate,
          title: 'Live Show starting soon',
          body: `${showTitle} is starting soon. Get ready to join!`
        };
        break;
      case 'LIVE_SHOW_CANCELLED':
        template = {
          ...baseTemplate,
          title: 'Live Show cancelled',
          body: `${showTitle} was cancelled by ${starName}.`
        };
        break;
      case 'LIVE_SHOW_RESCHEDULED':
        template = {
          ...baseTemplate,
          title: 'Live Show rescheduled',
          body: `${showTitle} was rescheduled${dateStr ? ` to ${dateStr}` : ''}.`
        };
        break;
    }

    switch (type) {
      case 'LIVE_SHOW_CREATED':
        // Send to all fans who have this star as favorite
        await this.sendToStarFollowers(liveShow.starId, template, data, { apnsVoip: true, currentUserId });
        break;

      case 'LIVE_SHOW_STARTING':
        // Send to all fans who joined this live show
        await this.sendToLiveShowAttendees(liveShow._id, template, data, { apnsVoip: true, currentUserId });
        break;

      case 'LIVE_SHOW_CANCELLED':
      case 'LIVE_SHOW_RESCHEDULED':
        // Send to star if not current user
        if (liveShow.starId && String(liveShow.starId) !== String(currentUserId)) {
          await notificationService.sendToUser(liveShow.starId, template, data, {
            relatedEntity: { type: 'live_show', id: liveShow._id },
            apnsVoip: true
          });
        }
        await this.sendToLiveShowAttendees(liveShow._id, template, data, { apnsVoip: true, currentUserId });
        break;
    }
  }

  /**
   * Send dedication notifications
   */
  static async sendDedicationNotification(type, dedication, additionalData = {}) {
    const templates = notificationService.constructor.getNotificationTemplates();
    const template = templates[type];

    if (!template) {
      console.error(`Notification template not found for type: ${type}`);
      return;
    }

    // Check if dedication is in the past
    const isPastDedication = dedication.deliveryDate && new Date(dedication.deliveryDate) < new Date();

    const data = {
      type: template.type,
      dedicationId: dedication._id.toString(),
      isMessage: false, // Default to false, will be set to true only on approval
      ...additionalData
    };

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    console.log('[DedicationNotification] invoked', {
      type,
      dedicationId: dedication?._id?.toString?.() || String(dedication?._id || ''),
      fanId: dedication?.fanId?.toString?.() || String(dedication?.fanId || ''),
      starId: dedication?.starId?.toString?.() || String(dedication?.starId || ''),
      currentUserId
    });

    // Fetch star name for dedication notifications
    let starName = 'Star';
    try {
      if (dedication.starId) {
        const star = await User.findById(dedication.starId).select('name pseudo');
        starName = star?.name || star?.pseudo || starName;
      }
    } catch (_e) {}

    // Customize message for dedication accepted
    if (type === 'DEDICATION_ACCEPTED') {
      const customTemplate = {
        ...template,
        body: {
          en: `Your dedication Request was accepted by ${starName}`,
          fr: `Votre demande de dédicace a été acceptée par ${starName}`
        }
      };
      // Set isMessage to true when dedication is accepted
      data.isMessage = true;

      if (dedication.fanId && String(dedication.fanId) !== String(currentUserId)) {
        console.log('[DedicationNotification] send to fan (accepted)', {
          userId: dedication.fanId?.toString?.() || String(dedication.fanId || ''),
          title: customTemplate.title
        });
        await notificationService.sendToUser(dedication.fanId, customTemplate, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
    } else if (type === 'DEDICATION_REQUEST' || type === 'DEDICATION_REQUEST_CREATED') {
      // Send to star for new requests
      if (dedication.starId && String(dedication.starId) !== String(currentUserId)) {
        console.log('[DedicationNotification] send to star (request)', {
          userId: dedication.starId?.toString?.() || String(dedication.starId || ''),
          title: template.title
        });
        await notificationService.sendToUser(dedication.starId, template, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
    } else if (type === 'DEDICATION_COMPLETED') {
      // Set isMessage to false when dedication is completed
      data.isMessage = false;
      
      // Send completion notification to fan
      if (dedication.fanId && String(dedication.fanId) !== String(currentUserId)) {
        const completionTemplate = {
          ...template,
          title: {
            en: 'Dedication Completed',
            fr: 'Dédicace terminée'
          },
          body: {
            en: `Your dedication request has been completed by ${starName}`,
            fr: `Votre demande de dédicace a été terminée par ${starName}`
          }
        };
        
        await notificationService.sendToUser(dedication.fanId, completionTemplate, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
    } else if (type === 'DEDICATION_REJECTED') {
      // Send to fan for rejections
      if (dedication.fanId && String(dedication.fanId) !== String(currentUserId)) {
        console.log('[DedicationNotification] send to fan (rejected)', {
          userId: dedication.fanId?.toString?.() || String(dedication.fanId || ''),
          title: template.title
        });
        await notificationService.sendToUser(dedication.fanId, template, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
    } else if (type === 'DEDICATION_CANCELLED') {
      // Notify counterpart only: if star cancelled, notify fan; if fan cancelled, notify star
      const notifyFan = dedication.fanId && String(currentUserId) === String(dedication.starId);
      const notifyStar = dedication.starId && String(currentUserId) === String(dedication.fanId);

      if (notifyFan && String(dedication.fanId) !== String(currentUserId)) {
        const custom = {
          ...template,
          title: {
            en: 'Dedication Cancelled',
            fr: 'Dédicace annulée'
          },
          body: {
            en: 'Your dedication request was cancelled by the star.',
            fr: 'Votre demande de dédicace a été annulée par la star.'
          }
        };
        await notificationService.sendToUser(dedication.fanId, custom, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
      if (notifyStar && String(dedication.starId) !== String(currentUserId)) {
        const custom = {
          ...template,
          title: {
            en: 'Dedication Cancelled',
            fr: 'Dédicace annulée'
          },
          body: {
            en: 'The fan cancelled their dedication request.',
            fr: 'Le fan a annulé sa demande de dédicace.'
          }
        };
        await notificationService.sendToUser(dedication.starId, custom, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
    } else if (type === 'DEDICATION_VIDEO_UPLOADED') {
      // Notify fan about video upload
      const customTemplate = {
        ...template,
        body: {
          en: `Your dedication video was uploaded by ${starName}.`,
          fr: `Votre vidéo de dédicace a été téléchargée par ${starName}.`
        }
      };
      if (dedication.fanId && String(dedication.fanId) !== String(currentUserId)) {
        console.log('[DedicationNotification] send to fan (video_uploaded)', {
          userId: dedication.fanId?.toString?.() || String(dedication.fanId || ''),
          title: customTemplate.title
        });
        await notificationService.sendToUser(dedication.fanId, customTemplate, data, {
          relatedEntity: { type: 'dedication', id: dedication._id }
        });
      }
    }
  }

  /**
   * Send message notifications
   */
  static async sendMessageNotification(message, additionalData = {}) {
    const templates = notificationService.constructor.getNotificationTemplates();
    const baseTemplate = templates.NEW_MESSAGE;

    // Get current user ID from additionalData
    const currentUserId = additionalData.currentUserId || '';

    // Personalize message notification
    let senderName = 'Someone';
    try {
      if (message.senderId) {
        const sender = await User.findById(message.senderId).select('name pseudo');
        senderName = sender?.name || sender?.pseudo || senderName;
      }
    } catch (_e) {}

    const data = {
      type: baseTemplate.type,
      messageId: message._id.toString(),
      conversationId: message.conversationId?.toString(),
      senderName,
      ...additionalData
    };

    // Check if it's an image message
    const isImage = message.type === 'image' || !!message.imageUrl;
    
    // Get message preview text
    const messageText = (message.message || '').trim();
    
    // Determine notification body
    let notificationBody;
    if (isImage) {
      notificationBody = {
        en: 'Sent an image',
        fr: 'A envoyé une image'
      };
    } else if (messageText) {
      // For text messages, use the actual message text (same for both languages)
      notificationBody = messageText;
    } else {
      notificationBody = {
        en: 'Sent a message',
        fr: 'A envoyé un message'
      };
    }

    const template = {
      ...baseTemplate,
      title: {
        en: `New message from ${senderName}`,
        fr: `Nouveau message de ${senderName}`
      },
      body: notificationBody
    };

    // Send to the recipient if they are not the current user
    if (message.receiverId && String(message.receiverId) !== String(currentUserId)) {
      await notificationService.sendToUser(message.receiverId, template, data, {
        relatedEntity: { type: 'message', id: message._id }
      });
    }
  }

  /**
   * Send notification to star's followers
   */
  static async sendToStarFollowers(starId, template, data = {}, options = {}) {
    try {
      // Get current user ID from options
      const currentUserId = options.currentUserId || '';

      // Find users who have this star as favorite
      const followers = await User.find({
        favorites: { $in: [starId] },
        role: 'fan',
        $or: [
          { fcmToken: { $exists: true, $ne: null } },
          { apnsToken: { $exists: true, $ne: null } },
          { voipToken: { $exists: true, $ne: null } }
        ]
      });

      // Filter out current user from followers
      const followerIds = followers
        .filter(follower => String(follower._id) !== String(currentUserId))
        .map(follower => follower._id);

      if (followerIds.length > 0) {
        await notificationService.sendToMultipleUsers(followerIds, template, data, {
          relatedEntity: { type: 'live_show', id: starId },
          apnsVoip: options.apnsVoip === true
        });
      }
    } catch (error) {
      console.error('Error sending notification to star followers:', error);
    }
  }

  /**
   * Send notification to live show attendees
   */
  static async sendToLiveShowAttendees(liveShowId, template, data = {}, options = {}) {
    try {
      // Get current user ID from options
      const currentUserId = options.currentUserId || '';

      // Import LiveShowAttendance model
      const { LiveShowAttendance } = await import('../models/LiveShowAttendance.js');

      const attendees = await LiveShowAttendance.find({
        liveShowId: liveShowId,
        status: 'joined'
      }).populate('userId', 'fcmToken apnsToken voipToken role');

      const attendeeIds = attendees
        .filter(attendance => 
          attendance.userId?.role === 'fan' && 
          (attendance.userId?.fcmToken || attendance.userId?.apnsToken || attendance.userId?.voipToken) &&
          String(attendance.userId._id) !== String(currentUserId)
        )
        .map(attendance => attendance.userId._id);

      if (attendeeIds.length > 0) {
        await notificationService.sendToMultipleUsers(attendeeIds, template, data, {
          relatedEntity: { type: 'live_show', id: liveShowId },
          apnsVoip: options.apnsVoip === true
        });
      }
    } catch (error) {
      console.error('Error sending notification to live show attendees:', error);
    }
  }

  /**
   * Send custom notification
   */
  static async sendCustomNotification(userId, title, body, data = {}) {
    const notificationData = { title, body };
    // Ensure it's not VoIP by default - remove any VoIP flags from data
    const cleanData = { ...data };
    delete cleanData.pushType;
    delete cleanData.apnsVoip;
    await notificationService.sendToUser(userId, notificationData, cleanData);
  }

  /**
   * Send notification to multiple users with custom message
   */
  static async sendCustomNotificationToMultiple(userIds, title, body, data = {}) {
    const notificationData = { title, body };
    // Ensure it's not VoIP by default - remove any VoIP flags from data
    const cleanData = { ...data };
    delete cleanData.pushType;
    delete cleanData.apnsVoip;
    await notificationService.sendToMultipleUsers(userIds, notificationData, cleanData);
  }
}

export default NotificationHelper;
