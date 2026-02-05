import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Availability from '../models/Availability.js';
import Appointment from '../models/Appointment.js';
import { createTransaction, createHybridTransaction, completeTransaction, cancelTransaction } from '../services/transactionService.js';
import { TRANSACTION_TYPES, TRANSACTION_DESCRIPTIONS, createTransactionDescription, TRANSACTION_STATUSES } from '../utils/transactionConstants.js';
import Transaction from '../models/Transaction.js'; // Added missing import for Transaction
import NotificationHelper from '../utils/notificationHelper.js';
import { deleteConversationBetweenUsers } from '../services/messagingCleanup.js';
import { sanitizeUserData } from '../utils/userDataHelper.js';
import { moveEscrowToJackpot, refundEscrow } from '../services/starWalletService.js';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import { convertLocalToUTC } from '../utils/timezoneHelper.js';
import Review from '../models/Review.js';
import { startRecordingForChannel, stopRecording } from '../services/agoraCloudRecording.js';
import { recordingLog, RecordingSteps } from '../utils/recordingLogger.js';

const toUser = (u) => u ? sanitizeUserData(u) : null;

const toAvailability = (a) => (
  a && a._id ? {
    id: a._id,
    date: a.date,
    timeSlots: Array.isArray(a.timeSlots) ? a.timeSlots.map((t) => ({ id: t._id, slot: t.slot, status: t.status })) : [],
  } : a
);

const sanitize = (doc) => {
  // Calculate duration in seconds - use callDuration if available, otherwise 0
  const durationInSeconds = typeof doc.callDuration === 'number' ? doc.callDuration : 0;
  
  return {
    id: doc._id,
    star: toUser(doc.starId),
    fan: toUser(doc.fanId),
    availability: toAvailability(doc.availabilityId),
    timeSlotId: doc.timeSlotId,
    date: doc.date,
    time: doc.time,
    utcStartTime: doc.utcStartTime,
    price: doc.price,
    // Map in_progress to approved for outward responses as requested
    status: doc.status === 'in_progress' ? 'approved' : doc.status,
    paymentStatus: doc.paymentStatus || 'pending', // Always include paymentStatus, default to 'pending'
    transactionId: doc.transactionId,
    // Keep transaction status light; paymentStatus covers domain payment lifecycle
    completedAt: doc.completedAt,
    // Both callDuration and duration should be in seconds with same value
    callDuration: durationInSeconds, // Duration in seconds
    duration: durationInSeconds, // Duration in seconds (same as callDuration)
    // Always include isRescheduled flag (defaults to false if not set)
    isRescheduled: doc.isRescheduled === true,
    ...(doc.parentAppointment ? { parentAppointment: doc.parentAppointment } : {}),
    ...(doc.referenceAppointment ? { referenceAppointment: doc.referenceAppointment } : {}),
    // is_appointment_pending: true when appointment is completed but fan hasn't given review yet
    is_appointment_pending: doc.is_appointment_pending === true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    // Cloud recording: so client can show recording status and play files
    recordingStatus: doc.recordingStatus || 'not_started',
    recordingFiles: Array.isArray(doc.recordingFiles) ? doc.recordingFiles : [],
    recordingStartedAt: doc.recordingStartedAt || null,
    recordingStoppedAt: doc.recordingStoppedAt || null,
  };
};

