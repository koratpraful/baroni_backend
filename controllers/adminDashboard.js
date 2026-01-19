import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';
import ReportUser from '../models/ReportUser.js';
import DeviceChange from '../models/DeviceChange.js';
import Event from '../models/Event.js';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';

// Helper function to get date range based on period
const getDateRange = (period) => {
  try {
    const now = new Date();
    // Normalize period string (remove spaces, convert to lowercase, handle variations)
    const normalizedPeriod = period ? period.toString().toLowerCase().replace(/\s+/g, '_').trim() : 'current_month';
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    switch (normalizedPeriod) {
      // Current Month variations
      case 'current_month':
      case 'currentmonth':
      case 'this_month':
      case 'thismonth':
        return { startDate: startOfMonth, endDate: endOfMonth };
      
      // Last Month variations
      case 'last_month':
      case 'lastmonth':
      case 'previous_month':
      case 'previousmonth':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { startDate: startOfLastMonth, endDate: endOfLastMonth };
      
      // This Year / Current Year
      case 'this_year':
      case 'thisyear':
      case 'current_year':
      case 'currentyear':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        return { startDate: startOfYear, endDate: endOfYear };
      
      // Last 3 Months
      case 'last_3_months':
      case 'last3months':
      case 'last_3months':
      case 'last3_months':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return { startDate: threeMonthsAgo, endDate: endOfMonth };
      
      // Last 6 Months
      case 'last_6_months':
      case 'last6months':
      case 'last_6months':
      case 'last6_months':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        return { startDate: sixMonthsAgo, endDate: endOfMonth };
      
      // Last 7 Days
      case 'last_7_days':
      case 'last7days':
      case 'last_7days':
      case 'last7_days':
      case 'last_week':
      case 'lastweek':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { startDate: sevenDaysAgo, endDate: now };
      
      // Last 30 Days
      case 'last_30_days':
      case 'last30days':
      case 'last_30days':
      case 'last30_days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { startDate: thirtyDaysAgo, endDate: now };
      
      default:
        // Default to current month
        return { startDate: startOfMonth, endDate: endOfMonth };
    }
  } catch (error) {
    console.error('Error in getDateRange:', error);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { startDate: startOfMonth, endDate: endOfMonth };
  }
};

// Dashboard Summary - Key Metrics
export const getDashboardSummary = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get new users count
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    });

    // Get engaged fans (users who made transactions)
    const engagedFans = await User.countDocuments({
      _id: { $in: await Transaction.distinct('payerId', {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      })},
      isDeleted: { $ne: true }
    });

    // Get total active users (users who logged in or made transactions)
    const activeUsers = await User.countDocuments({
      $or: [
        { lastLoginAt: { $gte: startDate, $lte: endDate } },
        { _id: { $in: await Transaction.distinct('payerId', {
          createdAt: { $gte: startDate, $lte: endDate }
        })}}
      ],
      isDeleted: { $ne: true }
    });

    // Device repartition (all users with device type)
    const androidUsers = await User.countDocuments({
      deviceType: 'android',
      isDeleted: { $ne: true }
    });

    const iosUsers = await User.countDocuments({
      deviceType: 'ios',
      isDeleted: { $ne: true }
    });

    // Online users (logged in within last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const onlineUsers = await User.countDocuments({
      lastLoginAt: { $gte: fifteenMinutesAgo },
      isDeleted: { $ne: true }
    });

    // Reported users count - Count unique reported users (not total reports)
    const [reportedStarsResult, reportedFansResult] = await Promise.all([
      ReportUser.distinct('reportedUserId', {
        reportedUserRole: 'star'
      }),
      ReportUser.distinct('reportedUserId', {
      reportedUserRole: 'fan'
      })
    ]);
    const reportedStars = reportedStarsResult.length;
    const reportedFans = reportedFansResult.length;

    return res.json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: {
        newUsers,
        engagedFans,
        totalActiveUsers: activeUsers,
        onlineUsers,
        deviceRepartition: {
          androidUsers: { count: androidUsers, change: 0 }, // You can calculate change
          iosUsers: { count: iosUsers, change: 0 }
        },
        reportedUsers: {
          stars: reportedStars,
          fans: reportedFans
        }
      }
    });

  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dashboard summary'
    });
  }
};

// Revenue Insights
export const getRevenueInsights = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Total revenue from completed transactions
    const totalRevenueResult = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);

    const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;

    // Escrow amount (pending transactions)
    const escrowResult = await Transaction.aggregate([
      {
        $match: {
          status: 'pending',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          escrowAmount: { $sum: '$amount' }
        }
      }
    ]);

    const escrowAmount = escrowResult[0]?.escrowAmount || 0;

    // Service-wise revenue breakdown
    const serviceRevenue = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$type',
          amount: { $sum: '$amount' }
        }
      }
    ]);

    const serviceBreakdown = serviceRevenue.map(service => ({
      service: service._id,
      amount: service.amount
    }));

    return res.json({
      success: true,
      message: 'Revenue insights retrieved successfully',
      data: {
        totalRevenue,
        escrowAmount,
        serviceRevenue: serviceBreakdown
      }
    });

  } catch (err) {
    console.error('Revenue insights error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get revenue insights'
    });
  }
};

