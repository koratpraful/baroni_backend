import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import Transaction from '../models/Transaction.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';

// Get appointments with comprehensive admin filters
/**
 * Get appointments with comprehensive admin filters
 * 
 * Query Parameters (all optional):
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - search: Search by star name, user name, or Baroni ID
 * - category: Filter by category - 'all', 'video_calls', 'dedications', 'live_shows' (default: 'all')
 * - status: Filter by status - 'all', 'pending', 'approved', 'rejected', 'completed', 'cancelled' (default: 'all')
 * - startDate: Start date for date range filter (ISO 8601 format)
 * - endDate: End date for date range filter (ISO 8601 format)
 * - sortBy: Sort field - 'createdAt', 'updatedAt', 'date', 'price' (default: 'createdAt')
 * - sortOrder: Sort order - 'asc' or 'desc' (default: 'desc')
 * 
 * If no filters are provided, returns all appointments
 */
export const getAppointmentsWithFilters = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      category,
      status,
      startDate,
      endDate,
      sortBy,
      sortOrder
    } = req.query;

    // Build base filter - start with empty to get all appointments
    let filter = {};
    
    // Category filtering (only apply if category is provided and not 'all')
    if (category && category !== 'all' && category.trim() !== '') {
      if (category === 'video_calls') {
        // All appointments are video calls - no additional filter needed
        // Keep filter as {} to get all appointments
      } else if (category === 'dedications') {
        filter = { type: 'dedication' };
      } else if (category === 'live_shows') {
        filter = { type: 'live_show' };
      }
    }
    // If category is 'all' or not provided, filter stays as {} which returns all

    // Status filtering (only apply if status is provided and not 'all')
    if (status && status !== 'all' && status.trim() !== '') {
      filter.status = status;
    }

    // Date range filtering (only apply if dates are provided and not empty)
    if (startDate && startDate.trim() !== '') {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate && endDate.trim() !== '') {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$lte = new Date(endDate);
    }

    // Search filtering (by star name, user name, or Baroni ID)
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      const starIds = await User.find({
        $or: [
          { name: searchRegex },
          { baroniId: searchRegex },
          { pseudo: searchRegex }
        ],
        role: 'star'
      }).select('_id');

      const userIds = await User.find({
        $or: [
          { name: searchRegex },
          { baroniId: searchRegex },
          { pseudo: searchRegex }
        ]
      }).select('_id');

      const searchIds = [
        ...starIds.map(s => s._id),
        ...userIds.map(u => u._id)
      ];

      if (searchIds.length > 0) {
        filter.$or = [
          { starId: { $in: searchIds } },
          { fanId: { $in: searchIds } }
        ];
      } else {
        // If no users found, return empty result
        filter.$or = [{ _id: null }]; // This will match nothing
      }
    }

    // Pagination with defaults
    const pageNum = page && !isNaN(parseInt(page)) && parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = limit && !isNaN(parseInt(limit)) && parseInt(limit) > 0 ? parseInt(limit) : 20;
    const skip = (pageNum - 1) * limitNum;

    // Sorting with defaults and validation
    const validSortFields = ['createdAt', 'updatedAt', 'date', 'price'];
    const sortField = sortBy && validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = {};
    sort[sortField] = sortDirection;

    // Get appointments with populated data
    const appointments = await Appointment.find(filter)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession',
        populate: {
          path: 'profession',
          select: 'name'
        }
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .populate('availabilityId')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Apply status priority sorting after fetching (missed comes before completed)
    // Status priority: (1) pending, (2) approved/in_progress, (3) missed, (4) completed, (5) cancelled/rejected
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

    // Sort appointments: first by status priority (missed before completed), then by the original sort field
    appointments.sort((a, b) => {
      const statusPriorityA = getStatusPriority(a.status);
      const statusPriorityB = getStatusPriority(b.status);
      
      // If status priorities are different, sort by status priority first
      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }
      
      // If same status priority, use the original sort field
      const valueA = a[sortField] ? (a[sortField] instanceof Date ? a[sortField].getTime() : a[sortField]) : 0;
      const valueB = b[sortField] ? (b[sortField] instanceof Date ? b[sortField].getTime() : b[sortField]) : 0;
      
      if (valueA !== valueB) {
        return sortDirection === 1 ? valueA - valueB : valueB - valueA;
      }
      
      // Tertiary sort by _id for stable sorting
      return String(a._id).localeCompare(String(b._id));
    });

    // Get total count for pagination
    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Format response data with null checks
    const formattedAppointments = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      // Handle null star or user gracefully
      const starData = star ? {
        id: star._id,
        name: star.name || null,
        baroniId: star.baroniId || null,
        profilePic: star.profilePic || null,
        isVerified: star.isVerified || false,
        role: star.profession || 'Singer',
        professionId: star.profession?._id || star.profession || null,
        professionName: star.profession?.name || null,
        email: star.email || null,
        contact: star.contact || null
      } : null;

      const userData = user ? {
        id: user._id,
        name: user.name || null,
        baroniId: user.baroniId || null,
        profilePic: user.profilePic || null,
        email: user.email || null,
        contact: user.contact || null
      } : null;

      // Handle date and time safely
      let scheduledDateTime = null;
      if (appointment.date && appointment.time) {
        try {
          scheduledDateTime = new Date(`${appointment.date}T${appointment.time}`);
        } catch (e) {
          scheduledDateTime = appointment.createdAt || new Date();
        }
      } else {
        scheduledDateTime = appointment.createdAt || new Date();
      }
      
      return {
        id: appointment._id,
        category: 'video_calls', // Default for now
        status: appointment.status || 'pending',
        star: starData,
        user: userData,
        service: {
          type: 'Video Call',
          duration: '15 min', // Default or from availability
          price: appointment.price || 0
        },
        scheduledDateTime: scheduledDateTime,
        createdAt: appointment.createdAt || new Date(),
        updatedAt: appointment.updatedAt || new Date(),
        callDuration: appointment.callDuration || 0,
        // Duration in seconds: 0 if pending/not completed, actual duration if completed
        duration: appointment.status === 'completed' && typeof appointment.callDuration === 'number' ? appointment.callDuration : 0,
        paymentStatus: appointment.paymentStatus || 'pending',
        actions: getAvailableActions(appointment.status || 'pending'),
        earnings: calculateEarnings(appointment)
      };
    });

    res.json({
      success: true,
      data: {
        appointments: formattedAppointments,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum
        },
        filters: {
          category: category || 'all',
          status: status || 'all',
          search: search || '',
          startDate: startDate || null,
          endDate: endDate || null,
          sortBy: sortField,
          sortOrder: sortOrder || 'desc'
        }
      }
    });

  } catch (error) {
    console.error('Error getting appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointments',
      error: error.message || 'Unknown error occurred'
    });
  }
};