// Get single appointment details
export const getAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }

    // Find appointment - fans can only see their own, stars can see their own, admins can see all
    let filter = { _id: id };
    if (userRole === 'fan') {
      filter.fanId = userId;
    } else if (userRole === 'star') {
      filter.starId = userId;
    }
    // Admin can see all appointments (no additional filter)

    const appointment = await Appointment.findOne(filter)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId', 'date timeSlots')
      .populate('transactionId', 'amount status type')
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Stars should not be able to access appointments where payment is not complete
    if (req.user.role === 'star' && appointment.paymentStatus === 'initiated') {
      return res.status(403).json({ 
        success: false, 
        message: 'Appointment not available - payment pending' 
      });
    }

    // Add computed fields similar to listAppointments
    const parseStartDate = (dateStr, timeStr) => {
      const [year, month, day] = (dateStr || '').split('-').map((v) => parseInt(v, 10));
      let hours = 0;
      let minutes = 0;
      if (typeof timeStr === 'string') {
        const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m) {
          hours = parseInt(m[1], 10);
          minutes = parseInt(m[2], 10);
          const ampm = m[3].toUpperCase();
          if (ampm === 'PM' && hours !== 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }
      const d = new Date(year || 0, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
      return d;
    };

    let timeSlotObj = undefined;
    if (appointment.availabilityId && appointment.availabilityId.timeSlots) {
      const found = appointment.availabilityId.timeSlots.find((s) => String(s._id) === String(appointment.timeSlotId));
      if (found) timeSlotObj = { id: found._id, slot: found.slot, status: found.status };
    }

    const startAt = parseStartDate(appointment.date, appointment.time);
    const timeToNowMs = startAt.getTime() - Date.now();

    const appointmentData = {
      ...sanitize(appointment),
      timeSlot: timeSlotObj,
      startAt: isNaN(startAt.getTime()) ? undefined : startAt.toISOString(),
      timeToNowMs
    };

    return res.status(200).json({
      success: true,
      message: 'Appointment details retrieved successfully',
      data: {
        appointment: appointmentData
      }
    });

  } catch (error) {
    console.error('Error fetching appointment details:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching appointment details',
      error: error.message
    });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    let { starId, starBaroniId, baroniId, availabilityId, timeSlotId, price, starName } = req.body;

    const User = (await import('../models/User.js')).default;

    // Resolve star: by Baroni ID or by starId
    if (!starId && (starBaroniId || baroniId)) {
      const starByBaroni = await User.findOne({ baroniId: starBaroniId || baroniId, role: 'star' }).select('_id');
      if (!starByBaroni) {
        return res.status(404).json({ success: false, message: 'Star not found', code: 'STAR_NOT_FOUND' });
      }
      starId = starByBaroni._id;
    } else if (starId) {
      const star = await User.findOne({ _id: starId, role: 'star' }).select('_id');
      if (!star) {
        return res.status(404).json({ success: false, message: 'Star not found', code: 'STAR_NOT_FOUND' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Star is required (starId or starBaroniId/baroniId)' });
    }

    const availability = await Availability.findOne({ _id: availabilityId, userId: starId });
    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Availability not found. It may have been removed or the slot is no longer offered.',
        code: 'AVAILABILITY_NOT_FOUND'
      });
    }

    // Validate that the appointment date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(availability.date);

    if (appointmentDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book appointments for past dates'
      });
    }

    // If the appointment is for today, validate that the time slot is not in the past
    const isToday = appointmentDate.getTime() === today.getTime();
    if (isToday) {
      const slot = availability.timeSlots.find((s) => String(s._id) === String(timeSlotId));
      if (slot) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const timeMatch = slot.slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1], 10);
          const minute = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3].toUpperCase();

          if (ampm === 'PM' && hour !== 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;

          const slotTime = hour * 60 + minute;
          if (slotTime <= currentTime) {
            return res.status(400).json({
              success: false,
              message: `Cannot book appointments for past time slots. Time slot "${slot.slot}" is in the past.`
            });
          }
        }
      }
    }

    const slot = availability.timeSlots.find((s) => String(s._id) === String(timeSlotId));
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Time slot not found or no longer available.',
        code: 'TIME_SLOT_NOT_FOUND'
      });
    }
    // Check if slot is unavailable (booked) or locked (payment link sent, waiting for payment)
    if (slot.status === 'unavailable' || slot.status === 'locked') {
      return res.status(409).json({ 
        success: false, 
        message: slot.status === 'locked' 
          ? 'Time slot is temporarily locked. Please wait for the previous booking to complete or timeout.' 
          : 'Time slot unavailable' 
      });
    }

    // Create hybrid transaction before creating appointment
    let transactionResult;
    try {
      const { contact: payloadContact } = req.body || {};
      const { normalizeContact } = await import('../utils/normalizeContact.js');
      const normalizedPhone = normalizeContact(payloadContact || '');
      if (!normalizedPhone) {
        return res.status(400).json({ success: false, message: 'User phone number is required' });
      }
      transactionResult = await createHybridTransaction({
        type: TRANSACTION_TYPES.APPOINTMENT_PAYMENT,
        payerId: req.user._id,
        receiverId: starId,
        amount: price,
        description: createTransactionDescription(TRANSACTION_TYPES.APPOINTMENT_PAYMENT, req.user.name || req.user.pseudo || '', starName || '', req.user.role || 'fan', 'star'),
        userPhone: normalizedPhone,
        starName: starName || '',
        metadata: {
          appointmentType: 'booking',
          availabilityId,
          timeSlotId,
          date: availability.date,
          time: slot.slot,
          payerName: req.user.name || req.user.pseudo || ''
        }
      });
    } catch (transactionError) {
      return res.status(400).json({
        success: false,
        message: 'Transaction failed: ' + transactionError.message
      });
    }

    // Get the created transaction ID
    const transaction = await Transaction.findOne({
      payerId: req.user._id,
      receiverId: starId,
      type: TRANSACTION_TYPES.APPOINTMENT_PAYMENT,
      status: { $in: ['pending', 'initiated'] }
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve transaction'
      });
    }

    // Get fan's country for timezone conversion
    const fan = await (await import('../models/User.js')).default.findById(req.user._id).select('country');
    const fanCountry = fan?.country || null;

    // Convert local time to UTC based on fan's country
    const utcStartTime = convertLocalToUTC(availability.date, slot.slot, fanCountry);

    // Log UTC time for debugging
    console.log(`[CreateAppointment] Appointment UTC conversion:`, {
      date: availability.date,
      time: slot.slot,
      country: fanCountry || 'unknown',
      utcStartTime: utcStartTime.toISOString(),
      utcTimestamp: utcStartTime.getTime()
    });

    const created = await Appointment.create({
      starId,
      fanId: req.user._id,
      availabilityId,
      timeSlotId,
      date: availability.date,
      time: slot.slot,
      utcStartTime,
      price,
      status: 'pending',
      paymentStatus: transaction.status === 'initiated' ? 'initiated' : 'pending',
      transactionId: transaction._id,
    });

    // Verify UTC time was stored correctly
    console.log(`[CreateAppointment] Appointment created with UTC time:`, {
      appointmentId: created._id,
      storedUtcStartTime: created.utcStartTime?.toISOString(),
      storedUtcTimestamp: created.utcStartTime?.getTime()
    });

    // Handle slot reservation based on payment mode
    try {
      if (transactionResult.paymentMode === 'coin') {
        // For coin-only payments, mark slot as unavailable (booked) immediately
        const coinUpdateResult = await Availability.updateOne(
          { _id: availabilityId, userId: starId, 'timeSlots._id': timeSlotId, 'timeSlots.status': 'available' },
          { $set: { 'timeSlots.$.status': 'unavailable' } }
        );
        if (coinUpdateResult.matchedCount === 0) {
          console.warn(`[CreateAppointment] ⚠ Slot not found or already booked for coin-only payment - appointment ${created._id}`);
        } else {
          console.log(`[CreateAppointment] ✓ Slot marked as unavailable for coin-only payment - appointment ${created._id}, updateResult:`, coinUpdateResult);
        }
      } else if (transactionResult.paymentMode === 'hybrid' && transaction.externalPaymentId) {
        // For hybrid payments with external payment link, lock the slot for 10 minutes
        // Slot will be unlocked if payment not completed within 10 minutes, or marked unavailable if payment completes
        const lockUpdateResult = await Availability.updateOne(
          { _id: availabilityId, userId: starId, 'timeSlots._id': timeSlotId, 'timeSlots.status': 'available' },
          { 
            $set: { 
              'timeSlots.$.status': 'locked',
              'timeSlots.$.paymentReferenceId': transaction.externalPaymentId,
              'timeSlots.$.lockedAt': new Date()
            } 
          }
        );
        if (lockUpdateResult.matchedCount === 0) {
          console.warn(`[CreateAppointment] ⚠ Slot not found or already booked/locked for hybrid payment - appointment ${created._id}`);
        } else {
          console.log(`[CreateAppointment] ✓ Slot locked for external payment (10 min timeout) - appointment ${created._id}, payment ${transaction.externalPaymentId}, updateResult:`, lockUpdateResult);
        }
      } else {
        console.warn(`[CreateAppointment] ⚠ No slot status update - paymentMode: ${transactionResult.paymentMode}, externalPaymentId: ${transaction.externalPaymentId || 'none'}`);
      }
    } catch (slotError) {
      console.error('[CreateAppointment] ✗ Error updating slot status:', slotError);
      // Don't fail the appointment creation if slot update fails, but log the error
    }

    // Handle coin-only payments immediately
    if (transactionResult.paymentMode === 'coin') {
      try {
        // Complete the transaction immediately for coin-only payments
        // NOTE: completeTransaction does NOT send notification (removed to avoid duplicates)
        await completeTransaction(transaction._id);
        
        // Verify transaction is completed before sending notification
        const completedTransaction = await Transaction.findById(transaction._id);
        if (completedTransaction && completedTransaction.status === 'completed') {
          // Send notification to star for coin-only payments (only once, here)
          console.log(`[AppointmentCreated] Sending notification for coin-only payment - appointment ${created._id}, transaction ${transaction._id}`);
          await NotificationHelper.sendAppointmentNotification('APPOINTMENT_CREATED', created, { currentUserId: req.user._id });
          console.log(`[AppointmentCreated] ✓ Coin-only payment completed, notification sent for appointment ${created._id}`);
          
          // Send notification to fan that request is now on star's side for validation
          try {
            const fanNotificationTemplate = {
              title: {
                en: 'Request Submitted',
                fr: 'Demande soumise'
              },
              body: {
                en: "Your request is now on star's side for validation. please wait.",
                fr: 'Votre demande est maintenant du côté de la star pour validation. Veuillez patienter.'
              }
            };
            const fanNotificationData = {
              type: 'appointment_payment_completed',
              appointmentId: created._id.toString(),
              starId: created.starId?.toString?.() || String(created.starId || ''),
              fanId: created.fanId?.toString?.() || String(created.fanId || ''),
              navigateTo: 'appointment',
              eventType: 'APPOINTMENT_PAYMENT_COMPLETED'
            };
            const { default: notificationService } = await import('../services/notificationService.js');
            await notificationService.sendToUser(created.fanId, fanNotificationTemplate, fanNotificationData, {
              relatedEntity: { type: 'appointment', id: created._id }
            });
            console.log(`[AppointmentCreated] ✓ Fan notification sent - request is on star's side for validation`);
          } catch (fanNotificationError) {
            console.error('[AppointmentCreated] Error sending fan notification:', fanNotificationError);
            // Don't fail the request if fan notification fails
          }
        } else {
          console.warn(`[AppointmentCreated] ⚠ Transaction ${transaction._id} not completed yet, skipping notification to avoid duplicates`);
        }
      } catch (error) {
        console.error('[AppointmentCreated] ✗ Error handling coin-only payment:', error);
      }
    }
    // For hybrid payments, notification will be sent after payment completion in paymentCallbackService
    // (only for hybrid payments, not coin-only, to avoid duplicates)

    const responseBody = { 
      success: true, 
      message: 'Appointment created successfully',
      data: {
        appointment: sanitize(created)
      }
    };
    if (transactionResult && transactionResult.paymentMode === 'hybrid' || transactionResult?.externalAmount > 0) {
      if (transactionResult.externalPaymentMessage) {
        responseBody.data.externalPaymentMessage = transactionResult.externalPaymentMessage;
      }
    }
    return res.status(201).json(responseBody);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listAppointments = async (req, res) => {
  try {
    // Log raw request details for debugging
    console.log(`[ListAppointments] ===== REQUEST RECEIVED =====`);
    console.log(`[ListAppointments] Raw req.query:`, JSON.stringify(req.query, null, 2));
    console.log(`[ListAppointments] req.query type:`, typeof req.query);
    console.log(`[ListAppointments] req.query.limit:`, req.query?.limit, `(type: ${typeof req.query?.limit})`);
    console.log(`[ListAppointments] req.query.page:`, req.query?.page, `(type: ${typeof req.query?.page})`);
    console.log(`[ListAppointments] Full req.url:`, req.url);
    console.log(`[ListAppointments] Full req.originalUrl:`, req.originalUrl);
    
    // Admin can see all appointments - no filter by user ID
    // Stars see only their own appointments, Fans see only their own appointments
    let filter = {};
    
    if (req.user.role === 'admin') {
      // Admin sees all appointments - no filter needed
      filter = {};
    } else if (req.user.role === 'star') {
      // Stars see only their own appointments
      filter = { starId: req.user._id };
      // Stars should only see appointments where payment is complete (not 'initiated')
      filter.paymentStatus = { $ne: 'initiated' };
    } else {
      // Fans see only their own appointments
      filter = { fanId: req.user._id };
    }
    
    // Optional date filtering: exact date or range via startDate/endDate
    // Accepts both YYYY-MM-DD format and ISO 8601 format (will extract date part)
    const { date, startDate, endDate, status, page, limit, search } = req.query || {};
    
    console.log(`[ListAppointments] After destructuring - page:`, page, `limit:`, limit);
    console.log(`[ListAppointments] Date filter params - date:`, date, `startDate:`, startDate, `endDate:`, endDate);
    console.log(`[ListAppointments] Search param:`, search);
    
    // Helper function to extract YYYY-MM-DD from ISO 8601 or YYYY-MM-DD format
    const extractDateString = (dateInput) => {
      if (!dateInput || typeof dateInput !== 'string') return null;
      const trimmed = dateInput.trim();
      
      // If it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      
      // If it's in ISO 8601 format (e.g., 2025-11-14T06:54:19.171Z)
      if (trimmed.includes('T') || trimmed.includes(' ')) {
        try {
          const dateObj = new Date(trimmed);
          if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString().split('T')[0]; // Extract YYYY-MM-DD
          }
        } catch (e) {
          console.error(`[ListAppointments] Error parsing date:`, trimmed, e);
        }
      }
      
      return null;
    };
    
    // Track the minimum date for filtering (to exclude cancelled appointments from before this date)
    let minFilterDate = null;
    
    // Apply date filter - this should properly exclude appointments from dates before the filter
    if (date && typeof date === 'string' && date.trim()) {
      // Exact date match
      const extractedDate = extractDateString(date);
      if (extractedDate) {
        filter.date = extractedDate;
        minFilterDate = extractedDate;
        console.log(`[ListAppointments] Applied exact date filter:`, extractedDate);
      }
    } else if (startDate || endDate) {
      // Extract dates from ISO or YYYY-MM-DD format
      const normalizedStartDate = startDate ? extractDateString(startDate) : null;
      const normalizedEndDate = endDate ? extractDateString(endDate) : null;
      
      // Date range filtering - if both are same, it's an exact match
      if (normalizedStartDate && normalizedEndDate && normalizedStartDate === normalizedEndDate) {
        // Exact date match when both are same
        filter.date = normalizedStartDate;
        minFilterDate = normalizedStartDate;
        console.log(`[ListAppointments] Applied exact date filter (from range):`, normalizedStartDate);
      } else {
        // Range filtering
        const range = {};
        if (normalizedStartDate) {
          range.$gte = normalizedStartDate;
          minFilterDate = normalizedStartDate;
          console.log(`[ListAppointments] Applied startDate filter:`, normalizedStartDate);
        }
        if (normalizedEndDate) {
          range.$lte = normalizedEndDate;
          console.log(`[ListAppointments] Applied endDate filter:`, normalizedEndDate);
        }
        // Only apply range filter if at least one date is provided and valid
        if (Object.keys(range).length > 0) {
          filter.date = range;
          console.log(`[ListAppointments] Applied date range filter:`, range);
        }
      }
    }
    
    // Search filtering (by star name, fan name, or Baroni ID)
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, 'i');
      
      // Find matching users (stars and fans)
      const [starIds, fanIds] = await Promise.all([
        User.find({
          $or: [
            { name: searchRegex },
            { baroniId: searchRegex },
            { pseudo: searchRegex }
          ],
          role: 'star'
        }).select('_id').lean(),
        User.find({
          $or: [
            { name: searchRegex },
            { baroniId: searchRegex },
            { pseudo: searchRegex }
          ]
        }).select('_id').lean()
      ]);
      
      const allSearchIds = [
        ...starIds.map(s => s._id),
        ...fanIds.map(u => u._id)
      ];
      
      if (allSearchIds.length > 0) {
        // Store search condition for later use
        const searchCondition = {
          $or: [
            { starId: { $in: allSearchIds } },
            { fanId: { $in: allSearchIds } }
          ]
        };
        
        // Store search condition in filter for later preservation
        filter._searchCondition = searchCondition;
        console.log(`[ListAppointments] Applied search filter for:`, searchTerm, `Found ${allSearchIds.length} matching users`);
      } else {
        // If no users found, return empty result
        filter._id = null; // This will match nothing
        console.log(`[ListAppointments] Search term "${searchTerm}" found no matching users`);
      }
    }
    
    // Status filtering
    if (status && typeof status === 'string' && status.trim()) {
      const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
      if (validStatuses.includes(status.trim())) {
        filter.status = status.trim();
        console.log(`[ListAppointments] Applied status filter:`, status.trim());
      }
    }
    
    // Track if we have a search filter (stored in $and or $or)
    const hasSearchFilter = !!(filter.$and || (filter.$or && !filter.date));
    
    // Ensure date filter is properly applied and exclude cancelled appointments from before the filter date
    if (minFilterDate) {
      const existingDateFilter = filter.date;
      const hasStatusFilter = !!filter.status;
      
      // Check if it's an exact date match (string) or a range (object with $gte/$lte)
      const isExactDate = typeof existingDateFilter === 'string';
      
      // If we have a date filter and no status filter, we need to handle cancelled appointments specially
      if (existingDateFilter && !hasStatusFilter) {
        // Extract base filters (everything except date, status, $and, $or, _searchCondition)
        const baseFilters = {};
        const searchCondition = filter._searchCondition; // Preserve search condition
        Object.keys(filter).forEach(key => {
          if (key !== 'date' && key !== 'status' && key !== '$and' && key !== '$or' && key !== '_searchCondition') {
            baseFilters[key] = filter[key];
          }
        });
        
        // Use $and to combine base filters with date/status conditions
        // This ensures the date filter works correctly
        const andConditions = [];
        
        // Add all base filters
        Object.keys(baseFilters).forEach(key => {
          andConditions.push({ [key]: baseFilters[key] });
        });
        
        // Add search condition if it exists
        if (searchCondition) {
          andConditions.push(searchCondition);
        }
        
        // Determine the date condition for cancelled appointments
        let cancelledDateCondition;
        if (isExactDate) {
          // For exact date matches, cancelled appointments must match the exact date
          cancelledDateCondition = existingDateFilter;
        } else {
          // For date ranges, cancelled appointments must be >= minFilterDate
          cancelledDateCondition = { $gte: minFilterDate };
        }
        
        // Add date/status condition using $or
        andConditions.push({
          $or: [
            // Non-cancelled appointments: apply the date filter as-is
            {
              $and: [
                { status: { $ne: 'cancelled' } },
                { date: existingDateFilter }
              ]
            },
            // Cancelled appointments: use the appropriate date condition
            {
              $and: [
                { status: 'cancelled' },
                { date: cancelledDateCondition }
              ]
            }
          ]
        });
        
        // Build the filter with $and
        filter = { $and: andConditions };
        
        console.log(`[ListAppointments] Applied date filter with cancelled exclusion using $and. Date filter:`, existingDateFilter, `minFilterDate:`, minFilterDate, `isExactDate:`, isExactDate, `cancelledDateCondition:`, cancelledDateCondition);
      } else if (existingDateFilter) {
        // Date filter exists and status filter is set - date filter should work as-is
        // But we still need to preserve search condition if it exists
        const searchCondition = filter._searchCondition;
        if (searchCondition) {
          // If filter has simple structure, combine with $and
          if (!filter.$and) {
            const baseFilter = { ...filter };
            delete baseFilter._searchCondition;
            filter = {
              $and: [
                baseFilter,
                searchCondition
              ]
            };
          } else {
            // $and already exists, add search to it
            filter.$and.push(searchCondition);
            delete filter._searchCondition;
          }
        }
        console.log(`[ListAppointments] Date filter applied:`, existingDateFilter);
      } else {
        // No date filter yet, add it
        filter.date = { $gte: minFilterDate };
        console.log(`[ListAppointments] Applied date filter:`, filter.date);
      }
    } else {
      // No date filter applied - exclude cancelled appointments from past dates (before today)
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Calculate yesterday's date (to show appointments from yesterday onwards)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // When no date filter, exclude cancelled appointments from before yesterday
      // This means cancelled appointments must be from yesterday or today onwards
      const hasStatusFilter = !!filter.status;
      
      if (!hasStatusFilter) {
        // Extract base filters (everything except status, $and, $or, and _searchCondition)
        const baseFilters = {};
        const searchCondition = filter._searchCondition; // Preserve search condition
        Object.keys(filter).forEach(key => {
          if (key !== 'status' && key !== '$and' && key !== '$or' && key !== '_searchCondition') {
            baseFilters[key] = filter[key];
          }
        });
        
        // Use $and to combine base filters with status/date conditions
        const andConditions = [];
        
        // Add all base filters
        Object.keys(baseFilters).forEach(key => {
          andConditions.push({ [key]: baseFilters[key] });
        });
        
        // Add search condition if it exists
        if (searchCondition) {
          andConditions.push(searchCondition);
        }
        
        // Add condition: (non-cancelled) OR (cancelled AND date >= yesterday)
        andConditions.push({
          $or: [
            // Non-cancelled appointments: no date restriction
            {
              status: { $ne: 'cancelled' }
            },
            // Cancelled appointments: only from yesterday onwards
            {
              $and: [
                { status: 'cancelled' },
                { date: { $gte: yesterdayStr } }
              ]
            }
          ]
        });
        
        // Build the filter with $and
        filter = { $and: andConditions };
        
        console.log(`[ListAppointments] No date filter - excluding cancelled appointments before:`, yesterdayStr);
      } else {
        // Has status filter but no date filter - still need to preserve search condition
        const searchCondition = filter._searchCondition;
        if (searchCondition) {
          // If filter has simple structure, combine with $and
          if (!filter.$and) {
            const baseFilter = { ...filter };
            delete baseFilter._searchCondition;
            filter = {
              $and: [
                baseFilter,
                searchCondition
              ]
            };
          } else {
            // $and already exists, add search to it
            filter.$and.push(searchCondition);
            delete filter._searchCondition;
          }
        }
      }
    }
    
    // Remove temporary _searchCondition field before querying MongoDB (if still exists)
    if (filter._searchCondition) {
      delete filter._searchCondition;
    }
    
    // Log the final filter being applied
    console.log(`[ListAppointments] ===== FINAL FILTER =====`);
    console.log(`[ListAppointments] Filter object:`, JSON.stringify(filter, null, 2));
    console.log(`[ListAppointments] =========================`);
    
    // Include all appointments regardless of completion status
    // Sorting will handle the order: pending -> approved -> completed -> cancelled/rejected
    // Within each status, sorted by date ascending (nearest to furthest)
    console.log(`[ListAppointments] Including all appointments - sorting will handle order by status priority and date`);
    
    // Pagination - fetch all first for proper global sorting, then paginate
    // Parse page and limit from query parameters
    console.log(`[ListAppointments] Before parsing - page:`, page, `(type: ${typeof page}), limit:`, limit, `(type: ${typeof limit})`);
    
    const pageNum = page ? parseInt(String(page), 10) : 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 10;
    
    console.log(`[ListAppointments] After parseInt - pageNum:`, pageNum, `limitNum:`, limitNum);
    console.log(`[ListAppointments] isNaN checks - pageNum isNaN:`, isNaN(pageNum), `limitNum isNaN:`, isNaN(limitNum));
    
    // Ensure valid values
    const finalPageNum = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
    const finalLimitNum = isNaN(limitNum) || limitNum < 1 ? 10 : limitNum;
    
    console.log(`[ListAppointments] ===== PAGINATION PARAMS =====`);
    console.log(`[ListAppointments] Raw from query - page:`, page, `limit:`, limit);
    console.log(`[ListAppointments] Parsed values - pageNum:`, pageNum, `limitNum:`, limitNum);
    console.log(`[ListAppointments] Final values - finalPageNum:`, finalPageNum, `finalLimitNum:`, finalLimitNum);
    console.log(`[ListAppointments] ============================`);
    
    // Get total count for pagination info
    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / finalLimitNum);
    
    // Fetch all appointments (without pagination) to ensure proper global sorting
    // Then we'll sort and paginate in memory
    const allItems = await Appointment.find(filter)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId');

    const parseStartDate = (dateStr, timeStr) => {
      try {
        if (!dateStr || typeof dateStr !== 'string') {
          return new Date(0); // Invalid date
        }
        
        const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          return new Date(0); // Invalid date
        }
        
        let hours = 0;
        let minutes = 0;
        
        if (typeof timeStr === 'string') {
          // Handle time ranges like "09:30 - 09:50" by taking first part
          const timePart = timeStr.split('-')[0].trim();
          const m = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (m) {
            hours = parseInt(m[1], 10);
            minutes = parseInt(m[2], 10);
            const ampm = (m[3] || '').toUpperCase();
            if (ampm === 'PM' && hours !== 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
          }
        }
        
        const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return isNaN(d.getTime()) ? new Date(0) : d;
      } catch (error) {
        console.error(`[ListAppointments] Error parsing date/time: date=${dateStr}, time=${timeStr}`, error);
        return new Date(0); // Return invalid date on error
      }
    };

    // Pre-fetch all conversations between fan-star pairs for better performance
    // Get unique fan-star pairs from appointments
    const userPairs = new Set();
    allItems.forEach(doc => {
      if (doc.fanId?._id && doc.starId?._id) {
        const fanId = String(doc.fanId._id);
        const starId = String(doc.starId._id);
        const pairKey = [fanId, starId].sort().join(',');
        userPairs.add(pairKey);
      }
    });
    
    // Fetch conversations for all pairs using $all operator
    const conversationPromises = Array.from(userPairs).map(pairKey => {
      const [id1, id2] = pairKey.split(',');
      return Conversation.findOne({
        participants: { $all: [id1, id2] }
      }).lean();
    });
    
    const conversations = await Promise.all(conversationPromises);
    
    // Create a map for quick lookup: sorted participants array -> conversationId
    const conversationMap = new Map();
    conversations.forEach(conv => {
      if (conv) {
        const sortedParticipants = [...conv.participants].sort();
        conversationMap.set(sortedParticipants.join(','), conv._id.toString());
      }
    });

    const withComputed = allItems.map((doc) => {
      const base = sanitize(doc);
      let timeSlotObj = undefined;
      if (doc.availabilityId && doc.availabilityId.timeSlots) {
        const found = doc.availabilityId.timeSlots.find((s) => String(s._id) === String(doc.timeSlotId));
        if (found) timeSlotObj = { id: found._id, slot: found.slot, status: found.status };
      }
      
      // Use UTC start time if available (preferred), otherwise fallback to parsing date/time
      let startAt;
      if (doc.utcStartTime) {
        startAt = new Date(doc.utcStartTime);
      } else {
        // Fallback: parse from date and time (for backward compatibility)
        startAt = parseStartDate(base.date, base.time);
      }
      
      const timeToNowMs = isNaN(startAt.getTime()) ? 0 : startAt.getTime() - Date.now();
      
      // Find conversation between fan and star
      let conversationId = null;
      if (doc.fanId?._id && doc.starId?._id) {
        const participants = [String(doc.fanId._id), String(doc.starId._id)].sort();
        const key = participants.join(',');
        conversationId = conversationMap.get(key) || null;
      }
      
      return { ...base, timeSlot: timeSlotObj, startAt: isNaN(startAt.getTime()) ? undefined : startAt.toISOString(), timeToNowMs, conversationId };
    });

    // Apply proper sorting logic: by status priority, then by date ascending
    // Status priority: (1) pending, (2) approved/in_progress, (3) missed, (4) completed, (5) cancelled/rejected
    // Within each status group, sort by date ascending (nearest to furthest)
    // MISSED status always comes before COMPLETED status
    
    const getStatusPriority = (status) => {
      switch (status) {
        case 'pending': return 1;
        case 'approved': 
        case 'in_progress': return 2;
        case 'missed': return 3; // Missed comes before completed
        case 'completed': return 4;
        case 'cancelled':
        case 'rejected': return 5;
        case 'rescheduled': return 6;
        default: return 7;
      }
    };
    
    // For fans and stars: Sort by status priority first (pending always first), then by date/time
    // For admin: Sort by date/time descending (newest first), then by status priority
    const isFan = req.user.role === 'fan';
    const isStar = req.user.role === 'star';
    
    const data = withComputed.sort((a, b) => {
      // Get appointment time for A - handle all edge cases
      let timeA;
      if (a.startAt && typeof a.startAt === 'string') {
        // Use computed startAt (preferred - already in ISO format)
        const parsed = new Date(a.startAt);
        timeA = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (a.utcStartTime) {
        // Fallback to utcStartTime (can be Date object or string)
        const parsed = new Date(a.utcStartTime);
        timeA = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (a.date && a.time) {
        // Fallback: parse from date and time (for backward compatibility)
        const parsedA = parseStartDate(a.date, a.time);
        timeA = isNaN(parsedA.getTime()) ? 0 : parsedA.getTime();
      } else {
        // No valid date/time - put at end (use 0 to put at beginning of invalid dates)
        timeA = 0;
      }
      
      // Get appointment time for B - handle all edge cases
      let timeB;
      if (b.startAt && typeof b.startAt === 'string') {
        // Use computed startAt (preferred - already in ISO format)
        const parsed = new Date(b.startAt);
        timeB = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (b.utcStartTime) {
        // Fallback to utcStartTime (can be Date object or string)
        const parsed = new Date(b.utcStartTime);
        timeB = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (b.date && b.time) {
        // Fallback: parse from date and time (for backward compatibility)
        const parsedB = parseStartDate(b.date, b.time);
        timeB = isNaN(parsedB.getTime()) ? 0 : parsedB.getTime();
      } else {
        // No valid date/time - put at end (use 0 to put at beginning of invalid dates)
        timeB = 0;
      }
      
      // Get status priorities
      const statusPriorityA = getStatusPriority(a.status);
      const statusPriorityB = getStatusPriority(b.status);
      
      if (isFan || isStar) {
        // For fans and stars: Primary sort by status priority (pending first), then by date/time ascending
        if (statusPriorityA !== statusPriorityB) {
          return statusPriorityA - statusPriorityB;
        }
        
        // Secondary sort: by date/time ascending (nearest to furthest) within same status
        if (timeA !== timeB) {
          return timeA - timeB; // Ascending order (nearest first)
        }
      } else {
        // For admin: Primary sort by date/time descending (newest first), then by status priority
        if (timeA !== timeB) {
          return timeB - timeA; // Descending order (newest first)
        }
        
        // Secondary sort: by status priority (if same date/time)
        if (statusPriorityA !== statusPriorityB) {
          return statusPriorityA - statusPriorityB;
        }
      }
      
      // Tertiary sort: use _id as tiebreaker for stable sorting
      const idA = a._id ? String(a._id) : '';
      const idB = b._id ? String(b._id) : '';
      return idA.localeCompare(idB);
    });
    
    // Apply pagination after sorting
    const skip = (finalPageNum - 1) * finalLimitNum;
    const paginatedData = data.slice(skip, skip + finalLimitNum);

    // Log sorting verification (first few items to verify order)
    if (data.length > 0) {
      console.log(`[ListAppointments] ===== SORTING VERIFICATION =====`);
      console.log(`[ListAppointments] Total appointments: ${data.length}`);
      console.log(`[ListAppointments] First 10 items (sorted order):`);
      data.slice(0, 10).forEach((item, idx) => {
        const statusPriority = getStatusPriority(item.status);
        let timeValue = 'N/A';
        if (item.startAt) {
          timeValue = new Date(item.startAt).toISOString();
        } else if (item.utcStartTime) {
          timeValue = new Date(item.utcStartTime).toISOString();
        } else if (item.date && item.time) {
          const parsed = parseStartDate(item.date, item.time);
          timeValue = isNaN(parsed.getTime()) ? 'Invalid' : parsed.toISOString();
        }
        console.log(`  [${idx + 1}] Status: ${item.status} (priority: ${statusPriority}), Date: ${item.date}, Time: ${item.time}, StartAt: ${timeValue}`);
      });
      
      // Log status distribution
      const statusCounts = {};
      data.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });
      console.log(`[ListAppointments] Status distribution:`, statusCounts);
      console.log(`[ListAppointments] ================================`);
    }

    console.log(`[ListAppointments] Pagination result:`, {
      totalCount,
      totalPages,
      skip,
      requestedLimit: finalLimitNum,
      returnedItems: paginatedData.length
    });

    const responsePayload = { 
      success: true, 
      message: 'Appointments retrieved successfully',
      data: paginatedData,
      pagination: {
        currentPage: finalPageNum,
        totalPages,
        totalCount,
        limit: finalLimitNum,
        hasNextPage: finalPageNum < totalPages,
        hasPrevPage: finalPageNum > 1
      }
    };
    
    console.log(`[ListAppointments] ===== RESPONSE PAYLOAD =====`);
    console.log(`[ListAppointments] Response pagination.limit:`, responsePayload.pagination.limit);
    console.log(`[ListAppointments] Response pagination:`, JSON.stringify(responsePayload.pagination, null, 2));
    console.log(`[ListAppointments] ============================`);

    return res.json(responsePayload);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const approveAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const appt = await Appointment.findOne({ _id: id, starId: req.user._id });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appt.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending can be approved' });
    
    // Stars cannot approve appointments where payment is not complete
    if (appt.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Cannot approve - payment not complete' });
    }

    appt.status = 'approved';
    const updated = await appt.save();

    // Mark the slot as unavailable when appointment is approved
    // This ensures the slot is blocked and won't show up for other fans
    try {
      const updateResult = await Availability.updateOne(
        { 
          _id: appt.availabilityId, 
          userId: appt.starId, 
          'timeSlots._id': appt.timeSlotId 
        },
        { 
          $set: { 
            'timeSlots.$.status': 'unavailable'
          } 
        }
      );
      console.log(`[ApproveAppointment] Slot marked as unavailable for appointment ${appt._id}, updateResult:`, updateResult);
    } catch (slotError) {
      console.error(`[ApproveAppointment] Error updating slot status for appointment ${appt._id}:`, slotError);
      // Continue even if slot update fails - appointment is already approved
    }

    // Send notification to fan about appointment approval
    try {
      await NotificationHelper.sendAppointmentNotification('APPOINTMENT_ACCEPTED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending appointment approval notification:', notificationError);
    }

    // Populate the appointment with related data before returning
    const populatedAppointment = await Appointment.findById(updated._id)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId', 'date timeSlots');

    return res.json({ 
      success: true, 
      message: 'Appointment approved successfully',
      data: {
        appointment: sanitize(populatedAppointment)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const appt = await Appointment.findOne({ _id: id, starId: req.user._id });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appt.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending can be rejected' });
    
    // Stars cannot reject appointments where payment is not complete
    if (appt.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Cannot reject - payment not complete' });
    }
    appt.status = 'rejected';
    
    // Refund escrow if payment was pending (before we set it to refunded)
    if (appt.paymentStatus === 'pending') {
      try {
        await refundEscrow(appt.starId, appt._id, null);
      } catch (escrowError) {
        console.error('Failed to refund escrow for rejected appointment:', escrowError);
      }
    }
    
    appt.paymentStatus = 'refunded';
    
    // Cancel or refund the transaction, if any - check status first
    if (appt.transactionId) {
      try {
        const transaction = await Transaction.findById(appt.transactionId);
        if (transaction) {
          if (transaction.status === 'pending') {
            // Cancel pending transaction
            await cancelTransaction(appt.transactionId);
            console.log(`[RejectAppointment] Successfully cancelled pending transaction ${appt.transactionId}`);
          } else if (transaction.status === 'completed') {
            // Refund completed transaction
            const { refundTransaction } = await import('../services/transactionService.js');
            await refundTransaction(appt.transactionId);
            console.log(`[RejectAppointment] Successfully refunded completed transaction ${appt.transactionId}`);
          } else if (transaction.status === 'cancelled' || transaction.status === 'refunded') {
            // Already cancelled/refunded, nothing to do
            console.log(`[RejectAppointment] Transaction ${appt.transactionId} is already ${transaction.status}, skipping`);
          } else {
            console.log(`[RejectAppointment] Transaction ${appt.transactionId} has status ${transaction.status}, cannot cancel/refund`);
          }
        }
      } catch (transactionError) {
        console.error('Failed to cancel/refund transaction for rejected appointment:', transactionError);
        // Proceed with rejection even if refund fails
      }
    }
    const updated = await appt.save();

    // Free the reserved slot when appointment is rejected
    // This makes the slot available again for other fans to book
    try {
      const updateResult = await Availability.updateOne(
        { 
          _id: appt.availabilityId, 
          userId: appt.starId, 
          'timeSlots._id': appt.timeSlotId 
        },
        { 
          $set: { 
            'timeSlots.$.status': 'available',
            'timeSlots.$.paymentReferenceId': null,
            'timeSlots.$.lockedAt': null
          } 
        }
      );
      console.log(`[RejectAppointment] Slot freed for appointment ${appt._id}, updateResult:`, updateResult);
    } catch (slotError) {
      console.error(`[RejectAppointment] Error freeing slot for appointment ${appt._id}:`, slotError);
      // Continue even if slot update fails - appointment is already rejected
    }

    // Populate appointment before sending notification to ensure fanId and starId are available
    const appointmentForNotification = await Appointment.findById(updated._id)
      .populate('starId', 'name pseudo')
      .populate('fanId', 'name pseudo');

    // Send notification to fan about appointment rejection
    try {
      await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REJECTED', appointmentForNotification, { currentUserId: req.user._id });
      console.log(`[RejectAppointment] Notification sent to fan ${appointmentForNotification.fanId?._id || appointmentForNotification.fanId} for rejected appointment ${updated._id}`);
    } catch (notificationError) {
      console.error('Error sending appointment rejection notification:', notificationError);
    }

    // Populate the appointment with related data before returning
    const populatedAppointment = await Appointment.findById(updated._id)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId', 'date timeSlots');

    return res.json({ 
      success: true, 
      message: 'Appointment rejected successfully',
      data: {
        appointment: sanitize(populatedAppointment)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const filter = { _id: id };
    if (req.user.role !== 'admin') filter.fanId = req.user._id;
    const appt = await Appointment.findOne(filter);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appt.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled' });

    // Refund escrow if payment was pending or completed
    if (appt.paymentStatus === 'pending' || appt.paymentStatus === 'completed') {
      try {
        await refundEscrow(appt.starId, appt._id, null);
      } catch (escrowError) {
        console.error('Failed to refund escrow for cancelled appointment:', escrowError);
      }
    }
    
    // Cancel or refund the transaction, if any - check status first
    if (appt.transactionId) {
      try {
        const transaction = await Transaction.findById(appt.transactionId);
        if (transaction) {
          if (transaction.status === 'pending') {
            // Cancel pending transaction
            await cancelTransaction(appt.transactionId);
            console.log(`[CancelAppointment] Successfully cancelled pending transaction ${appt.transactionId}`);
          } else if (transaction.status === 'completed') {
            // Refund completed transaction
            const { refundTransaction } = await import('../services/transactionService.js');
            await refundTransaction(appt.transactionId);
            console.log(`[CancelAppointment] Successfully refunded completed transaction ${appt.transactionId}`);
          } else if (transaction.status === 'cancelled' || transaction.status === 'refunded') {
            // Already cancelled/refunded, nothing to do
            console.log(`[CancelAppointment] Transaction ${appt.transactionId} is already ${transaction.status}, skipping`);
          } else {
            console.log(`[CancelAppointment] Transaction ${appt.transactionId} has status ${transaction.status}, cannot cancel/refund`);
          }
        }
      } catch (transactionError) {
        console.error('Failed to cancel/refund transaction for cancelled appointment:', transactionError);
        // Continue with appointment cancellation even if transaction cancellation/refund fails
      }
    }

    // Stop Agora cloud recording if it was started
    // IMPORTANT: Use the exact channel name and IDs that were saved when recording started
    if (appt.recordingResourceId && appt.recordingSid && (appt.recordingStatus === 'recording' || appt.recordingStatus === 'acquired')) {
      try {
        // CRITICAL: Use the EXACT channel name that was used when starting (may be raw ID or appointment_ prefix)
        const channelName = appt.recordingChannelName || `appointment_${appt._id}`;
        recordingLog(RecordingSteps.RECORDING_STOP_ON_CANCEL, { appointmentId: String(appt._id), channel: channelName, resourceId: appt.recordingResourceId, sid: appt.recordingSid }, 'stopping recording on appointment cancel');
        console.log(`[CancelAppointment] ===== STOPPING AGORA RECORDING =====`);
        console.log(`[CancelAppointment] Appointment ID: ${appt._id}`);
        console.log(`[CancelAppointment] Channel Name: ${channelName}`);
        console.log(`[CancelAppointment] Resource ID: ${appt.recordingResourceId}`);
        console.log(`[CancelAppointment] SID: ${appt.recordingSid}`);
        console.log(`[CancelAppointment] Current Status: ${appt.recordingStatus}`);
        
        const stopResult = await stopRecording(
          appt.recordingResourceId,
          appt.recordingSid,
          channelName,
          'mix'
        );
        
        console.log(`[CancelAppointment] Stop Result:`, JSON.stringify({
          success: stopResult.success,
          alreadyStopped: stopResult.alreadyStopped,
          filesCount: stopResult.files?.length || 0,
          error: stopResult.error || null
        }, null, 2));
        
        if (stopResult.success) {
          appt.recordingStatus = 'stopped';
          appt.recordingStoppedAt = new Date();
          if (stopResult.files && Array.isArray(stopResult.files) && stopResult.files.length > 0) {
            appt.recordingFiles = stopResult.files.map(file => ({
              fileName: file.fileName || file.filename || '',
              trackType: file.trackType || 'audio_and_video',
              uid: file.uid || '',
              mixedAllUser: file.mixedAllUser || false,
              isPlayable: file.isPlayable !== undefined ? file.isPlayable : true,
              sliceStartTime: file.sliceStartTime || 0
            }));
          }
          const message = stopResult.alreadyStopped 
            ? `✅ Recording already stopped (session expired or auto-stopped) for appointment ${appt._id}`
            : `✅ Recording stopped successfully for appointment ${appt._id}`;
          console.log(`[CancelAppointment] ${message}`);
          console.log(`[CancelAppointment] ==========================================`);
        } else {
          console.error(`[CancelAppointment] ❌ FAILED TO STOP RECORDING`);
          console.error(`[CancelAppointment] Error:`, stopResult.error);
          console.error(`[CancelAppointment] Error Code:`, stopResult.errorCode);
          appt.recordingStatus = 'failed';
        }
      } catch (recordingError) {
        console.error(`[CancelAppointment] ❌ EXCEPTION WHILE STOPPING RECORDING`);
        console.error(`[CancelAppointment] Error:`, recordingError);
        console.error(`[CancelAppointment] Stack:`, recordingError.stack);
        appt.recordingStatus = 'failed';
      }
    } else {
      console.log(`[CancelAppointment] ⏭️  Skipping recording stop - no active recording found`);
      console.log(`[CancelAppointment] Resource ID: ${appt.recordingResourceId || 'none'}`);
      console.log(`[CancelAppointment] SID: ${appt.recordingSid || 'none'}`);
      console.log(`[CancelAppointment] Status: ${appt.recordingStatus || 'none'}`);
    }

    // Free the reserved slot (for approved or pending hybrid-reserved)
    try {
      await Availability.updateOne(
        { _id: appt.availabilityId, userId: appt.starId, 'timeSlots._id': appt.timeSlotId },
        { $set: { 'timeSlots.$.status': 'available' } }
      );
    } catch (_e) {}

    appt.status = 'cancelled';
    appt.paymentStatus = 'refunded';
    const updated = await appt.save();

    // Notify counterpart only if payment was complete
    // If paymentStatus is 'initiated', star never saw the appointment, so don't notify them
    try {
      if (updated.paymentStatus !== 'initiated') {
        await NotificationHelper.sendAppointmentNotification('APPOINTMENT_CANCELLED', updated, { currentUserId: req.user._id });
      } else {
        console.log(`[CancelAppointment] Skipping notification - payment not complete (paymentStatus: ${updated.paymentStatus})`);
      }
    } catch (notificationError) {
      console.error('Error sending appointment cancellation notification:', notificationError);
    }
    return res.json({ 
      success: true, 
      message: 'Appointment cancelled successfully',
      data: {
        appointment: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const rescheduleAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const { availabilityId, timeSlotId } = req.body;

    const filter = { _id: id };
    if (req.user.role !== 'admin') filter.fanId = req.user._id;
    const existingAppointment = await Appointment.findOne(filter)
      .populate('starId', 'name pseudo baroniId')
      .populate('fanId', 'name pseudo baroniId');
    
    if (!existingAppointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    
    console.log(`[RescheduleAppointment] Found appointment ${id} with status: ${existingAppointment.status}`);
    
    // Allow rescheduling regardless of current status - no conditions checked

    // Verify new availability belongs to the same star and slot is available
    const newAvailability = await Availability.findOne({ _id: availabilityId, userId: existingAppointment.starId._id });
    if (!newAvailability) return res.status(404).json({ success: false, message: 'Availability not found for this star' });

    // Find the specific time slot
    const newTimeSlot = newAvailability.timeSlots.find(slot => slot._id.toString() === timeSlotId.toString());
    if (!newTimeSlot) return res.status(404).json({ success: false, message: 'Time slot not found' });
    if (newTimeSlot.status !== 'available') return res.status(409).json({ success: false, message: 'Time slot unavailable' });

    // All appointments can be rescheduled - no date/time validation

    // Get fan's country for timezone conversion
    const fan = await (await import('../models/User.js')).default.findById(existingAppointment.fanId._id).select('country');
    const fanCountry = fan?.country || null;

    // Convert local time to UTC based on fan's country
    const utcStartTime = convertLocalToUTC(newAvailability.date, newTimeSlot.slot, fanCountry);

    // Start transaction to ensure data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update the old appointment status to 'rescheduled'
      // If it was 'missed', it becomes 'rescheduled'. If it was other status, it also becomes 'rescheduled'
      const oldStatus = existingAppointment.status;
      await Appointment.findByIdAndUpdate(
        id,
        { status: 'rescheduled' },
        { session }
      );
      console.log(`[RescheduleAppointment] Updated old appointment ${id} status from '${oldStatus}' to 'rescheduled'`);

      // Create new appointment with reschedule flags
      const newAppointment = await Appointment.create([{
        starId: existingAppointment.starId._id,
        fanId: existingAppointment.fanId._id,
        availabilityId: newAvailability._id,
        timeSlotId: timeSlotId,
        date: newAvailability.date,
        time: newTimeSlot.slot,
        utcStartTime,
        price: existingAppointment.price, // Use same price as original
        status: 'pending', // New appointment starts as 'pending' (not 'rescheduled')
        paymentStatus: 'completed', // No payment needed for reschedule
        transactionId: existingAppointment.transactionId, // Use same transaction
        isRescheduled: true,
        parentAppointment: id,
        referenceAppointment: id // Reference to the appointment that was rescheduled
      }], { session });
      console.log(`[RescheduleAppointment] Created new appointment ${newAppointment[0]._id} with status 'pending' and referenceAppointment ${id}`);

      // Reserve the new slot
      await Availability.updateOne(
        { _id: availabilityId, userId: existingAppointment.starId._id, 'timeSlots._id': timeSlotId },
        { $set: { 'timeSlots.$.status': 'unavailable' } },
        { session }
      );

      // Release the old slot
      await Availability.updateOne(
        { _id: existingAppointment.availabilityId, userId: existingAppointment.starId._id, 'timeSlots._id': existingAppointment.timeSlotId },
        { $set: { 'timeSlots.$.status': 'available' } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Populate the new appointment with related data (after transaction is committed)
      const populatedNewAppointment = await Appointment.findById(newAppointment[0]._id)
        .populate('starId', 'name pseudo baroniId profilePic')
        .populate('fanId', 'name pseudo baroniId profilePic')
        .populate('availabilityId');

      // Send notification to star about reschedule (after transaction is committed)
      try {
        await NotificationHelper.sendAppointmentNotification('APPOINTMENT_RESCHEDULED', populatedNewAppointment, { 
          currentUserId: req.user._id,
          originalAppointmentId: id
        });
      } catch (notificationError) {
        console.error('Error sending reschedule notification:', notificationError);
        // Don't fail the request if notification fails
      }

      return res.status(201).json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: {
          newAppointment: sanitize(populatedNewAppointment),
          originalAppointmentId: id
        }
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (err) {
    console.error('Reschedule appointment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const completeAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const { callDuration, endCall = false } = req.body;
    
    const appt = await Appointment.findById(id);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    if (appt.status !== 'approved' && appt.status !== 'in_progress' && appt.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only approved, in-progress, or completed appointments can have duration added' });
    }

    // Validate callDuration is a valid number
    if (typeof callDuration !== 'number' || isNaN(callDuration) || callDuration < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'callDuration must be a valid number (in seconds) and cannot be negative' 
      });
    }
    
    // callDuration is already in seconds, round it to ensure it's an integer
    const durationInSeconds = Math.round(callDuration);
    
    // Get current duration (ensure it's a number, default to 0 if not set)
    const currentDuration = typeof appt.callDuration === 'number' ? appt.callDuration : 0;
    
    const callEndedByDuration = durationInSeconds === 0 && currentDuration > 0;
    const shouldEndCall = endCall || callEndedByDuration;
    const newTotalDuration = currentDuration + durationInSeconds;
    
    // Complete transaction if pending
    if (appt.transactionId && appt.paymentStatus !== 'completed') {
      try {
        const transaction = await Transaction.findById(appt.transactionId);
        if (transaction && transaction.status === TRANSACTION_STATUSES.PENDING) {
          await completeTransaction(appt.transactionId);
        }
      } catch (transactionError) {
        // Continue even if transaction completion fails
      }
    }
    
    // Use MongoDB's atomic $inc operator to increment duration atomically
    // This prevents race conditions when multiple requests come in simultaneously
    // MongoDB's $inc treats null/undefined as 0, so it's safe to always use $inc
    const updateQuery = {
      $inc: { callDuration: durationInSeconds }
    };
    
    // SIMPLE RECORDING LOGIC:
    // 1. Video call START = Recording START (when currentDuration = 0 and durationInSeconds > 0 AND endCall = false)
    // 2. Video call END = Recording END (when endCall = true)
    // CRITICAL: If endCall = true, DO NOT start recording, only stop if active
    
    recordingLog(shouldEndCall ? RecordingSteps.RECORDING_LOGIC_CALL_END : RecordingSteps.RECORDING_LOGIC_CALL_START, { appointmentId: String(id), durationInSeconds, endCall, shouldEndCall, currentDuration }, shouldEndCall ? 'call end path' : 'call in progress');
    console.log(`[RECORDING] ===== RECORDING LOGIC CHECK =====`);
    console.log(`[RECORDING] Appointment ID: ${id}`);
    console.log(`[RECORDING] Current Duration: ${currentDuration}`);
    console.log(`[RECORDING] Duration In Seconds: ${durationInSeconds}`);
    console.log(`[RECORDING] End Call: ${endCall}`);
    console.log(`[RECORDING] Call Ended By Duration: ${callEndedByDuration}`);
    console.log(`[RECORDING] Should End Call: ${shouldEndCall}`);
    console.log(`[RECORDING] Appointment Status: ${appt.status}`);
    console.log(`[RECORDING] Existing Recording Resource ID: ${appt.recordingResourceId || 'none'}`);
    console.log(`[RECORDING] Existing Recording SID: ${appt.recordingSid || 'none'}`);
    console.log(`[RECORDING] Existing Recording Status: ${appt.recordingStatus || 'none'}`);
    
    // CRITICAL: If endCall is true, skip recording start completely
    if (endCall || shouldEndCall) {
      console.log(`[RECORDING] ⏭️  SKIPPING RECORDING START - Call is ending (endCall=${endCall}, shouldEndCall=${shouldEndCall})`);
      console.log(`[RECORDING] Recording start logic will be skipped, only stop logic will run if needed`);
    } else {
      // Check if call is starting (currentDuration = 0 and new duration > 0)
      const isCallStarting = currentDuration === 0 && durationInSeconds > 0;
      console.log(`[RECORDING] Is Call Starting: ${isCallStarting} (currentDuration=${currentDuration} === 0 && durationInSeconds=${durationInSeconds} > 0)`);
      
      // Check if recording already exists
      const hasExistingRecording = !!(appt.recordingResourceId && appt.recordingSid);
      const isRecordingActive = appt.recordingStatus === 'recording' || appt.recordingStatus === 'acquired';
      console.log(`[RECORDING] Has Existing Recording: ${hasExistingRecording}`);
      console.log(`[RECORDING] Is Recording Active: ${isRecordingActive} (status: ${appt.recordingStatus})`);
      
      // Update status if call is starting
      if (appt.status === 'approved' && isCallStarting) {
        if (!updateQuery.$set) updateQuery.$set = {};
        updateQuery.$set.status = 'in_progress';
        console.log(`[RECORDING] ✅ Status updated: approved -> in_progress`);
      }
      
      // START RECORDING: When call is starting AND not already recording
      // Note: endCall check already done above, so we don't need to check again
      const condition1 = isCallStarting;
      const condition2 = !hasExistingRecording || !isRecordingActive;
      
      console.log(`[RECORDING] Condition 1 (isCallStarting): ${condition1}`);
      console.log(`[RECORDING] Condition 2 (!hasExistingRecording || !isRecordingActive): ${condition2} (hasExistingRecording=${hasExistingRecording}, isRecordingActive=${isRecordingActive})`);
      
      const shouldStartRecording = condition1 && condition2;
      console.log(`[RECORDING] Should Start Recording: ${shouldStartRecording} (all conditions: ${condition1} && ${condition2})`);
      
      if (shouldStartRecording) {
        try {
          // Use raw appointment id as channel so it matches client join (client typically uses appointment id as channel name)
          const channelName = String(id);
          recordingLog(RecordingSteps.RECORDING_START_VIA_DURATION, { appointmentId: String(id), channel: channelName }, 'starting recording via reportCallDuration');
          console.log(`[RECORDING] 🎬 STARTING - Appointment: ${id}, Channel: ${channelName}`);
          console.log(`[RECORDING] All conditions passed, starting recording...`);
          
          const recordingResult = await startRecordingForChannel(channelName, 'mix');
          
          if (recordingResult.success && recordingResult.resourceId && recordingResult.sid) {
            if (!updateQuery.$set) updateQuery.$set = {};
            updateQuery.$set.recordingResourceId = recordingResult.resourceId;
            updateQuery.$set.recordingSid = recordingResult.sid;
            updateQuery.$set.recordingChannelName = channelName;
            updateQuery.$set.recordingStatus = 'recording';
            updateQuery.$set.recordingStartedAt = new Date();
            console.log(`[RECORDING] ✅ STARTED - ResourceID: ${recordingResult.resourceId}, SID: ${recordingResult.sid}`);
          } else {
            if (!updateQuery.$set) updateQuery.$set = {};
            updateQuery.$set.recordingStatus = 'failed';
            console.error(`[RECORDING] ❌ FAILED - Error:`, recordingResult.error);
            console.error(`[RECORDING] ❌ Recording start failed - success: ${recordingResult.success}, resourceId: ${recordingResult.resourceId || 'none'}, sid: ${recordingResult.sid || 'none'}`);
          }
        } catch (recordingError) {
          if (!updateQuery.$set) updateQuery.$set = {};
          updateQuery.$set.recordingStatus = 'failed';
          console.error(`[RECORDING] ❌ EXCEPTION -`, recordingError.message);
          console.error(`[RECORDING] ❌ Exception stack:`, recordingError.stack);
        }
      } else {
        console.log(`[RECORDING] ⏭️  SKIPPING START - Conditions not met (isCallStarting: ${condition1}, hasExistingRecording: ${hasExistingRecording}, isRecordingActive: ${isRecordingActive})`);
      }
    }
    
    console.log(`[RECORDING] ===== RECORDING START CHECK COMPLETE =====`);
    
    // Perform atomic update and return the updated document
    const updated = await Appointment.findByIdAndUpdate(
      id,
      updateQuery,
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    // Get final duration after update
    const finalDurationSeconds = typeof updated.callDuration === 'number' ? updated.callDuration : 0;
    
    // STOP RECORDING: Only when endCall = true (video call ended)
    // No duration checks, no other conditions
    let finalAppointment = updated;
    if (shouldEndCall) {
      console.log(`[RECORDING] 🛑 STOP CHECK - Appointment: ${id}, endCall: ${endCall}, callEndedByDuration: ${callEndedByDuration}, shouldEndCall: ${shouldEndCall}`);
      const latestAppt = await Appointment.findById(id).lean();
      console.log(`[RECORDING] 🛑 STOP CHECK - Recording exists: ${!!latestAppt?.recordingResourceId}, Status: ${latestAppt?.recordingStatus}`);
      
      if (latestAppt?.recordingResourceId && latestAppt?.recordingSid && 
          (latestAppt.recordingStatus === 'recording' || latestAppt.recordingStatus === 'acquired')) {
        try {
          const channelName = latestAppt.recordingChannelName || `appointment_${id}`;
          recordingLog(RecordingSteps.RECORDING_STOP_VIA_END_CALL, { appointmentId: String(id), channel: channelName, resourceId: latestAppt.recordingResourceId, sid: latestAppt.recordingSid }, 'stopping recording - call ended');
          console.log(`[RECORDING] 🛑 STOPPING - Appointment: ${id}, Channel: ${channelName}, Reason: call ended`);
          
          const stopResult = await stopRecording(
            latestAppt.recordingResourceId,
            latestAppt.recordingSid,
            channelName,
            'mix'
          );
          
          const filesToStore = stopResult.files && Array.isArray(stopResult.files) && stopResult.files.length > 0
            ? stopResult.files.map((file) => ({
                fileName: file.fileName || file.filename || '',
                trackType: file.trackType || 'audio_and_video',
                uid: String(file.uid ?? ''),
                mixedAllUser: file.mixedAllUser || false,
                isPlayable: file.isPlayable !== undefined ? file.isPlayable : true,
                sliceStartTime: typeof file.sliceStartTime === 'number' ? file.sliceStartTime : 0
              }))
            : [];
          
          if (stopResult.success) {
            recordingLog(RecordingSteps.STOP_SUCCESS, { appointmentId: String(id), channel: channelName, resourceId: latestAppt.recordingResourceId, sid: latestAppt.recordingSid, filesCount: filesToStore.length }, 'recording stopped via end call');
            await Appointment.findByIdAndUpdate(id, {
              $set: {
                recordingStatus: 'stopped',
                recordingStoppedAt: new Date(),
                recordingFiles: filesToStore
              }
            });
            console.log(`[RECORDING] ✅ STOPPED - Files stored: ${filesToStore.length} (raw from Agora: ${stopResult.files?.length || 0})${stopResult.alreadyStopped ? ' (session already stopped by Agora)' : ''}`);
          } else {
            recordingLog(RecordingSteps.STOP_FAIL, { appointmentId: String(id), channel: channelName, resourceId: latestAppt.recordingResourceId, sid: latestAppt.recordingSid }, stopResult.error ? JSON.stringify(stopResult.error) : 'stop failed');
            await Appointment.findByIdAndUpdate(id, { $set: { recordingStatus: 'failed' } });
            console.error(`[RECORDING] ❌ STOP FAILED -`, stopResult.error);
          }
          // Re-fetch so response includes latest recording data
          finalAppointment = await Appointment.findById(id)
            .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
            .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
            .populate('availabilityId', 'date timeSlots')
            .lean();
        } catch (recordingError) {
          recordingLog(RecordingSteps.STOP_FAIL, { appointmentId: String(id) }, recordingError.message);
          await Appointment.findByIdAndUpdate(id, { $set: { recordingStatus: 'failed' } });
          console.error(`[RECORDING] ❌ STOP EXCEPTION -`, recordingError.message);
          finalAppointment = await Appointment.findById(id)
            .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
            .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
            .populate('availabilityId', 'date timeSlots')
            .lean();
        }
      } else {
        console.log(`[RECORDING] ⏭️  SKIPPING STOP - No active recording found (ResourceID: ${latestAppt?.recordingResourceId || 'none'}, Status: ${latestAppt?.recordingStatus || 'none'})`);
      }
    } else {
      console.log(`[RECORDING] ℹ️  NO STOP - Call not ending (endCall: ${endCall}, shouldEndCall: ${shouldEndCall})`);
    }
    
    // Check if review exists for this appointment (by fan)
    let hasReview = false;
    try {
      const existingReview = await Review.findOne({
        appointmentId: updated._id,
        reviewerId: updated.fanId
      });
      hasReview = !!existingReview;
    } catch (reviewError) {
      console.error(`[CompleteAppointment] Error checking review for appointment ${updated._id}:`, reviewError);
      // Continue even if review check fails
    }
    
    return res.json({ 
      success: true, 
      message: 'Call duration added successfully',
      data: {
        appointment: sanitize(finalAppointment),
        totalDurationSeconds: finalDurationSeconds,
        callDuration: finalDurationSeconds,
        duration: finalDurationSeconds,
        isFullyCompleted: finalDurationSeconds >= 300,
        hasReview: hasReview
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};