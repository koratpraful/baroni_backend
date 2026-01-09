import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import Config from '../models/Config.js';
import { refundTransaction } from '../services/transactionService.js';
import { getEffectiveCommission, applyCommission } from '../utils/commissionHelper.js';
import mongoose from 'mongoose';

const parseRange = (from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
};

export const getRefundMetrics = async (req, res) => {
  try {
    const { from, to, service } = req.query;
    const match = {};
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;
    if (service) match.type = service;

    // Define refundable transaction types (service payments that can be refunded)
    const refundableTypes = [
      'appointment_payment',
      'dedication_request_payment',
      'live_show_attendance_payment',
      'live_show_hosting_payment'
    ];

    // Build match conditions for refundable transactions only
    const refundableMatch = {
      ...match,
      type: { $in: refundableTypes }
    };

    // Total Refunded: Only count refunded service transactions
    const totalRefundedAgg = await Transaction.aggregate([
      { $match: { ...refundableMatch, status: 'refunded' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Failed Refunds: Only count failed service transactions (refundable ones)
    const failedAgg = await Transaction.aggregate([
      { $match: { ...refundableMatch, status: 'failed' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Pending Refunds: Count pending/initiated service transactions (these are pending payments that may need refunds)
    const pendingAgg = await Transaction.aggregate([
      { $match: { ...refundableMatch, status: { $in: ['pending', 'initiated'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalRefunded: { count: totalRefundedAgg[0]?.count || 0, amount: totalRefundedAgg[0]?.amount || 0 },
        pendingRefunds: { count: pendingAgg[0]?.count || 0, amount: pendingAgg[0]?.amount || 0 },
        failedRefunds: { count: failedAgg[0]?.count || 0, amount: failedAgg[0]?.amount || 0 },
        avgCommissionTimeSec: 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
};

// Helper function to get service duration from time range
const getDurationFromTimeRange = (timeRange) => {
  if (!timeRange || typeof timeRange !== 'string') return null;
  const match = timeRange.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  if (!match) return null;
  const startHour = parseInt(match[1], 10);
  const startMin = parseInt(match[2], 10);
  const endHour = parseInt(match[3], 10);
  const endMin = parseInt(match[4], 10);
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  const duration = endTotal - startTotal;
  return duration > 0 ? `${duration} min` : null;
};

// Helper function to map transaction status to refund status
// IMPORTANT: If transaction is completed but service is cancelled, it needs refund
const getRefundStatus = (transaction, serviceDetails = null) => {
  if (transaction.status === 'refunded') return 'refunded';
  if (transaction.status === 'failed') return 'failed';
  if (transaction.status === 'pending' || transaction.status === 'initiated') return 'pending';
  // For completed transactions, check if service is cancelled
  if (transaction.status === 'completed' && serviceDetails) {
    // Check service status
    const serviceStatus = serviceDetails.status;
    if (serviceStatus === 'cancelled' || serviceStatus === 'rejected') {
      return 'pending'; // Payment completed but service cancelled - needs refund
    }
  }
  // For completed transactions without cancelled service, they are not refundable
  return null; // Not refundable
};

export const listRefundables = async (req, res) => {
  try {
    const { q, status, service, from, to, type } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    // Define refundable transaction types (service payments that can be refunded)
    // IMPORTANT: Only show refundable transactions (appointments, dedications, live shows)
    // Exclude become_star_payment and other non-refundable types
    const refundableTypes = [
      'appointment_payment',
      'dedication_request_payment',
      'live_show_attendance_payment',
      'live_show_hosting_payment'
    ];

    const match = {
      type: { $in: refundableTypes } // Only show refundable transaction types
    };
    
    // Map UI status to transaction status
    // IMPORTANT: If no status filter, show all refundable transactions including:
    // - refunded, failed, pending, initiated, AND completed (if service is cancelled)
    if (status) {
      if (status === 'refunded') {
        match.status = 'refunded';
      } else if (status === 'failed') {
        match.status = 'failed';
      } else if (status === 'pending') {
        match.status = { $in: ['pending', 'initiated'] };
      } else if (status === 'completed') {
        // Show completed transactions (will filter by service status later)
        match.status = 'completed';
      }
      // If status is not specified, show all refundable transactions
    }
    
    // Map service type filter
    if (service) {
      if (service === 'video_call' || service === 'appointment') {
        match.type = 'appointment_payment';
      } else if (service === 'dedication') {
        match.type = 'dedication_request_payment';
      } else if (service === 'live_show') {
        match.type = { $in: ['live_show_attendance_payment', 'live_show_hosting_payment'] };
      } else {
        // Only allow if it's a refundable type
        if (refundableTypes.includes(service)) {
          match.type = service;
        } else {
          // Invalid service type, return empty results
          match.type = { $in: [] };
        }
      }
    }
    
    // Filter by type (manual/auto) - this would need a field in Transaction model
    // For now, we'll skip this filter as it's not in the model
    
    // Date filtering: Use service date (appointment date) instead of transaction createdAt
    // This ensures cancelled appointments show based on their scheduled date, not cancellation date
    const dateRange = parseRange(from, to);

    // Search by payer/receiver name or pseudo or baroniId
    let userIds = [];
    if (q) {
      const regex = new RegExp(q, 'i');
      const users = await User.find({ $or: [{ name: regex }, { pseudo: regex }, { baroniId: regex }] }, { _id: 1 });
      userIds = users.map((u) => u._id);
      match.$or = [{ payerId: { $in: userIds } }, { receiverId: { $in: userIds } }];
    }

    // Use aggregation to filter by service date (appointment date) instead of transaction createdAt
    const aggregationPipeline = [
      { $match: match },
      // Lookup appointments for appointment_payment transactions
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'appointment'
        }
      },
      // Lookup dedication requests
      {
        $lookup: {
          from: 'dedicationrequests',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'dedication'
        }
      },
      // Lookup live shows
      {
        $lookup: {
          from: 'liveshows',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'liveshow'
        }
      },
      // Add service date field based on transaction type
      {
        $addFields: {
          serviceDate: {
            $cond: {
              if: { $eq: ['$type', 'appointment_payment'] },
              then: { $arrayElemAt: ['$appointment.date', 0] },
              else: {
                $cond: {
                  if: { $eq: ['$type', 'dedication_request_payment'] },
                  then: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: { $arrayElemAt: ['$dedication.eventDate', 0] }
                    }
                  },
                  else: {
                    $cond: {
                      if: { $in: ['$type', ['live_show_attendance_payment', 'live_show_hosting_payment']] },
                      then: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: { $arrayElemAt: ['$liveshow.date', 0] }
                        }
                      },
                      else: {
                        // Fallback to transaction createdAt date if no service date
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ];

    // Apply date filter on service date if date range is provided
    // IMPORTANT: Filter by service date (appointment date) not transaction createdAt
    // This ensures cancelled appointments show based on scheduled date, not cancellation date
    if (dateRange || from || to) {
      // Convert date range to YYYY-MM-DD format for string comparison (appointment.date is string)
      const fromDateStr = from ? new Date(from).toISOString().split('T')[0] : null;
      const toDateStr = to ? new Date(to).toISOString().split('T')[0] : null;
      
      const dateFilter = {};
      if (fromDateStr && toDateStr && fromDateStr === toDateStr) {
        // Single date filter - exact match
        dateFilter.$eq = fromDateStr;
      } else {
        // Date range filter
        if (fromDateStr) {
          dateFilter.$gte = fromDateStr;
        }
        if (toDateStr) {
          dateFilter.$lte = toDateStr;
        }
      }
      
      if (Object.keys(dateFilter).length > 0) {
        aggregationPipeline.push({
          $match: {
            serviceDate: dateFilter
          }
        });
      }
    }

    // IMPORTANT: Filter by service status BEFORE pagination
    // Show completed transactions ONLY if service is cancelled
    // This ensures we show payments that need refunds (payment completed but service cancelled)
    aggregationPipeline.push({
      $addFields: {
        serviceStatus: {
          $cond: {
            if: { $eq: ['$type', 'appointment_payment'] },
            then: { $arrayElemAt: ['$appointment.status', 0] },
            else: {
              $cond: {
                if: { $eq: ['$type', 'dedication_request_payment'] },
                then: { $arrayElemAt: ['$dedication.status', 0] },
                else: {
                  $cond: {
                    if: { $in: ['$type', ['live_show_attendance_payment', 'live_show_hosting_payment']] },
                    then: { $arrayElemAt: ['$liveshow.status', 0] },
                    else: null
                  }
                }
              }
            }
          }
        }
      }
    });

    // Filter: Show transactions if:
    // 1. Status is refunded, failed, pending, initiated (always show)
    // 2. Status is completed AND service status is cancelled (payment done but service cancelled)
    aggregationPipeline.push({
      $match: {
        $or: [
          { status: { $in: ['refunded', 'failed', 'pending', 'initiated'] } },
          { 
            $and: [
              { status: 'completed' },
              { serviceStatus: 'cancelled' }
            ]
          }
        ]
      }
    });

    // Add sorting, pagination, and population
    aggregationPipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      // Lookup payer
      {
        $lookup: {
          from: 'users',
          localField: 'payerId',
          foreignField: '_id',
          as: 'payerId'
        }
      },
      { $unwind: { path: '$payerId', preserveNullAndEmptyArrays: true } },
      // Lookup receiver
      {
        $lookup: {
          from: 'users',
          localField: 'receiverId',
          foreignField: '_id',
          as: 'receiverId'
        }
      },
      { $unwind: { path: '$receiverId', preserveNullAndEmptyArrays: true } }
    );

    // Get total count with date filter
    const countPipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'appointment'
        }
      },
      {
        $lookup: {
          from: 'dedicationrequests',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'dedication'
        }
      },
      {
        $lookup: {
          from: 'liveshows',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'liveshow'
        }
      },
      {
        $addFields: {
          serviceDate: {
            $cond: {
              if: { $eq: ['$type', 'appointment_payment'] },
              then: { $arrayElemAt: ['$appointment.date', 0] },
              else: {
                $cond: {
                  if: { $eq: ['$type', 'dedication_request_payment'] },
                  then: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: { $arrayElemAt: ['$dedication.eventDate', 0] }
                    }
                  },
                  else: {
                    $cond: {
                      if: { $in: ['$type', ['live_show_attendance_payment', 'live_show_hosting_payment']] },
                      then: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: { $arrayElemAt: ['$liveshow.date', 0] }
                        }
                      },
                      else: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                      }
                    }
                  }
                }
              }
            }
          },
          serviceStatus: {
            $cond: {
              if: { $eq: ['$type', 'appointment_payment'] },
              then: { $arrayElemAt: ['$appointment.status', 0] },
              else: {
                $cond: {
                  if: { $eq: ['$type', 'dedication_request_payment'] },
                  then: { $arrayElemAt: ['$dedication.status', 0] },
                  else: {
                    $cond: {
                      if: { $in: ['$type', ['live_show_attendance_payment', 'live_show_hosting_payment']] },
                      then: { $arrayElemAt: ['$liveshow.status', 0] },
                      else: null
                    }
                  }
                }
              }
            }
          }
        }
      }
    ];

    // Apply same date filter to count pipeline
    if (dateRange || from || to) {
      const fromDateStr = from ? new Date(from).toISOString().split('T')[0] : null;
      const toDateStr = to ? new Date(to).toISOString().split('T')[0] : null;
      
      const dateFilter = {};
      if (fromDateStr && toDateStr && fromDateStr === toDateStr) {
        // Single date filter - exact match
        dateFilter.$eq = fromDateStr;
      } else {
        // Date range filter
        if (fromDateStr) {
          dateFilter.$gte = fromDateStr;
        }
        if (toDateStr) {
          dateFilter.$lte = toDateStr;
        }
      }
      
      if (Object.keys(dateFilter).length > 0) {
        countPipeline.push({
          $match: {
            serviceDate: dateFilter
          }
        });
      }
    }

    // IMPORTANT: Apply same service status filter to count pipeline
    // Show transactions if:
    // 1. Status is refunded, failed, pending, initiated (always show)
    // 2. Status is completed AND service status is cancelled (payment done but service cancelled)
    countPipeline.push({
      $match: {
        $or: [
          { status: { $in: ['refunded', 'failed', 'pending', 'initiated'] } },
          { 
            $and: [
              { status: 'completed' },
              { serviceStatus: 'cancelled' }
            ]
          }
        ]
      }
    });

    countPipeline.push({ $count: 'total' });

    const [transactionsResult, totalResult] = await Promise.all([
      Transaction.aggregate(aggregationPipeline),
      Transaction.aggregate(countPipeline)
    ]);

    const transactions = transactionsResult;
    const total = totalResult[0]?.total || 0;

    // Get video call slot duration from config once (outside the loop for efficiency)
    const config = await Config.getSingleton();
    const defaultSlotDurationMinutes = config.serviceLimits?.slotDuration || 10;
    const defaultSlotDuration = `${defaultSlotDurationMinutes} min`;

    // Enrich transactions with service details, commission, and formatted data
    // Filter out null items (non-refundable completed transactions)
    const enrichedItems = (await Promise.all(transactions.map(async (txn) => {
      const payer = txn.payerId;
      const receiver = txn.receiverId;
      
      // Determine service type
      let serviceType = 'Unknown';
      let serviceDuration = null;
      let serviceId = null;
      let serviceDetails = null;
      
      if (txn.type === 'appointment_payment') {
        serviceType = 'Video Call';
        // Get appointment details - use from aggregation if available, otherwise query
        let appointment = null;
        if (txn.appointment && txn.appointment.length > 0) {
          appointment = txn.appointment[0];
          // Populate availabilityId if needed
          if (appointment.availabilityId && typeof appointment.availabilityId === 'object') {
            // Already populated
          } else if (appointment.availabilityId) {
            const Availability = (await import('../models/Availability.js')).default;
            appointment.availabilityId = await Availability.findById(appointment.availabilityId).lean();
          }
        } else {
          appointment = await Appointment.findOne({ transactionId: txn._id })
          .populate('availabilityId')
          .lean();
        }
        if (appointment) {
          serviceId = `SRV-${appointment._id.toString().slice(-8).toUpperCase()}`;
          serviceDetails = appointment;
          // Get duration from time range
          if (txn.metadata?.time) {
            serviceDuration = getDurationFromTimeRange(txn.metadata.time);
          } else if (appointment.availabilityId?.timeSlots) {
            const slot = appointment.availabilityId.timeSlots.find(s => String(s._id) === String(appointment.timeSlotId));
            if (slot?.slot) {
              serviceDuration = getDurationFromTimeRange(slot.slot);
            }
          }
          // Default to config slot duration if not found
          if (!serviceDuration) {
            serviceDuration = defaultSlotDuration;
          }
        }
      } else if (txn.type === 'dedication_request_payment') {
        serviceType = 'Dedication';
        // Use from aggregation if available
        let dedication = null;
        if (txn.dedication && txn.dedication.length > 0) {
          dedication = txn.dedication[0];
        } else {
          dedication = await DedicationRequest.findOne({ transactionId: txn._id }).lean();
        }
        if (dedication) {
          serviceId = `SRV-${dedication._id.toString().slice(-8).toUpperCase()}`;
          serviceDetails = dedication;
        }
      } else if (txn.type === 'live_show_attendance_payment' || txn.type === 'live_show_hosting_payment') {
        serviceType = 'Live Show';
        // Use from aggregation if available
        let liveShow = null;
        if (txn.liveshow && txn.liveshow.length > 0) {
          liveShow = txn.liveshow[0];
        } else {
          liveShow = await LiveShow.findOne({ transactionId: txn._id })
            .populate('starId', 'name pseudo baroniId profilePic role isVerified profession')
            .lean();
        }
        if (liveShow) {
          serviceId = `SRV-${liveShow._id.toString().slice(-8).toUpperCase()}`;
          serviceDetails = liveShow;
          // Ensure starId is populated for display logic
          if (liveShow.starId && typeof liveShow.starId === 'object') {
            serviceDetails.starId = liveShow.starId;
          }
        }
      }
      
      // Calculate commission and net amount based on admin commission configuration
      let commissionAmount = 0;
      let netAmount = txn.amount;
      
      if (txn.type === 'appointment_payment' || 
          txn.type === 'dedication_request_payment' || 
          txn.type === 'live_show_attendance_payment' || 
          txn.type === 'live_show_hosting_payment') {
        try {
          // Map transaction type to service type key for commission calculation
          let serviceTypeKey;
          if (txn.type === 'appointment_payment') {
            serviceTypeKey = 'videoCall';
          } else if (txn.type === 'dedication_request_payment') {
            serviceTypeKey = 'dedication';
          } else if (txn.type === 'live_show_attendance_payment' || txn.type === 'live_show_hosting_payment') {
            serviceTypeKey = 'liveShow';
          }
          
          // Get country code from receiver or payer
          const countryCode = receiver?.country || payer?.country;
          
          // Get effective commission rate from admin configuration
          const commissionRate = await getEffectiveCommission({ 
            serviceType: serviceTypeKey, 
            countryCode 
          });
          
          // Calculate commission and net amount based on percentage
          const { commission, netAmount: net } = applyCommission(txn.amount, commissionRate);
          commissionAmount = commission;
          netAmount = net;
        } catch (err) {
          console.error('Error calculating commission:', err);
          // If commission calculation fails, keep default values (0 commission, full amount as net)
        }
      }
      
      // Format payment ID
      const paymentId = txn.externalPaymentId ? `PAY-${txn.externalPaymentId}` : `PAY-${txn._id.toString().slice(-8).toUpperCase()}`;
      
      // Get refund status (pass serviceDetails to check if service is cancelled)
      const refundStatus = getRefundStatus(txn, serviceDetails);
      
      // Skip if refundStatus is null (not refundable - completed payment with non-cancelled service)
      if (refundStatus === null) {
        return null; // This will be filtered out later
      }
      
      // Format scheduled date & time from service details
      let scheduledDateTime = null;
      if (serviceDetails) {
        if (txn.type === 'appointment_payment' && serviceDetails.date && serviceDetails.time) {
          // Format appointment date/time: "25 July 2025 • 10:30 AM"
          const [year, month, day] = serviceDetails.date.split('-').map(v => parseInt(v, 10));
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const timeStr = serviceDetails.time || txn.metadata?.time || '';
          // Extract time from range like "10:30 - 10:50" or "10:30 AM"
          let timePart = timeStr.split(' - ')[0].trim();
          if (!timePart.includes('AM') && !timePart.includes('PM')) {
            // Convert 24h to 12h format if needed
            const [hours, minutes] = timePart.split(':').map(v => parseInt(v, 10));
            if (!isNaN(hours) && !isNaN(minutes)) {
              const ampm = hours >= 12 ? 'PM' : 'AM';
              const hours12 = hours % 12 || 12;
              timePart = `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
            }
          }
          scheduledDateTime = `${day} ${months[month - 1]} ${year} • ${timePart}`;
        } else if (txn.type === 'dedication_request_payment' && serviceDetails.eventDate) {
          // Format dedication event date
          scheduledDateTime = formatDate(serviceDetails.eventDate);
        } else if ((txn.type === 'live_show_attendance_payment' || txn.type === 'live_show_hosting_payment') && serviceDetails.date) {
          // Format live show date
          scheduledDateTime = formatDate(serviceDetails.date);
        }
      }
      
      // IMPORTANT: Determine who cancelled and adjust payer/receiver display accordingly
      // For refunds, we want to show the data of the person who cancelled
      let displayPayer = payer;
      let displayReceiver = receiver;
      let cancelledBy = null; // 'star' or 'fan'
      
      if (serviceDetails) {
        // Determine who cancelled based on service type and status
        if (txn.type === 'appointment_payment') {
          // For appointments:
          // - If status is 'rejected' → Star cancelled (rejectAppointment endpoint)
          // - If status is 'cancelled' → Fan cancelled (cancelAppointment endpoint, non-admin)
          if (serviceDetails.status === 'rejected') {
            cancelledBy = 'star';
            // Star cancelled: Show star (receiver) as payer, fan (payer) as receiver
            displayPayer = receiver; // Star who cancelled
            displayReceiver = payer;  // Fan who was cancelled
          } else if (serviceDetails.status === 'cancelled') {
            cancelledBy = 'fan';
            // Fan cancelled: Keep original (fan is payer, star is receiver)
            displayPayer = payer;  // Fan who cancelled
            displayReceiver = receiver; // Star who was cancelled
          }
        } else if (txn.type === 'dedication_request_payment') {
          // For dedications: Only fan can cancel (cancelDedicationRequest endpoint)
          if (serviceDetails.status === 'cancelled') {
            cancelledBy = 'fan';
            // Fan cancelled: Keep original (fan is payer, star is receiver)
            displayPayer = payer;  // Fan who cancelled
            displayReceiver = receiver; // Star who was cancelled
          }
        } else if (txn.type === 'live_show_attendance_payment' || txn.type === 'live_show_hosting_payment') {
          // For live shows: Star can cancel their own shows
          // IMPORTANT: For live_show_hosting_payment, receiver is admin, but we need to show original star
          // For live_show_attendance_payment, receiver is already star
          if (serviceDetails.status === 'cancelled' && serviceDetails.starId) {
            const starIdStr = serviceDetails.starId.toString ? serviceDetails.starId.toString() : String(serviceDetails.starId);
            
            // For hosting payment, receiver is admin, so we need to get the star from serviceDetails
            if (txn.type === 'live_show_hosting_payment') {
              // Hosting payment: payer is star, receiver is admin
              // When cancelled, show star (from serviceDetails) as receiver, admin (receiver) should not be shown
              // The star who created the show should be shown as receiver
              let starFromService = serviceDetails.starId;
              
              // If starId is already populated (object), use it directly
              if (starFromService && typeof starFromService === 'object' && starFromService._id) {
                cancelledBy = 'star';
                // Star cancelled: Show star (from serviceDetails) as receiver, payer (star) as payer
                displayPayer = payer; // Star who cancelled (payer is the star who created the show)
                displayReceiver = starFromService; // Star who was receiver (same as payer for hosting)
              } else if (starFromService) {
                // Get star user details if not populated
                const starUser = await User.findById(starFromService).lean();
                if (starUser) {
                  cancelledBy = 'star';
                  // Star cancelled: Show star (from serviceDetails) as receiver
                  displayPayer = payer; // Star who cancelled (payer is the star who created the show)
                  displayReceiver = starUser; // Star who was receiver
                }
              }
            } else {
              // Attendance payment: payer is fan, receiver is star
              const receiverIdStr = receiver?._id?.toString ? receiver._id.toString() : String(receiver?._id || '');
              if (starIdStr === receiverIdStr) {
                cancelledBy = 'star';
                // Star cancelled: Show star (receiver) as payer, fan (payer) as receiver
                displayPayer = receiver; // Star who cancelled
                displayReceiver = payer;  // Fan who was cancelled
              } else {
                cancelledBy = 'fan';
                // Fan cancelled: Keep original
                displayPayer = payer;  // Fan who cancelled
                displayReceiver = receiver; // Star who was cancelled
              }
            }
          }
        }
      }
      
      return {
        id: txn._id,
        transactionId: txn._id,
        type: txn.type,
        status: txn.status,
        refundStatus: refundStatus,
        amount: txn.amount,
        grossAmount: txn.amount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        paymentMode: txn.paymentMode,
        externalPaymentId: txn.externalPaymentId,
        coinAmount: txn.coinAmount,
        externalAmount: txn.externalAmount,
        paymentId: paymentId,
        serviceId: serviceId,
        serviceType: serviceType,
        serviceDuration: serviceDuration,
        scheduledDateTime: scheduledDateTime,
        description: txn.description,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
        formattedDate: formatDate(txn.createdAt),
        cancelledBy: cancelledBy, // 'star' or 'fan' - who cancelled
        payer: displayPayer ? {
          id: displayPayer._id,
          name: displayPayer.name,
          pseudo: displayPayer.pseudo,
          baroniId: displayPayer.baroniId,
          profilePic: displayPayer.profilePic,
          role: displayPayer.role,
          isVerified: displayPayer.isVerified,
          profession: displayPayer.profession ? {
            id: displayPayer.profession._id || displayPayer.profession.id || null,
            name: displayPayer.profession.name || ''
          } : null
        } : null,
        receiver: displayReceiver ? {
          id: displayReceiver._id,
          name: displayReceiver.name,
          pseudo: displayReceiver.pseudo,
          baroniId: displayReceiver.baroniId,
          profilePic: displayReceiver.profilePic,
          role: displayReceiver.role,
          isVerified: displayReceiver.isVerified,
          profession: displayReceiver.profession ? {
            id: displayReceiver.profession._id || displayReceiver.profession.id || null,
            name: displayReceiver.profession.name || ''
          } : null
        } : null,
        metadata: txn.metadata,
        serviceDetails: serviceDetails
      };
    }))).filter(item => item !== null); // Remove null items (non-refundable transactions)

    return res.json({ success: true, data: { items: enrichedItems, page, limit, total } });
  } catch (err) {
    console.error('Error listing refundables:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const triggerRefund = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const result = await refundTransaction(transactionId);
    return res.json({ success: true, message: result.message });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};