// Get appointment statistics
export const getAppointmentStatistics = async (req, res) => {
  try {
    const { period = 'current_month', category = 'all' } = req.query;
    
    // Calculate date range based on period
    const { startDate, endDate } = getDateRange(period);
    
    let filter = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (category !== 'all') {
      // Add category filter if needed
    }

    const [
      totalAppointments,
      pendingAppointments,
      approvedAppointments,
      completedAppointments,
      cancelledAppointments,
      rejectedAppointments,
      totalRevenue
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({ ...filter, status: 'pending' }),
      Appointment.countDocuments({ ...filter, status: 'approved' }),
      Appointment.countDocuments({ ...filter, status: 'completed' }),
      Appointment.countDocuments({ ...filter, status: 'cancelled' }),
      Appointment.countDocuments({ ...filter, status: 'rejected' }),
      Appointment.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalAppointments,
        pendingAppointments,
        approvedAppointments,
        completedAppointments,
        cancelledAppointments,
        rejectedAppointments,
        totalRevenue: totalRevenue[0]?.total || 0,
        period,
        category
      }
    });

  } catch (error) {
    console.error('Error getting appointment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointment statistics',
      error: error.message
    });
  }
};

// Approve appointment
export const approveAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending appointments can be approved'
      });
    }

    appointment.status = 'approved';
    appointment.adminNotes = adminNotes;
    appointment.approvedAt = new Date();
    appointment.approvedBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment approved successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error approving appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve appointment',
      error: error.message
    });
  }
};