// Active Users by Country
export const getActiveUsersByCountry = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month', limit = 10 } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get active user IDs first (users who made transactions in the period)
    const activeUserIds = await Transaction.distinct('payerId', {
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Build match condition for active users
    const matchCondition = {
      country: { $exists: true, $ne: null, $ne: '' },
      isDeleted: { $ne: true }
    };

    // Add active user conditions
    if (activeUserIds.length > 0) {
      matchCondition.$or = [
        { lastLoginAt: { $gte: startDate, $lte: endDate } },
        { _id: { $in: activeUserIds } }
      ];
    } else {
      matchCondition.lastLoginAt = { $gte: startDate, $lte: endDate };
    }

    // Get active users by country
    const countryStats = await User.aggregate([
      {
        $match: matchCondition
      },
      {
        $group: {
          _id: '$country',
          stars: {
            $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
          },
          fans: {
            $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { stars: -1, fans: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    const countries = countryStats.map(country => ({
      name: country._id,
      stars: country.stars,
      fans: country.fans
    }));

    return res.json({
      success: true,
      message: 'Active users by country retrieved successfully',
      data: {
        countries
      }
    });

  } catch (err) {
    console.error('Active users by country error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active users by country'
    });
  }
};

// Cost Evaluation (Service Usage Minutes)
export const getCostEvaluation = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Video calls minutes (from appointments)
    const videoCallsResult = await Appointment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$callDuration' } // Using callDuration field from Appointment model
        }
      }
    ]);

    const videoCallsMinutes = videoCallsResult[0]?.totalMinutes || 0;

    // Live show minutes (from live shows) - estimate based on attendance
    const liveShowResult = await LiveShow.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: { $multiply: ['$currentAttendees', 30] } } // Estimate 30 minutes per attendee
        }
      }
    ]);

    const liveShowMinutes = liveShowResult[0]?.totalMinutes || 0;

    // Dedication minutes (estimated based on requests)
    const dedicationResult = await DedicationRequest.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: 5 } // Assuming 5 minutes per dedication
        }
      }
    ]);

    const dedicationMinutes = dedicationResult[0]?.totalMinutes || 0;

    return res.json({
      success: true,
      message: 'Cost evaluation retrieved successfully',
      data: {
        videoCalls: { minutes: videoCallsMinutes, change: 0 },
        liveShow: { minutes: liveShowMinutes, change: 0 },
        dedication: { minutes: dedicationMinutes, change: 0 }
      }
    });

  } catch (err) {
    console.error('Cost evaluation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get cost evaluation'
    });
  }
};

// Service Insights (Detailed metrics for each service)
export const getServiceInsights = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { serviceType } = req.params;
    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    let insights = {};

    switch (serviceType) {
      case 'video-call':
        insights = await getVideoCallInsights(startDate, endDate);
        break;
      case 'live-show':
        insights = await getLiveShowInsights(startDate, endDate);
        break;
      case 'dedication':
        insights = await getDedicationInsights(startDate, endDate);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid service type'
        });
    }

    return res.json({
      success: true,
      message: 'Service insights retrieved successfully',
      data: insights
    });

  } catch (err) {
    console.error('Service insights error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get service insights'
    });
  }
};

// Helper function for video call insights
const getVideoCallInsights = async (startDate, endDate) => {
  const appointments = await Appointment.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = appointments.filter(apt => apt.status === 'completed').length;
  const approved = appointments.filter(apt => apt.status === 'approved').length;
  const cancelled = appointments.filter(apt => apt.status === 'cancelled').length;
  const pending = appointments.filter(apt => apt.status === 'pending').length;

  const uniqueUsers = new Set([
    ...appointments.map(apt => apt.fanId?.toString()),
    ...appointments.map(apt => apt.starId?.toString())
  ]).size;

  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        type: 'appointment_payment',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'appointments',
        localField: '_id',
        foreignField: 'transactionId',
        as: 'appointment'
      }
    },
    {
      $match: {
        'appointment.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Helper function for live show insights
const getLiveShowInsights = async (startDate, endDate) => {
  const liveShows = await LiveShow.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = liveShows.filter(show => show.status === 'completed').length;
  const approved = liveShows.filter(show => show.status === 'approved').length;
  const cancelled = liveShows.filter(show => show.status === 'cancelled').length;
  const pending = liveShows.filter(show => show.status === 'pending').length;

  const uniqueUsers = new Set([
    ...liveShows.map(show => show.starId?.toString()),
    ...(await LiveShowAttendance.distinct('fanId', {
      liveShowId: { $in: liveShows.map(show => show._id) }
    })).map(id => id.toString())
  ]).size;

  // Calculate net revenue from live show transactions
  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        type: { $in: ['live_show_attendance_payment', 'live_show_hosting_payment'] },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Helper function for dedication insights
const getDedicationInsights = async (startDate, endDate) => {
  const dedicationRequests = await DedicationRequest.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = dedicationRequests.filter(req => req.status === 'completed').length;
  const approved = dedicationRequests.filter(req => req.status === 'approved').length;
  const cancelled = dedicationRequests.filter(req => req.status === 'cancelled').length;
  const pending = dedicationRequests.filter(req => req.status === 'pending').length;

  const uniqueUsers = new Set([
    ...dedicationRequests.map(req => req.fanId?.toString()),
    ...dedicationRequests.map(req => req.starId?.toString())
  ]).size;

  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        type: { $in: ['dedication_request_payment', 'dedication_payment'] },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'dedicationrequests',
        localField: '_id',
        foreignField: 'transactionId',
        as: 'dedicationRequest'
      }
    },
    {
      $match: {
        'dedicationRequest.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Helper function for become star insights
const getBecomeStarInsights = async (startDate, endDate) => {
  // Get all become_star_payment transactions in the period
  const becomeStarTransactions = await Transaction.find({
    type: 'become_star_payment',
    createdAt: { $gte: startDate, $lte: endDate }
  });

  // Count by status
  const completed = becomeStarTransactions.filter(txn => txn.status === 'completed').length;
  const approved = becomeStarTransactions.filter(txn => txn.status === 'approved').length;
  const cancelled = becomeStarTransactions.filter(txn => txn.status === 'cancelled').length;
  const pending = becomeStarTransactions.filter(txn => txn.status === 'pending').length;

  // Get unique users (payers who paid to become stars)
  const uniqueUsers = new Set(
    becomeStarTransactions
      .map(txn => txn.payerId?.toString())
      .filter(id => id)
  ).size;

  // Calculate net revenue from completed become_star_payment transactions
  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        type: 'become_star_payment',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Top Stars API
export const getTopStars = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month', limit = 50, sortBy = 'revenue' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get top stars by revenue
    const topStars = await Transaction.aggregate([
      {
        $match: {
          receiverId: { $exists: true },
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$receiverId',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'star'
        }
      },
      {
        $unwind: '$star'
      },
      {
        $match: {
          'star.role': 'star',
          'star.isDeleted': { $ne: true }
        }
      },
      {
        $project: {
          id: '$_id',
          name: '$star.name',
          pseudo: '$star.pseudo',
          profilePic: '$star.profilePic',
          revenue: '$totalRevenue',
          transactionCount: '$transactionCount',
          engagementScore: { $divide: ['$totalRevenue', '$transactionCount'] }
        }
      },
      {
        $sort: sortBy === 'revenue' ? { revenue: -1 } : { engagementScore: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    return res.json({
      success: true,
      message: 'Top stars retrieved successfully',
      data: {
        stars: topStars
      }
    });

  } catch (err) {
    console.error('Top stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get top stars'
    });
  }
};

// Complete Dashboard Data (All in one)
export const getCompleteDashboard = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;

    // Get all dashboard data in parallel
    const [
      summaryData,
      revenueData,
      countryData,
      costData,
      videoCallInsights,
      liveShowInsights,
      dedicationInsights,
      topStarsData
    ] = await Promise.all([
      getDashboardSummaryData(period),
      getRevenueInsightsData(period),
      getActiveUsersByCountryData(period),
      getCostEvaluationData(period),
      getVideoCallInsightsData(period),
      getLiveShowInsightsData(period),
      getDedicationInsightsData(period),
      getTopStarsData(period)
    ]);

    return res.json({
      success: true,
      message: 'Complete dashboard data retrieved successfully',
      data: {
        summary: summaryData,
        revenue: revenueData,
        countries: countryData,
        costEvaluation: costData,
        serviceInsights: {
          videoCall: videoCallInsights,
          liveShow: liveShowInsights,
          dedication: dedicationInsights
        },
        topStars: topStarsData
      }
    });

  } catch (err) {
    console.error('Complete dashboard error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get complete dashboard data'
    });
  }
};

// Helper functions for complete dashboard
const getDashboardSummaryData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const newUsers = await User.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
    isDeleted: { $ne: true }
  });

  const engagedFans = await User.countDocuments({
    _id: { $in: await Transaction.distinct('payerId', {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    })},
    isDeleted: { $ne: true }
  });

  const totalActiveUsers = await User.countDocuments({
    $or: [
      { lastLoginAt: { $gte: startDate, $lte: endDate } },
      { _id: { $in: await Transaction.distinct('payerId', {
        createdAt: { $gte: startDate, $lte: endDate }
      })}}
    ],
    isDeleted: { $ne: true }
  });

  const androidUsers = await User.countDocuments({
    deviceType: 'android',
    isDeleted: { $ne: true }
  });

  const iosUsers = await User.countDocuments({
    deviceType: 'ios',
    isDeleted: { $ne: true }
  });

  // Online users (logged in within last 15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const onlineUsers = await User.countDocuments({
    lastLoginAt: { $gte: fifteenMinutesAgo },
    isDeleted: { $ne: true }
  });

  return {
    newUsers,
    engagedFans,
    totalActiveUsers,
    onlineUsers,
    deviceRepartition: {
      androidUsers: { count: androidUsers, change: 0 },
      iosUsers: { count: iosUsers, change: 0 }
    }
  };
};

const getRevenueInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const totalRevenueResult = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  const escrowResult = await Transaction.aggregate([
    {
      $match: {
        status: 'pending',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        escrowAmount: { $sum: '$amount' }
      }
    }
  ]);

  return {
    totalRevenue: totalRevenueResult[0]?.totalRevenue || 0,
    escrowAmount: escrowResult[0]?.escrowAmount || 0
  };
};

const getActiveUsersByCountryData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  // Get active user IDs first (users who made transactions in the period)
  const activeUserIds = await Transaction.distinct('payerId', {
    createdAt: { $gte: startDate, $lte: endDate }
  });

  // Build match condition for active users
  const matchCondition = {
    country: { $exists: true, $ne: null, $ne: '' },
        isDeleted: { $ne: true }
  };

  // Add active user conditions
  if (activeUserIds.length > 0) {
    matchCondition.$or = [
      { lastLoginAt: { $gte: startDate, $lte: endDate } },
      { _id: { $in: activeUserIds } }
    ];
  } else {
    matchCondition.lastLoginAt = { $gte: startDate, $lte: endDate };
  }
  
  const countryStats = await User.aggregate([
    {
      $match: matchCondition
    },
    {
      $group: {
        _id: '$country',
        stars: {
          $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
        },
        fans: {
          $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { stars: -1, fans: -1 }
    },
    {
      $limit: 10
    }
  ]);

  return countryStats.map(country => ({
    name: country._id,
    stars: country.stars,
    fans: country.fans
  }));
};

const getCostEvaluationData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const videoCallsResult = await Appointment.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: '$callDuration' }
      }
    }
  ]);

  const liveShowResult = await LiveShow.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: { $multiply: ['$currentAttendees', 30] } }
      }
    }
  ]);

  const dedicationResult = await DedicationRequest.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: 5 }
      }
    }
  ]);

  return {
    videoCalls: { minutes: videoCallsResult[0]?.totalMinutes || 0, change: 0 },
    liveShow: { minutes: liveShowResult[0]?.totalMinutes || 0, change: 0 },
    dedication: { minutes: dedicationResult[0]?.totalMinutes || 0, change: 0 }
  };
};

const getVideoCallInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getVideoCallInsights(startDate, endDate);
};

const getLiveShowInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getLiveShowInsights(startDate, endDate);
};

const getDedicationInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getDedicationInsights(startDate, endDate);
};

const getBecomeStarInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getBecomeStarInsights(startDate, endDate);
};

const getTopStarsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const topStars = await Transaction.aggregate([
    {
      $match: {
        receiverId: { $exists: true },
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$receiverId',
        totalRevenue: { $sum: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'star'
      }
    },
    {
      $unwind: '$star'
    },
    {
      $match: {
        'star.role': 'star',
        'star.isDeleted': { $ne: true }
      }
    },
    {
      $project: {
        id: '$_id',
        name: '$star.name',
        revenue: '$totalRevenue'
      }
    },
    {
      $sort: { revenue: -1 }
    },
    {
      $limit: 50
    }
  ]);

  return topStars;
};

// Enhanced Service Revenue Breakdown API
export const getServiceRevenueBreakdown = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get service-wise revenue breakdown
    const serviceRevenue = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$type',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          service: '$_id',
          revenue: '$totalRevenue',
          transactionCount: '$transactionCount',
          averageTransaction: { $divide: ['$totalRevenue', '$transactionCount'] }
        }
      }
    ]);

    // Map transaction types to service names
    const serviceMapping = {
      'appointment': 'Video Calls',
      'live_show': 'Live Show',
      'dedication': 'Dedication',
      'coin_purchase': 'Coin Purchase',
      'star_promotion': 'Star Promotion'
    };

    const formattedRevenue = serviceRevenue.map(service => ({
      service: serviceMapping[service.service] || service.service,
      revenue: service.revenue,
      transactionCount: service.transactionCount,
      averageTransaction: Math.round(service.averageTransaction * 100) / 100
    }));

    return res.json({
      success: true,
      message: 'Service revenue breakdown retrieved successfully',
      data: {
        serviceRevenue: formattedRevenue,
        totalRevenue: serviceRevenue.reduce((sum, service) => sum + service.revenue, 0)
      }
    });

  } catch (err) {
    console.error('Service revenue breakdown error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get service revenue breakdown'
    });
  }
};