// Reject appointment
export const rejectAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason = '', adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending appointments can be rejected'
      });
    }

    appointment.status = 'rejected';
    appointment.rejectionReason = reason;
    appointment.adminNotes = adminNotes;
    appointment.rejectedAt = new Date();
    appointment.rejectedBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment rejected successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          rejectionReason: appointment.rejectionReason,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error rejecting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject appointment',
      error: error.message
    });
  }
};

// Reschedule appointment
export const rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDateTime, reason = '', adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Allow rescheduling regardless of current status - no conditions checked

    // Update appointment with new date/time
    const newDate = new Date(newDateTime);
    appointment.date = newDate.toISOString().split('T')[0];
    appointment.time = newDate.toTimeString().split(' ')[0].substring(0, 5);
    appointment.rescheduleReason = reason;
    appointment.adminNotes = adminNotes;
    appointment.rescheduledAt = new Date();
    appointment.rescheduledBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          newDateTime: newDateTime,
          rescheduleReason: appointment.rescheduleReason,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule appointment',
      error: error.message
    });
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason = '', refundAmount = 0, adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be cancelled'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = reason;
    appointment.refundAmount = refundAmount;
    appointment.adminNotes = adminNotes;
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          cancellationReason: appointment.cancellationReason,
          refundAmount: appointment.refundAmount,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// Get appointment details
export const getAppointmentDetails = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Invalid appointment ID'
      });
    }

    const { appointmentId } = req.params;

    // Additional safeguard: Check if appointmentId is a reserved route name
    const reservedRoutes = ['dedications', 'live-shows', 'statistics'];
    if (reservedRoutes.includes(appointmentId)) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Additional safeguard: Check if appointmentId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format'
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession',
        populate: {
          path: 'profession',
          select: 'name'
        }
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .populate('availabilityId')
      .populate('transactionId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const star = appointment.starId;
    const user = appointment.fanId;

    // Handle null star or user gracefully
    const starData = star ? {
      id: star._id,
      name: star.name || null,
      baroniId: star.baroniId || null,
      profilePic: star.profilePic || null,
      isVerified: star.isVerified || false,
      role: star.profession || 'Singer',
      professionId: star.profession?._id || star.profession || null,
      professionName: star.profession?.name || null,
      email: star.email || null,
      contact: star.contact || null
    } : null;

    const userData = user ? {
      id: user._id,
      name: user.name || null,
      baroniId: user.baroniId || null,
      profilePic: user.profilePic || null,
      email: user.email || null,
      contact: user.contact || null
    } : null;

    // Handle date and time safely
    let scheduledDateTime = null;
    if (appointment.date && appointment.time) {
      try {
        scheduledDateTime = new Date(`${appointment.date}T${appointment.time}`);
      } catch (e) {
        scheduledDateTime = appointment.createdAt || new Date();
      }
    } else {
      scheduledDateTime = appointment.createdAt || new Date();
    }

    res.json({
      success: true,
      data: {
        appointment: {
          id: appointment._id,
          category: 'video_calls',
          status: appointment.status || 'pending',
          star: starData,
          user: userData,
          service: {
            type: 'Video Call',
            duration: '15 min',
            price: appointment.price || 0
          },
          scheduledDateTime: scheduledDateTime,
          createdAt: appointment.createdAt || new Date(),
          updatedAt: appointment.updatedAt || new Date(),
          callDuration: appointment.callDuration || 0,
          // Duration in seconds: 0 if pending/not completed, actual duration if completed
          duration: appointment.status === 'completed' && typeof appointment.callDuration === 'number' ? appointment.callDuration : 0,
          paymentStatus: appointment.paymentStatus || 'pending',
          transaction: appointment.transactionId || null,
          adminNotes: appointment.adminNotes || null,
          actions: getAvailableActions(appointment.status || 'pending'),
          earnings: calculateEarnings(appointment)
        }
      }
    });

  } catch (error) {
    console.error('Error getting appointment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointment details',
      error: error.message
    });
  }
};

/**
 * Get live show appointments
 * 
 * Query Parameters (all optional):
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: Filter by status - 'all', 'pending', 'completed', 'cancelled' (default: 'all')
 * - startDate: Start date for date range filter (ISO 8601 format, optional)
 * - endDate: End date for date range filter (ISO 8601 format, optional)
 * 
 * If no filters are provided, returns all live shows
 */
export const getLiveShowAppointments = async (req, res) => {
  try {
    const {
      page,
      limit,
      status,
      startDate,
      endDate
    } = req.query;

    // Build filter - start with empty to get all live shows
    let filter = {};

    // Status filtering (only apply if status is provided and not 'all')
    if (status && status !== 'all' && status.trim() !== '') {
      filter.status = status;
    }

    // Date range filtering (only apply if dates are provided and not empty)
    if (startDate && startDate.trim() !== '') {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate && endDate.trim() !== '') {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$lte = new Date(endDate);
    }

    // Pagination with defaults
    const pageNum = page && !isNaN(parseInt(page)) && parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = limit && !isNaN(parseInt(limit)) && parseInt(limit) > 0 ? parseInt(limit) : 20;
    const skip = (pageNum - 1) * limitNum;

    // Get live shows with populated data
    const liveShows = await LiveShow.find(filter)
      .populate({
        path: 'starId',
        select: 'name baroniId profilePic profession',
        populate: {
          path: 'profession',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await LiveShow.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: {
        liveShows: liveShows.map(show => {
          const star = show.starId;
          
          // Handle null star gracefully
          const starData = star ? {
            id: star._id,
            name: star.name || null,
            baroniId: star.baroniId || null,
            profilePic: star.profilePic || null,
            professionId: star.profession?._id || star.profession || null,
            professionName: star.profession?.name || null
          } : null;

          // Handle date and time safely
          let scheduledDateTime = null;
          if (show.date && show.time) {
            try {
              const dateStr = show.date instanceof Date 
                ? show.date.toISOString().split('T')[0] 
                : show.date;
              scheduledDateTime = new Date(`${dateStr}T${show.time}`);
            } catch (e) {
              scheduledDateTime = show.createdAt || new Date();
            }
          } else {
            scheduledDateTime = show.createdAt || new Date();
          }

          return {
            id: show._id,
            title: show.sessionTitle || null,
            description: show.description || null,
            star: starData,
            scheduledDateTime: scheduledDateTime,
            status: show.status || 'pending',
            attendees: show.currentAttendees || 0,
            maxAttendees: show.maxCapacity === -1 ? 10000 : (show.maxCapacity || 10000),
            earnings: show.earnings || 0,
            ticketPrice: show.attendanceFee || 2000
          };
        }),
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum
        },
        filters: {
          status: status || 'all',
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });

  } catch (error) {
    console.error('Error getting live show appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get live show appointments',
      error: error.message || 'Unknown error occurred'
    });
  }
};

/**
 * Get dedication appointments
 * 
 * Query Parameters (all optional):
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: Filter by status - 'all', 'pending', 'approved', 'cancelled', 'rejected', 'completed' (default: 'all')
 * - startDate: Start date for date range filter (ISO 8601 format, optional)
 * - endDate: End date for date range filter (ISO 8601 format, optional)
 * 
 * If no filters are provided, returns all dedications
 */
export const getDedicationAppointments = async (req, res) => {
  try {
    const {
      page,
      limit,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    // Build filter - start with empty to get all dedications
    let filter = {};

    // Status filtering (only apply if status is provided and not 'all')
    if (status && status !== 'all' && status.trim() !== '') {
      filter.status = status;
    }

    // Date range filtering (only apply if dates are provided and not empty)
    if (startDate && startDate.trim() !== '') {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate && endDate.trim() !== '') {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$lte = new Date(endDate);
    }

    // Search filtering (by star name, user name, Baroni ID, occasion, eventName, or description)
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      const searchRegex = new RegExp(searchTerm, 'i');
      
      // Find matching users (stars and fans)
      const [starIds, userIds] = await Promise.all([
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

      const searchIds = [
        ...starIds.map(s => s._id),
        ...userIds.map(u => u._id)
      ];

      // Build search conditions - search in user fields AND dedication fields
      const searchConditions = [];
      
      // Search in user fields (starId or fanId)
      if (searchIds.length > 0) {
        searchConditions.push(
          { starId: { $in: searchIds } },
          { fanId: { $in: searchIds } }
        );
      }
      
      // Search in dedication-specific fields
      searchConditions.push(
        { occasion: searchRegex },
        { eventName: searchRegex },
        { description: searchRegex }
      );

      // Combine all search conditions with $or
      if (searchConditions.length > 0) {
        // If filter already has other conditions, use $and to combine
        if (Object.keys(filter).length > 0 && !filter.$and) {
          const existingFilter = { ...filter };
          filter = {
            $and: [
              existingFilter,
              { $or: searchConditions }
            ]
          };
        } else if (filter.$and) {
          // If $and already exists, add search to it
          filter.$and.push({ $or: searchConditions });
        } else {
          // No existing filters, just use $or
          filter.$or = searchConditions;
        }
      } else {
        // If no matches found at all, return empty result
        filter._id = null; // This will match nothing
      }
    }

    // Pagination with defaults
    const pageNum = page && !isNaN(parseInt(page)) && parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = limit && !isNaN(parseInt(limit)) && parseInt(limit) > 0 ? parseInt(limit) : 20;
    const skip = (pageNum - 1) * limitNum;

    // Get dedications with populated data
    const dedications = await DedicationRequest.find(filter)
      .populate({
        path: 'starId',
        select: 'name baroniId profilePic profession',
        populate: {
          path: 'profession',
          select: 'name'
        }
      })
      .populate('fanId', 'name baroniId profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await DedicationRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: {
        dedications: dedications.map(dedication => {
          const star = dedication.starId;
          const user = dedication.fanId;
          
          // Handle null star gracefully
          const starData = star ? {
            id: star._id,
            name: star.name || null,
            baroniId: star.baroniId || null,
            profilePic: star.profilePic || null,
            professionId: star.profession?._id || star.profession || null,
            professionName: star.profession?.name || null
          } : null;

          // Handle null user gracefully
          const userData = user ? {
            id: user._id,
            name: user.name || null,
            baroniId: user.baroniId || null,
            profilePic: user.profilePic || null
          } : null;

          // Handle event date safely
          let scheduledDateTime = null;
          if (dedication.eventDate) {
            try {
              scheduledDateTime = dedication.eventDate instanceof Date 
                ? dedication.eventDate 
                : new Date(dedication.eventDate);
            } catch (e) {
              scheduledDateTime = dedication.createdAt || new Date();
            }
          } else {
            scheduledDateTime = dedication.createdAt || new Date();
          }

          return {
            id: dedication._id,
            dedicationId: dedication._id,
            dedicationType: dedication.occasion || null,
            type: dedication.occasion || null,
            message: dedication.description || null,
            star: starData,
            user: userData,
            scheduledDateTime: scheduledDateTime,
            status: dedication.status || 'pending',
            price: dedication.price || 0,
            videoUrl: dedication.videoUrl || null
          };
        }),
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum
        },
        filters: {
          status: status || 'all',
          startDate: startDate || null,
          endDate: endDate || null,
          search: search || null
        }
      }
    });

  } catch (error) {
    console.error('Error getting dedication appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dedication appointments',
      error: error.message || 'Unknown error occurred'
    });
  }
};

// Helper functions
const getAvailableActions = (status) => {
  switch (status) {
    case 'pending':
      return ['approve', 'reject'];
    case 'approved':
      return ['reschedule', 'cancel'];
    case 'completed':
      return ['view'];
    case 'cancelled':
    case 'rejected':
      return ['view'];
    default:
      return [];
  }
};

const calculateEarnings = (appointment) => {
  if (appointment.status === 'completed') {
    return appointment.price * 0.9; // Assuming 10% platform fee
  }
  return 0;
};

const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'current_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'current_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return { startDate, endDate };
};