// Device Change Tracking API
export const getDeviceChangeStats = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get current device counts
    const androidUsers = await User.countDocuments({
      deviceType: 'android',
      isDeleted: { $ne: true }
    });

    const iosUsers = await User.countDocuments({
      deviceType: 'ios',
      isDeleted: { $ne: true }
    });

    // Get device changes in the period
    const deviceChanges = await DeviceChange.aggregate([
      {
        $match: {
          changeDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$newDeviceType',
          changes: { $sum: 1 }
        }
      }
    ]);

    const androidChanges = deviceChanges.find(d => d._id === 'android')?.changes || 0;
    const iosChanges = deviceChanges.find(d => d._id === 'ios')?.changes || 0;

    return res.json({
      success: true,
      message: 'Device change stats retrieved successfully',
      data: {
        androidUsers: { count: androidUsers, change: androidChanges },
        iosUsers: { count: iosUsers, change: iosChanges }
      }
    });

  } catch (err) {
    console.error('Device change stats error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get device change stats'
    });
  }
};

// Detailed Reported Users API
export const getReportedUsersDetails = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { status = 'pending', limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get reported users with details
    const reportedUsers = await ReportUser.find({ status })
      .populate('reporterId', 'name pseudo profilePic')
      .populate('reportedUserId', 'name pseudo profilePic role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get counts by role
    const reportedStars = await ReportUser.countDocuments({ 
      reportedUserRole: 'star',
      status 
    });

    const reportedFans = await ReportUser.countDocuments({ 
      reportedUserRole: 'fan',
      status 
    });

    return res.json({
      success: true,
      message: 'Reported users details retrieved successfully',
      data: {
        reports: reportedUsers.map(report => ({
          id: report._id,
          reporter: {
            id: report.reporterId._id,
            name: report.reporterId.name,
            pseudo: report.reporterId.pseudo,
            profilePic: report.reporterId.profilePic
          },
          reportedUser: {
            id: report.reportedUserId._id,
            name: report.reportedUserId.name,
            pseudo: report.reportedUserId.pseudo,
            profilePic: report.reportedUserId.profilePic,
            role: report.reportedUserId.role
          },
          reason: report.reason,
          description: report.description,
          status: report.status,
          createdAt: report.createdAt
        })),
        counts: {
          stars: reportedStars,
          fans: reportedFans,
          total: reportedStars + reportedFans
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: reportedStars + reportedFans
        }
      }
    });

  } catch (err) {
    console.error('Reported users details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get reported users details'
    });
  }
};

// Event Management APIs
export const createEvent = async (req, res) => {
  try {
    // Check validation errors first
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Validation failed'
      });
    }

    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const {
      title,
      description,
      type,
      eventDate,
      eventTime,
      endDate,
      targetAudience,
      targetCountry,
      priority,
      budget,
      image,
      link
    } = req.body;

    // Handle image upload if provided via form-data
    let imageUrl = image; // Use image from body (if JSON) or will be replaced if file uploaded
    
    if (req.file && req.file.fieldname === 'image') {
      try {
        const { uploadFile } = await import('../utils/uploadFile.js');
        imageUrl = await uploadFile(req.file.buffer);
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: 'Error uploading image: ' + uploadError.message
        });
      }
    }

    // Validate event date
    if (!eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Event date is required'
      });
    }

    // Combine eventDate and eventTime to create startDate
    let startDateValue = eventDate;
    if (eventTime && eventTime.trim() !== '') {
      // If eventTime is provided, combine with eventDate
      // Handle different date formats
      const dateObj = new Date(eventDate);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid event date format'
        });
      }
      
      // Extract date part (YYYY-MM-DD)
      const datePart = dateObj.toISOString().split('T')[0];
      
      // Handle time format (HH:mm or HH:mm:ss)
      let timePart = eventTime.trim();
      if (!timePart.includes(':')) {
        return res.status(400).json({
          success: false,
          message: 'Event time must be in HH:mm or HH:mm:ss format'
        });
      }
      
      // Ensure time has seconds if not provided
      const timeParts = timePart.split(':');
      if (timeParts.length === 2) {
        timePart = `${timePart}:00`;
      }
      
      startDateValue = `${datePart}T${timePart}.000Z`;
    }

    const start = new Date(startDateValue);
    
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event date format. Please use ISO 8601 format (e.g., 2024-01-01T00:00:00.000Z)'
      });
    }

    // Handle endDate if provided
    let end = null;
    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end date format. Please use ISO 8601 format (e.g., 2024-01-01T00:00:00.000Z)'
        });
      }
      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after event date'
        });
      }
    }

    const event = new Event({
      title,
      description,
      type: type || undefined,
      startDate: start,
      endDate: end || undefined,
      targetAudience: targetAudience || 'all',
      targetCountry,
      priority: priority || 'medium',
      budget: budget ? parseFloat(budget) : undefined,
      image: imageUrl,
      link,
      createdBy: admin._id
    });

    await event.save();

    // Populate creator details
    await event.populate('createdBy', 'name email baroniId');

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });

  } catch (err) {
    console.error('Create event error:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const errorMessages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation error: ${errorMessages}`
      });
    }

    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Event with this information already exists'
      });
    }

    // Generic error with more details in development
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' 
        ? `Failed to create event: ${err.message}` 
        : 'Failed to create event'
    });
  }
};

export const getEvents = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { status, type, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const events = await Event.find(filter)
      .populate('createdBy', 'name pseudo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalEvents = await Event.countDocuments(filter);

    // Transform events to include likes and joined users counts
    const transformedEvents = events.map(event => {
      const transformed = { ...event };
      transformed.likesCount = Array.isArray(event.likes) ? event.likes.length : 0;
      transformed.joinedUsersCount = Array.isArray(event.joinedUsers) ? event.joinedUsers.length : 0;
      return transformed;
    });

    return res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: {
        events: transformedEvents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalEvents
        }
      }
    });

  } catch (err) {
    console.error('Get events error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get events'
    });
  }
};

export const updateEvent = async (req, res) => {
  try {
    // Check validation errors first
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Validation failed'
      });
    }

    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { eventId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID'
      });
    }

    const event = await Event.findOne({ _id: eventId, isDeleted: false });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const {
      title,
      description,
      type,
      eventDate,
      eventTime,
      endDate,
      targetAudience,
      targetCountry,
      priority,
      budget,
      image,
      link,
      status
    } = req.body;

    // Handle image upload if provided via form-data
    let imageUrl = event.image; // Keep existing image by default
    
    if (req.file && req.file.fieldname === 'image') {
      try {
        const { uploadFile } = await import('../utils/uploadFile.js');
        imageUrl = await uploadFile(req.file.buffer);
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: 'Error uploading image: ' + uploadError.message
        });
      }
    } else if (image !== undefined) {
      // If image is provided in body (URL string), use it
      imageUrl = image;
    }

    // Build update data object
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type || undefined;
    if (imageUrl !== undefined && imageUrl !== event.image) updateData.image = imageUrl;
    if (link !== undefined) updateData.link = (link && link.trim() !== '') ? link.trim() : undefined;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (targetCountry !== undefined) updateData.targetCountry = targetCountry;
    if (priority !== undefined) updateData.priority = priority;
    if (budget !== undefined) updateData.budget = budget ? parseFloat(budget) : undefined;
    if (status !== undefined) updateData.status = status;

    // Handle eventDate and eventTime
    if (eventDate !== undefined) {
      let startDateValue = eventDate;
      
      if (eventTime && eventTime.trim() !== '') {
        // Combine eventDate and eventTime
        const dateObj = new Date(eventDate);
        if (isNaN(dateObj.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid event date format'
          });
        }
        
        const datePart = dateObj.toISOString().split('T')[0];
        let timePart = eventTime.trim();
        
        if (!timePart.includes(':')) {
          return res.status(400).json({
            success: false,
            message: 'Event time must be in HH:mm or HH:mm:ss format'
          });
        }
        
        const timeParts = timePart.split(':');
        if (timeParts.length === 2) {
          timePart = `${timePart}:00`;
        }
        
        startDateValue = `${datePart}T${timePart}.000Z`;
      }

      const start = new Date(startDateValue);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid event date format. Please use ISO 8601 format (e.g., 2024-01-01T00:00:00.000Z)'
        });
      }
      updateData.startDate = start;
    }

    // Handle endDate
    if (endDate !== undefined) {
      if (endDate === null || endDate === '') {
        updateData.endDate = undefined;
      } else {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid end date format. Please use ISO 8601 format (e.g., 2024-01-01T00:00:00.000Z)'
          });
        }
        
        // Validate end date is after start date
        const startDate = updateData.startDate || event.startDate;
        if (end <= startDate) {
          return res.status(400).json({
            success: false,
            message: 'End date must be after event date'
          });
        }
        updateData.endDate = end;
      }
    }

    // Update the event
    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email baroniId');

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: updatedEvent
    });

  } catch (err) {
    console.error('Update event error:', err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const errorMessages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation error: ${errorMessages}`
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: err.message
    });
  }
};

export const updateEventStatus = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { eventId } = req.params;
    const { status } = req.body;

    const event = await Event.findOne({ _id: eventId, isDeleted: false });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    event.status = status;
    await event.save();

    return res.json({
      success: true,
      message: 'Event status updated successfully',
      data: event
    });

  } catch (err) {
    console.error('Update event status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update event status'
    });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID'
      });
    }

    const event = await Event.findOne({ 
      _id: eventId, 
      isDeleted: false 
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Soft delete the event
    await event.softDelete();

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (err) {
    console.error('Delete event error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: err.message
    });
  }
};

// Comprehensive Dashboard Overview - All data in one endpoint (matches mobile screen)
export const getDashboardOverview = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);
    
    // Get previous period for comparison
    let previousStartDate, previousEndDate;
    if (period === 'current_month') {
      const now = new Date();
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (period === 'last_month') {
      const now = new Date();
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
    } else {
      // For other periods, calculate previous period
      const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    }

    // Get active user IDs first (needed for multiple queries)
    const [activeUserIds, previousActiveUserIds, engagedFanIds, previousEngagedFanIds] = await Promise.all([
      Transaction.distinct('payerId', {
        createdAt: { $gte: startDate, $lte: endDate }
      }),
      Transaction.distinct('payerId', {
        createdAt: { $gte: previousStartDate, $lte: previousEndDate }
      }),
      Transaction.distinct('payerId', {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }),
      Transaction.distinct('payerId', {
        createdAt: { $gte: previousStartDate, $lte: previousEndDate },
        status: 'completed'
      })
    ]);

    // Build country query condition
    const countryMatchCondition = {
      country: { $exists: true, $ne: null, $ne: '' },
      isDeleted: { $ne: true }
    };
    
    if (activeUserIds.length > 0) {
      countryMatchCondition.$or = [
        { lastLoginAt: { $gte: startDate, $lte: endDate } },
        { _id: { $in: activeUserIds } }
      ];
    } else {
      countryMatchCondition.lastLoginAt = { $gte: startDate, $lte: endDate };
    }

    // Calculate online users (users logged in within last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Execute all queries in parallel for better performance
    const [
      newUsers,
      previousNewUsers,
      engagedFans,
      previousEngagedFans,
      totalActiveUsers,
      onlineUsers,
      revenueData,
      escrowData,
      serviceRevenue,
      countryData,
      deviceData,
      previousDeviceData,
      reportedUsers,
      costData,
      previousCostData,
      videoCallInsights,
      liveShowInsights,
      dedicationInsights,
      becomeStarInsights
    ] = await Promise.all([
      // New Users
      User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: { $ne: true }
      }),
      User.countDocuments({
        createdAt: { $gte: previousStartDate, $lte: previousEndDate },
        isDeleted: { $ne: true }
      }),
      // Engaged Fans
      User.countDocuments({
        _id: { $in: engagedFanIds },
        isDeleted: { $ne: true }
      }),
      User.countDocuments({
        _id: { $in: previousEngagedFanIds },
        isDeleted: { $ne: true }
      }),
      // Total Active Users
      User.countDocuments({
        $or: [
          { lastLoginAt: { $gte: startDate, $lte: endDate } },
          { _id: { $in: activeUserIds } }
        ],
        isDeleted: { $ne: true }
      }),
      // Online Users (logged in within last 15 minutes)
      User.countDocuments({
        lastLoginAt: { $gte: fifteenMinutesAgo },
        isDeleted: { $ne: true }
      }),
      // Total Revenue
      Transaction.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]),
      // Escrow Amount
      Transaction.aggregate([
        {
          $match: {
            status: 'pending',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            escrowAmount: { $sum: '$amount' }
          }
        }
      ]),
      // Service Revenue Breakdown
      Transaction.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$type',
            amount: { $sum: '$amount' }
          }
        }
      ]),
      // Active Users by Country
      User.aggregate([
        {
          $match: countryMatchCondition
        },
        {
          $group: {
            _id: '$country',
            stars: {
              $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
            },
            fans: {
              $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { stars: -1, fans: -1 }
        },
        {
          $limit: 10
        }
      ]),
      // Device Type Current (all users with device type, not filtered by date)
      User.aggregate([
        {
          $match: {
            deviceType: { $exists: true, $ne: null },
            isDeleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$deviceType',
            count: { $sum: 1 }
          }
        }
      ]),
      // Device Type Previous (all users with device type up to previous period end)
      User.aggregate([
        {
          $match: {
            deviceType: { $exists: true, $ne: null },
            isDeleted: { $ne: true },
            createdAt: { $lte: previousEndDate }
          }
        },
        {
          $group: {
            _id: '$deviceType',
            count: { $sum: 1 }
          }
        }
      ]),
      // Reported Users - Count unique reported users by role (not total reports)
      ReportUser.aggregate([
        {
          $group: {
            _id: {
              role: '$reportedUserRole',
              userId: '$reportedUserId'
            }
          }
        },
        {
          $group: {
            _id: '$_id.role',
            count: { $sum: 1 }
          }
        }
      ]),
      // Cost Evaluation - Current
      Promise.all([
        Appointment.aggregate([
          {
            $match: {
              status: 'completed',
              $or: [
                { completedAt: { $gte: startDate, $lte: endDate } },
                { completedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } }
              ],
              callDuration: { $exists: true, $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              totalMinutes: { $sum: { $divide: ['$callDuration', 60] } }
            }
          }
        ]),
        LiveShow.aggregate([
          {
            $match: {
              status: 'completed',
              $or: [
                { updatedAt: { $gte: startDate, $lte: endDate } },
                { createdAt: { $gte: startDate, $lte: endDate } }
              ]
            }
          },
          {
            $group: {
              _id: null,
              totalMinutes: { $sum: { $multiply: ['$currentAttendees', 30] } }
            }
          }
        ]),
        DedicationRequest.aggregate([
          {
            $match: {
              status: 'completed',
              $or: [
                { completedAt: { $gte: startDate, $lte: endDate } },
                { completedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } }
              ]
            }
          },
          {
            $group: {
              _id: null,
              totalMinutes: { $sum: 5 }
            }
          }
        ])
      ]),
      // Cost Evaluation - Previous
      Promise.all([
        Appointment.aggregate([
          {
            $match: {
              status: 'completed',
              $or: [
                { completedAt: { $gte: previousStartDate, $lte: previousEndDate } },
                { completedAt: { $exists: false }, createdAt: { $gte: previousStartDate, $lte: previousEndDate } }
              ],
              callDuration: { $exists: true, $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              totalMinutes: { $sum: { $divide: ['$callDuration', 60] } }
            }
          }
        ]),
        LiveShow.aggregate([
          {
            $match: {
              status: 'completed',
              $or: [
                { updatedAt: { $gte: previousStartDate, $lte: previousEndDate } },
                { createdAt: { $gte: previousStartDate, $lte: previousEndDate } }
              ]
            }
          },
          {
            $group: {
              _id: null,
              totalMinutes: { $sum: { $multiply: ['$currentAttendees', 30] } }
            }
          }
        ]),
        DedicationRequest.aggregate([
          {
            $match: {
              status: 'completed',
              $or: [
                { completedAt: { $gte: previousStartDate, $lte: previousEndDate } },
                { completedAt: { $exists: false }, createdAt: { $gte: previousStartDate, $lte: previousEndDate } }
              ]
            }
          },
          {
            $group: {
              _id: null,
              totalMinutes: { $sum: 5 }
            }
          }
        ])
      ]),
      // Service Insights
      getVideoCallInsights(startDate, endDate),
      getLiveShowInsights(startDate, endDate),
      getDedicationInsights(startDate, endDate),
      getBecomeStarInsights(startDate, endDate)
    ]);

    // Process revenue data
    const escrowAmount = escrowData[0]?.escrowAmount || 0;

    // Process service revenue
    const serviceRevenueMap = {};
    serviceRevenue.forEach(service => {
      if (service._id === 'appointment_payment') {
        serviceRevenueMap.videoCall = service.amount;
      } else if (service._id === 'live_show_attendance_payment' || service._id === 'live_show_hosting_payment') {
        serviceRevenueMap.liveShow = (serviceRevenueMap.liveShow || 0) + service.amount;
      } else if (service._id === 'dedication_request_payment' || service._id === 'dedication_payment') {
        serviceRevenueMap.dedication = (serviceRevenueMap.dedication || 0) + service.amount;
      } else if (service._id === 'become_star_payment') {
        serviceRevenueMap.becomeStar = service.amount;
      }
    });

    // Calculate total revenue as sum of all services (videoCall + liveShow + dedication + becomeStar)
    const totalRevenue = (serviceRevenueMap.videoCall || 0) + (serviceRevenueMap.liveShow || 0) + (serviceRevenueMap.dedication || 0) + (serviceRevenueMap.becomeStar || 0);

    // Process device data
    const deviceMap = {};
    deviceData.forEach(device => {
      deviceMap[device._id] = device.count;
    });
    const previousDeviceMap = {};
    previousDeviceData.forEach(device => {
      previousDeviceMap[device._id] = device.count;
    });
    const androidUsers = deviceMap.android || 0;
    const iosUsers = deviceMap.ios || 0;
    const previousAndroidUsers = previousDeviceMap.android || 0;
    const previousIosUsers = previousDeviceMap.ios || 0;
    const androidChange = androidUsers - previousAndroidUsers;
    const iosChange = iosUsers - previousIosUsers;

    // Process reported users
    const reportedMap = {};
    reportedUsers.forEach(report => {
      reportedMap[report._id] = report.count;
    });
    const reportedStarsCount = reportedMap.star || 0;
    const reportedFansCount = reportedMap.fan || 0;

    // Process cost evaluation
    const videoCallMinutes = Math.round(costData[0][0]?.totalMinutes || 0);
    const liveShowMinutes = Math.round(costData[1][0]?.totalMinutes || 0);
    const dedicationMinutes = Math.round(costData[2][0]?.totalMinutes || 0);
    const previousVideoCallMinutes = Math.round(previousCostData[0][0]?.totalMinutes || 0);
    const previousLiveShowMinutes = Math.round(previousCostData[1][0]?.totalMinutes || 0);
    const previousDedicationMinutes = Math.round(previousCostData[2][0]?.totalMinutes || 0);
    const videoCallChange = videoCallMinutes - previousVideoCallMinutes;
    const liveShowChange = liveShowMinutes - previousLiveShowMinutes;
    const dedicationChange = dedicationMinutes - previousDedicationMinutes;

    // Calculate changes
    const newUsersChange = newUsers - previousNewUsers;
    const engagedFansChange = engagedFans - previousEngagedFans;

    return res.json({
      success: true,
      message: 'Dashboard overview retrieved successfully',
      data: {
        // Summary Cards
        summary: {
          newUsers: {
            count: newUsers,
            change: newUsersChange
          },
          engagedFans: {
            count: engagedFans,
            change: engagedFansChange
          }
        },
        // Revenue Insights
        revenue: {
          totalRevenue: totalRevenue,
          escrowAmount: escrowAmount,
          serviceBreakdown: {
            videoCall: serviceRevenueMap.videoCall || 0,
            liveShow: serviceRevenueMap.liveShow || 0,
            dedication: serviceRevenueMap.dedication || 0,
            becomeStar: serviceRevenueMap.becomeStar || 0
          }
        },
        // Active Users per Country
        activeUsersByCountry: {
          totalActiveUsers: totalActiveUsers,
          onlineUsers: onlineUsers,
          countries: countryData.map(country => ({
            name: country._id,
            stars: country.stars,
            fans: country.fans
          }))
        },
        // Device Type Repartition
        deviceType: {
          android: {
            count: androidUsers,
            change: androidChange
          },
          ios: {
            count: iosUsers,
            change: iosChange
          }
        },
        // Reported Users
        reportedUsers: {
          stars: reportedStarsCount,
          fans: reportedFansCount
        },
        // Cost Evaluation
        costEvaluation: {
          videoCall: {
            minutes: videoCallMinutes,
            change: videoCallChange
          },
          liveShow: {
            minutes: liveShowMinutes,
            change: liveShowChange
          },
          dedication: {
            minutes: dedicationMinutes,
            change: dedicationChange
          }
        },
        // Service Insights
        serviceInsights: {
          videoCall: {
            completed: videoCallInsights.completed,
            approved: videoCallInsights.approved,
            cancelled: videoCallInsights.cancelled,
            pending: videoCallInsights.pending,
            uniqueFansAndStars: videoCallInsights.uniqueFansAndStars,
            netRevenue: videoCallInsights.netRevenue
          },
          liveShow: {
            completed: liveShowInsights.completed,
            approved: liveShowInsights.approved,
            cancelled: liveShowInsights.cancelled,
            pending: liveShowInsights.pending,
            uniqueFansAndStars: liveShowInsights.uniqueFansAndStars,
            netRevenue: liveShowInsights.netRevenue
          },
          dedication: {
            completed: dedicationInsights.completed,
            approved: dedicationInsights.approved,
            cancelled: dedicationInsights.cancelled,
            pending: dedicationInsights.pending,
            uniqueFansAndStars: dedicationInsights.uniqueFansAndStars,
            netRevenue: dedicationInsights.netRevenue
          },
          becomeStar: {
            completed: becomeStarInsights.completed,
            approved: becomeStarInsights.approved,
            cancelled: becomeStarInsights.cancelled,
            pending: becomeStarInsights.pending,
            uniqueFansAndStars: becomeStarInsights.uniqueFansAndStars,
            netRevenue: becomeStarInsights.netRevenue
          }
        }
      }
    });

  } catch (err) {
    console.error('Dashboard overview error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dashboard overview',
      error: err.message
    });
  }
};

// Top 50 Stars List with Filters (Income, Video Calls, Dedications)
export const getTopStarsList = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { filter = 'income' } = req.query;

    // Validate filter
    // income      -> total revenue from all services
    // videoCall   -> revenue from appointment (video call) payments only
    // dedication  -> revenue from dedication payments only
    // liveShow    -> revenue from live show payments only
    const validFilters = ['income', 'videoCall', 'dedication', 'liveShow'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid filter. Must be one of: ${validFilters.join(', ')}`
      });
    }

    // Helper function to check if user is online (logged in within last 15 minutes)
    const isUserOnline = (lastLoginAt) => {
      if (!lastLoginAt) return false;
      const now = new Date();
      const lastLogin = new Date(lastLoginAt);
      const diffInMinutes = (now - lastLogin) / (1000 * 60);
      return diffInMinutes <= 15;
    };

    // Get all stars with all fields
    const stars = await User.find({
      role: 'star',
      isDeleted: { $ne: true }
    })
      .populate('profession', 'name')
      .lean();

    // Get star IDs
    const starIds = stars.map(star => star._id);

    // Calculate revenue per service type for each star (from completed transactions)
    // We consider the following transaction types:
    // - appointment_payment                         -> Video Call revenue
    // - dedication_request_payment, dedication_payment -> Dedication revenue
    // - live_show_attendance_payment, live_show_hosting_payment -> Live Show revenue
    const revenueData = await Transaction.aggregate([
      {
        $match: {
          receiverId: { $in: starIds },
          status: 'completed',
          type: {
            $in: [
              'appointment_payment',
              'dedication_request_payment',
              'dedication_payment',
              'live_show_attendance_payment',
              'live_show_hosting_payment'
            ]
          }
        }
      },
      {
        $group: {
          _id: '$receiverId',
          videoCallRevenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'appointment_payment'] }, '$amount', 0]
            }
          },
          dedicationRevenue: {
            $sum: {
              $cond: [
                { $in: ['$type', ['dedication_request_payment', 'dedication_payment']] },
                '$amount',
                0
              ]
            }
          },
          liveShowRevenue: {
            $sum: {
              $cond: [
                { $in: ['$type', ['live_show_attendance_payment', 'live_show_hosting_payment']] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);

    // Count completed video calls (appointments) for each star
    const videoCallsData = await Appointment.aggregate([
      {
        $match: {
          starId: { $in: starIds },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$starId',
          videoCallsCount: { $sum: 1 }
        }
      }
    ]);

    // Count completed dedications for each star
    const dedicationsData = await DedicationRequest.aggregate([
      {
        $match: {
          starId: { $in: starIds },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$starId',
          dedicationsCount: { $sum: 1 }
        }
      }
    ]);

    // Create maps for quick lookup
    const videoCallRevenueMap = new Map();
    const dedicationRevenueMap = new Map();
    const liveShowRevenueMap = new Map();
    revenueData.forEach(item => {
      const id = item._id.toString();
      videoCallRevenueMap.set(id, item.videoCallRevenue || 0);
      dedicationRevenueMap.set(id, item.dedicationRevenue || 0);
      liveShowRevenueMap.set(id, item.liveShowRevenue || 0);
    });

    const videoCallsMap = new Map();
    videoCallsData.forEach(item => {
      videoCallsMap.set(item._id.toString(), item.videoCallsCount);
    });

    const dedicationsMap = new Map();
    dedicationsData.forEach(item => {
      dedicationsMap.set(item._id.toString(), item.dedicationsCount);
    });

    // Combine data for each star with all user fields - Top Stars List Response Model
    const starsWithStats = stars.map(star => {
      const starIdStr = star._id.toString();
      return {
        // Basic Info
        id: star._id,
        baroniId: star.baroniId,
        name: star.name,
        pseudo: star.pseudo,
        profilePic: star.profilePic,
        
        // Contact & Communication
        contact: star.contact || null,
        email: star.email || null,
        
        // Location & Profile
        country: star.country || null,
        location: star.location || null,
        about: star.about || null,
        preferredLanguage: star.preferredLanguage || null,
        preferredCurrency: star.preferredCurrency || null,
        
        // Profession
        profession: star.profession ? {
          id: star.profession._id || star.profession.id || null,
          name: star.profession.name || ''
        } : null,
        
        // Role & Status
        role: star.role,
        availableForBookings: star.availableForBookings !== undefined ? star.availableForBookings : true,
        appNotification: star.appNotification !== undefined ? star.appNotification : true,
        hidden: star.hidden !== undefined ? star.hidden : false,
        
        // Device & Technical
        deviceType: star.deviceType || null,
        isDev: star.isDev !== undefined ? star.isDev : false,
        
        // Financial
        coinBalance: star.coinBalance || 0,
        
        // Features & Settings
        feature_star: star.feature_star !== undefined ? star.feature_star : false,
        isAddedInFeatureStar: Boolean(star.feature_star),
        isOnlineStar: isUserOnline(star.lastLoginAt),
        
        // Ratings & Reviews
        averageRating: star.averageRating || 0,
        totalReviews: star.totalReviews || 0,
        
        // Payment Status
        paymentStatus: star.paymentStatus || null,
        
        // Other Fields
        favorites: Array.isArray(star.favorites) ? star.favorites : [],
        providers: star.providers || null,
        profileImpressions: star.profileImpressions || 0,
        sessionVersion: star.sessionVersion || 0,
        agoraKey: star.agoraKey || null,
        isDeleted: star.isDeleted !== undefined ? star.isDeleted : false,
        deletedAt: star.deletedAt || null,
        
        // Timestamps
        createdAt: star.createdAt,
        updatedAt: star.updatedAt || star.createdAt,
        lastLoginAt: star.lastLoginAt || null,
        
        // Stats (Performance Metrics)
        // Revenue-based metrics
        videoCallRevenue: videoCallRevenueMap.get(starIdStr) || 0,
        dedicationRevenue: dedicationRevenueMap.get(starIdStr) || 0,
        liveShowRevenue: liveShowRevenueMap.get(starIdStr) || 0,
        // Total income = sum of all service revenues
        totalIncome:
          (videoCallRevenueMap.get(starIdStr) || 0) +
          (dedicationRevenueMap.get(starIdStr) || 0) +
          (liveShowRevenueMap.get(starIdStr) || 0),
        // Legacy count-based metrics (kept for reference / potential UI use)
        videoCallsCount: videoCallsMap.get(starIdStr) || 0,
        dedicationsCount: dedicationsMap.get(starIdStr) || 0
      };
    });

    // Sort and filter based on filter
    let filteredStars = starsWithStats;

    switch (filter) {
      case 'videoCall':
        // Only stars who have video call revenue, sorted high -> low
        filteredStars = starsWithStats
          .filter(star => star.videoCallRevenue > 0)
          .sort((a, b) => b.videoCallRevenue - a.videoCallRevenue);
        break;
      case 'dedication':
        // Only stars who have dedication revenue, sorted high -> low
        filteredStars = starsWithStats
          .filter(star => star.dedicationRevenue > 0)
          .sort((a, b) => b.dedicationRevenue - a.dedicationRevenue);
        break;
      case 'liveShow':
        // Only stars who have live show revenue, sorted high -> low
        filteredStars = starsWithStats
          .filter(star => star.liveShowRevenue > 0)
          .sort((a, b) => b.liveShowRevenue - a.liveShowRevenue);
        break;
      case 'income':
      default:
        // All stars, sorted by total revenue (all services)
        filteredStars = starsWithStats.sort((a, b) => b.totalIncome - a.totalIncome);
        break;
    }

    // Get top 50
    const top50Stars = filteredStars.slice(0, 50);

    return res.json({
      success: true,
      message: 'Top 50 stars retrieved successfully',
      data: {
        filter,
        totalStars: stars.length,
        stars: top50Stars
      }
    });

  } catch (err) {
    console.error('Top stars list error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get top stars list',
      error: err.message
    });
  }
};