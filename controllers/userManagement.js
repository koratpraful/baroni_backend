import User from '../models/User.js';
import Review from '../models/Review.js';
import Service from '../models/Service.js';
import Dedication from '../models/Dedication.js';
import DedicationSample from '../models/DedicationSample.js';
import ReportUser from '../models/ReportUser.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';
import Availability from '../models/Availability.js';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

// Get all users with filtering, searching, and pagination
export const getAllUsers = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      country = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter object
    const filter = {
      isDeleted: { $ne: true }
    };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { pseudo: { $regex: search, $options: 'i' } },
        { baroniId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } }
      ];
    }

    // Add role filter
    if (role && role !== 'all') {
      filter.role = role;
    }

    // Add country filter
    if (country && country !== 'all') {
      filter.country = country;
    }

    // Add status filter (based on availableForBookings and hidden)
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.availableForBookings = true;
        filter.hidden = false;
      } else if (status === 'blocked') {
        filter.$or = [
          { availableForBookings: false },
          { hidden: true }
        ];
      }
    }

    // Get users with pagination
    const users = await User.find(filter)
      .populate('profession', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalUsers = await User.countDocuments(filter);

    // Get unique countries for filter options
    const countries = await User.distinct('country', {
      country: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    });

    // Get role counts
    const roleCounts = await User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const roleStats = roleCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get status counts
    const activeCount = await User.countDocuments({
      availableForBookings: true,
      hidden: false,
      isDeleted: { $ne: true }
    });

    const blockedCount = await User.countDocuments({
      $or: [
        { availableForBookings: false },
        { hidden: true }
      ],
      isDeleted: { $ne: true }
    });

    return res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: users.map(user => ({
          id: user._id,
          baroniId: user.baroniId,
          name: user.name,
          pseudo: user.pseudo,
          email: user.email ?? null,
          contact: user.contact,
          profilePic: user.profilePic,
          role: user.role,
          country: user.country,
          profession: user.profession ? {
            id: user.profession._id || user.profession.id || null,
            name: user.profession.name || ''
          } : null,
          availableForBookings: user.availableForBookings,
          hidden: user.hidden,
          status: user.availableForBookings && !user.hidden ? 'active' : 'blocked',
          coinBalance: user.coinBalance,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          pages: Math.ceil(totalUsers / parseInt(limit))
        },
        filters: {
          countries: countries.sort(),
          roles: ['star', 'fan'],
          statuses: ['active', 'blocked']
        },
        stats: {
          roles: roleStats,
          status: {
            active: activeCount,
            blocked: blockedCount
          }
        }
      }
    });

  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
};

// Get user details by ID
export const getUserDetails = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId)
      .populate('profession', 'name')
      .populate('favorites', 'name pseudo profilePic role')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's services (Video call charges)
    const servicesRaw = await Service.find({ userId: user._id }).lean();
    const services = servicesRaw.map(s => ({
      id: s._id,
      type: s.type,
      price: s.price,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    // Get user's dedications (Dedication charges)
    const dedicationsRaw = await Dedication.find({ userId: user._id }).lean();
    const dedications = dedicationsRaw.map(d => ({
      id: d._id,
      type: d.type,
      price: d.price,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));

    // Get user's dedication samples
    const dedicationSamplesRaw = await DedicationSample.find({ userId: user._id }).lean();
    const dedicationSamples = dedicationSamplesRaw.map(s => ({
      id: s._id,
      type: s.type,
      video: s.video,
      description: s.description,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    // Get user's reviews (if star)
    let reviews = [];
    if (user.role === 'star') {
      reviews = await Review.find({ starId: user._id })
        .populate('reviewerId', 'name pseudo profilePic')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // Get user's reports (both as reporter and reported)
    const reportsAsReporter = await ReportUser.find({ reporterId: user._id })
      .populate('reportedUserId', 'name pseudo role')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const reportsAsReported = await ReportUser.find({ reportedUserId: user._id })
      .populate('reporterId', 'name pseudo role')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get user's transaction stats
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { payerId: user._id },
            { receiverId: user._id }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$payerId', user._id] }, '$amount', 0]
            }
          },
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ['$receiverId', user._id] }, '$amount', 0]
            }
          },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const stats = transactionStats[0] || {
      totalSpent: 0,
      totalEarned: 0,
      transactionCount: 0
    };

    // Star-only overview/cancelled metrics (last 30 days)
    let starInsights = null;
    let fanInsights = null;
    if (user.role === 'star') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
        Appointment.countDocuments({
          starId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShow.countDocuments({
          starId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        Transaction.distinct('payerId', {
          receiverId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }).then(users => users.length)
      ]);

      const [
        cancelledVideoCalls,
        cancelledDedications,
        cancelledLiveShows,
        rejectedByStarCalls,
        rejectedByStarDedications
      ] = await Promise.all([
        Appointment.countDocuments({
          starId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShow.countDocuments({
          starId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        Appointment.countDocuments({
          starId: user._id,
          status: 'rejected',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          status: 'rejected',
          createdAt: { $gte: thirtyDaysAgo }
        })
      ]);

      starInsights = {
        overview: {
          videoCalls,
          dedications,
          liveShows,
          engagedUsers
        },
        cancelled: {
          videoCalls: cancelledVideoCalls,
          dedications: cancelledDedications,
          liveShows: cancelledLiveShows,
          rejectedByStar: rejectedByStarCalls + rejectedByStarDedications
        }
      };
    }

    // Fan overview/cancelled metrics (last 30 days)
    if (user.role === 'fan') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [videoCalls, dedications, liveShows, engagedStars] = await Promise.all([
        Appointment.countDocuments({
          fanId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          fanId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShowAttendance.countDocuments({
          fanId: user._id,
          createdAt: { $gte: thirtyDaysAgo },
          status: 'completed'
        }),
        Transaction.distinct('receiverId', {
          payerId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }).then(ids => ids.length)
      ]);

      const [
        cancelledVideoCalls,
        cancelledDedications,
        cancelledLiveShows,
        rejectedByStarCalls,
        rejectedByStarDedications
      ] = await Promise.all([
        Appointment.countDocuments({
          fanId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          fanId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShowAttendance.countDocuments({
          fanId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        Appointment.countDocuments({
          fanId: user._id,
          status: 'rejected',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          fanId: user._id,
          status: 'rejected',
          createdAt: { $gte: thirtyDaysAgo }
        })
      ]);

      fanInsights = {
        overview: {
          videoCalls,
          dedications,
          liveShows,
          engagedStars
        },
        cancelled: {
          videoCalls: cancelledVideoCalls,
          dedications: cancelledDedications,
          liveShows: cancelledLiveShows,
          rejectedByStar: rejectedByStarCalls + rejectedByStarDedications
        }
      };
    }

    // Helper function to get country flag emoji from country name or code
    const getCountryFlag = (country) => {
      if (!country) return null;
      
      const countryToFlag = {
        'India': '🇮🇳', 'भारत': '🇮🇳', 'Bharat': '🇮🇳', 'IN': '🇮🇳',
        'USA': '🇺🇸', 'United States': '🇺🇸', 'America': '🇺🇸', 'US': '🇺🇸',
        'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Britain': '🇬🇧', 'England': '🇬🇧', 'GB': '🇬🇧',
        'Canada': '🇨🇦', 'CA': '🇨🇦',
        'Australia': '🇦🇺', 'AU': '🇦🇺',
        'France': '🇫🇷', 'FR': '🇫🇷',
        'Germany': '🇩🇪', 'DE': '🇩🇪',
        'Japan': '🇯🇵', 'JP': '🇯🇵',
        'China': '🇨🇳', 'CN': '🇨🇳',
        'Brazil': '🇧🇷', 'BR': '🇧🇷',
        'Mali': '🇲🇱', 'ML': '🇲🇱',
        'Spain': '🇪🇸', 'ES': '🇪🇸',
        'Italy': '🇮🇹', 'IT': '🇮🇹',
        'Russia': '🇷🇺', 'RU': '🇷🇺',
        'South Korea': '🇰🇷', 'KR': '🇰🇷',
        'Mexico': '🇲🇽', 'MX': '🇲🇽',
        'Argentina': '🇦🇷', 'AR': '🇦🇷',
        'South Africa': '🇿🇦', 'ZA': '🇿🇦',
        'Nigeria': '🇳🇬', 'NG': '🇳🇬',
        'Egypt': '🇪🇬', 'EG': '🇪🇬',
        'Turkey': '🇹🇷', 'TR': '🇹🇷',
        'Saudi Arabia': '🇸🇦', 'SA': '🇸🇦',
        'UAE': '🇦🇪', 'United Arab Emirates': '🇦🇪', 'AE': '🇦🇪',
        'Singapore': '🇸🇬', 'SG': '🇸🇬',
        'Thailand': '🇹🇭', 'TH': '🇹🇭',
        'Indonesia': '🇮🇩', 'ID': '🇮🇩',
        'Philippines': '🇵🇭', 'PH': '🇵🇭',
        'Vietnam': '🇻🇳', 'VN': '🇻🇳',
        'Malaysia': '🇲🇾', 'MY': '🇲🇾'
      };
      
      if (countryToFlag[country]) return countryToFlag[country];
      const normalizedCountry = country.trim();
      for (const [key, flag] of Object.entries(countryToFlag)) {
        if (key.toLowerCase() === normalizedCountry.toLowerCase()) {
          return flag;
        }
      }
      return null;
    };

    // Helper function to check if user is online (logged in within last 15 minutes)
    const isUserOnline = (lastLoginAt) => {
      if (!lastLoginAt) return false;
      const now = new Date();
      const lastLogin = new Date(lastLoginAt);
      const diffInMinutes = (now - lastLogin) / (1000 * 60);
      return diffInMinutes <= 15;
    };

    return res.json({
      success: true,
      message: 'User details retrieved successfully',
      data: {
        user: {
          id: user._id,
          baroniId: user.baroniId,
          contact: user.contact,
          email: user.email ?? null,
          password: user.password ? '[HIDDEN]' : null,
          coinBalance: user.coinBalance,
          name: user.name,
          pseudo: user.pseudo,
          profilePic: user.profilePic,
          preferredLanguage: user.preferredLanguage || null,
          preferredCurrency: user.preferredCurrency,
          country: user.country,
          countryFlag: getCountryFlag(user.country),
          about: user.about,
          location: user.location,
          profession: user.profession ? {
            id: user.profession._id || user.profession.id || null,
            name: user.profession.name || ''
          } : null,
          role: user.role,
          availableForBookings: user.availableForBookings,
          appNotification: user.appNotification,
          hidden: user.hidden,
          fcmToken: user.fcmToken,
          apnsToken: user.apnsToken,
          voipToken: user.voipToken,
          deviceType: user.deviceType,
          isDev: user.isDev,
          favorites: user.favorites,
          isDeleted: user.isDeleted,
          deletedAt: user.deletedAt,
          providers: user.providers,
          passwordResetToken: user.passwordResetToken ? '[HIDDEN]' : null,
          passwordResetExpires: user.passwordResetExpires,
          profileImpressions: user.profileImpressions,
          sessionVersion: user.sessionVersion,
          agoraKey: user.agoraKey,
          chatToken: user.chatToken ? '[HIDDEN]' : null,
          paymentStatus: user.paymentStatus,
          averageRating: user.averageRating,
          totalReviews: user.totalReviews,
          feature_star: user.feature_star,
          isAddedInFeatureStar: user.feature_star || false,
          isOnlineStar: user.role === 'star' ? isUserOnline(user.lastLoginAt) : false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        },
        services,
        dedications,
        dedicationSamples,
        reviews: reviews.map(review => ({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewer: {
            id: review.reviewerId._id,
            name: review.reviewerId.name,
            pseudo: review.reviewerId.pseudo,
            profilePic: review.reviewerId.profilePic
          },
          reviewType: review.reviewType,
          createdAt: review.createdAt
        })),
        reports: {
          asReporter: reportsAsReporter.map(report => ({
            id: report._id,
            reportedUser: {
              id: report.reportedUserId._id,
              name: report.reportedUserId.name,
              pseudo: report.reportedUserId.pseudo,
              role: report.reportedUserId.role
            },
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt
          })),
          asReported: reportsAsReported.map(report => ({
            id: report._id,
            reporter: {
              id: report.reporterId._id,
              name: report.reporterId.name,
              pseudo: report.reporterId.pseudo,
              role: report.reporterId.role
            },
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt
          }))
        },
        stats,
        starInsights,
        fanInsights
      }
    });

  } catch (err) {
    console.error('Get user details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user details'
    });
  }
};

// Unified profile fetch for admin (works for both star and fan IDs)
export const getManagementUserProfile = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(id)
      .populate('profession', 'name')
      .populate('favorites', 'name pseudo profilePic role')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Helper function to check if user is online (logged in within last 15 minutes)
    const isUserOnline = (lastLoginAt) => {
      if (!lastLoginAt) return false;
      const now = new Date();
      const lastLogin = new Date(lastLoginAt);
      const diffInMinutes = (now - lastLogin) / (1000 * 60);
      return diffInMinutes <= 15; // Consider online if logged in within last 15 minutes
    };

    // Shared data
    const services = await Service.find({ userId: user._id }).lean();
    const dedications = await Dedication.find({ userId: user._id }).lean();
    const dedicationSamples = await DedicationSample.find({ userId: user._id }).lean();

    // Transaction stats (covers both fan and star money flow)
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { payerId: user._id },
            { receiverId: user._id }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$payerId', user._id] }, '$amount', 0]
            }
          },
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ['$receiverId', user._id] }, '$amount', 0]
            }
          },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const stats = transactionStats[0] || {
      totalSpent: 0,
      totalEarned: 0,
      transactionCount: 0
    };

    // Reports (as reporter and as reported user)
    const [reportsAsReporter, reportsAsReported] = await Promise.all([
      ReportUser.find({ reporterId: user._id })
        .populate('reportedUserId', 'name pseudo role')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      ReportUser.find({ reportedUserId: user._id })
        .populate('reporterId', 'name pseudo role')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    // Star-only insights
    let reviews = [];
    let starInsights = null;

    if (user.role === 'star') {
      reviews = await Review.find({ starId: user._id })
        .populate('reviewerId', 'name pseudo profilePic')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const averageRating = reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
        Appointment.countDocuments({
          starId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShow.countDocuments({
          starId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        Transaction.distinct('payerId', {
          receiverId: user._id,
          createdAt: { $gte: thirtyDaysAgo }
        }).then(users => users.length)
      ]);

      const [cancelledVideoCalls, cancelledDedications, cancelledLiveShows, rejectedByStarCalls, rejectedByStarDedications] = await Promise.all([
        Appointment.countDocuments({
          starId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShow.countDocuments({
          starId: user._id,
          status: 'cancelled',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        Appointment.countDocuments({
          starId: user._id,
          status: 'rejected',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          status: 'rejected',
          createdAt: { $gte: thirtyDaysAgo }
        })
      ]);

      const revenueStats = await Transaction.aggregate([
        {
          $match: {
            receiverId: user._id,
            createdAt: { $gte: thirtyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
              }
            },
            escrowAmount: {
              $sum: {
                $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
              }
            }
          }
        }
      ]);

      const hasAvailableTimeSlots = await Availability.findOne({
        userId: user._id,
        'timeSlots.status': 'available'
      });

      starInsights = {
        rating: {
          average: Math.round(averageRating * 10) / 10,
          totalReviews: reviews.length
        },
        overview: {
          videoCalls,
          dedications,
          liveShows,
          engagedUsers
        },
        cancelled: {
          videoCalls: cancelledVideoCalls,
          dedications: cancelledDedications,
          liveShows: cancelledLiveShows,
          rejectedByStar: rejectedByStarCalls + rejectedByStarDedications
        },
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          escrow: revenueStats[0]?.escrowAmount || 0
        },
        availability: {
          availableForBookings: user.availableForBookings && Boolean(hasAvailableTimeSlots),
          hasAvailableSlots: Boolean(hasAvailableTimeSlots)
        }
      };
    }

    return res.json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user: {
          id: user._id,
          baroniId: user.baroniId,
          contact: user.contact,
          email: user.email,
          coinBalance: user.coinBalance,
          name: user.name,
          pseudo: user.pseudo,
          profilePic: user.profilePic,
          preferredLanguage: user.preferredLanguage,
          preferredCurrency: user.preferredCurrency,
          country: user.country,
          about: user.about,
          location: user.location,
          profession: user.profession ? {
            id: user.profession._id || user.profession.id || null,
            name: user.profession.name || ''
          } : null,
          role: user.role,
          availableForBookings: user.availableForBookings,
          appNotification: user.appNotification,
          hidden: user.hidden,
          deviceType: user.deviceType,
          isDev: user.isDev,
          favorites: user.favorites,
          isDeleted: user.isDeleted,
          deletedAt: user.deletedAt,
          providers: user.providers,
          profileImpressions: user.profileImpressions,
          sessionVersion: user.sessionVersion,
          agoraKey: user.agoraKey,
          paymentStatus: user.paymentStatus,
          averageRating: user.averageRating,
          totalReviews: user.totalReviews,
          feature_star: user.feature_star,
          isAddedInFeatureStar: user.feature_star || false,
          isOnlineStar: user.role === 'star' ? isUserOnline(user.lastLoginAt) : false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        },
        services,
        dedications,
        dedicationSamples,
        reviews: reviews.map(review => ({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewer: review.reviewerId ? {
            id: review.reviewerId._id,
            name: review.reviewerId.name,
            pseudo: review.reviewerId.pseudo,
            profilePic: review.reviewerId.profilePic
          } : null,
          reviewType: review.reviewType,
          createdAt: review.createdAt
        })),
        reports: {
          asReporter: reportsAsReporter.map(report => ({
            id: report._id,
            reportedUser: report.reportedUserId ? {
              id: report.reportedUserId._id,
              name: report.reportedUserId.name,
              pseudo: report.reportedUserId.pseudo,
              role: report.reportedUserId.role
            } : null,
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt
          })),
          asReported: reportsAsReported.map(report => ({
            id: report._id,
            reporter: report.reporterId ? {
              id: report.reporterId._id,
              name: report.reporterId.name,
              pseudo: report.reporterId.pseudo,
              role: report.reporterId.role
            } : null,
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt
          }))
        },
        stats,
        starInsights
      }
    });

  } catch (err) {
    console.error('Get management user profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
};

// Overview (7/15/30 day) for fan or star by ID (admin)
export const getManagementUserOverview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = errors.array()[0]?.msg || 'Validation failed';
      return res.status(400).json({ success: false, message: errorMessage });
    }

    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    const days = parseInt(req.query.period || '30', 10);
    const allowed = [7, 15, 30];
    const periodDays = allowed.includes(days) ? days : 30;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(id).select('role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    let starOverview = null;
    let starCancelled = null;
    let fanOverview = null;
    let fanCancelled = null;

    if (user.role === 'star') {
      const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
        Appointment.countDocuments({ starId: user._id, createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ starId: user._id, createdAt: { $gte: since } }),
        LiveShow.countDocuments({ starId: user._id, createdAt: { $gte: since } }),
        Transaction.distinct('payerId', { receiverId: user._id, createdAt: { $gte: since } }).then(u => u.length)
      ]);

      const [
        cancelledVideoCalls,
        cancelledDedications,
        cancelledLiveShows,
        rejectedByStarCalls,
        rejectedByStarDedications
      ] = await Promise.all([
        Appointment.countDocuments({ starId: user._id, status: 'cancelled', createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ starId: user._id, status: 'cancelled', createdAt: { $gte: since } }),
        LiveShow.countDocuments({ starId: user._id, status: 'cancelled', createdAt: { $gte: since } }),
        Appointment.countDocuments({ starId: user._id, status: 'rejected', createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ starId: user._id, status: 'rejected', createdAt: { $gte: since } })
      ]);

      starOverview = { videoCalls, dedications, liveShows, engagedUsers };
      starCancelled = {
        videoCalls: cancelledVideoCalls,
        dedications: cancelledDedications,
        liveShows: cancelledLiveShows,
        rejectedByStar: rejectedByStarCalls + rejectedByStarDedications
      };
    }

    if (user.role === 'fan') {
      const [videoCalls, dedications, liveShows, engagedStars] = await Promise.all([
        Appointment.countDocuments({ fanId: user._id, createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ fanId: user._id, createdAt: { $gte: since } }),
        LiveShowAttendance.countDocuments({ fanId: user._id, status: 'completed', createdAt: { $gte: since } }),
        Transaction.distinct('receiverId', { payerId: user._id, createdAt: { $gte: since } }).then(u => u.length)
      ]);

      const [
        cancelledVideoCalls,
        cancelledDedications,
        cancelledLiveShows,
        rejectedByStarCalls,
        rejectedByStarDedications
      ] = await Promise.all([
        Appointment.countDocuments({ fanId: user._id, status: 'cancelled', createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ fanId: user._id, status: 'cancelled', createdAt: { $gte: since } }),
        LiveShowAttendance.countDocuments({ fanId: user._id, status: 'cancelled', createdAt: { $gte: since } }),
        Appointment.countDocuments({ fanId: user._id, status: 'rejected', createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ fanId: user._id, status: 'rejected', createdAt: { $gte: since } })
      ]);

      fanOverview = { videoCalls, dedications, liveShows, engagedStars };
      fanCancelled = {
        videoCalls: cancelledVideoCalls,
        dedications: cancelledDedications,
        liveShows: cancelledLiveShows,
        rejectedByStar: rejectedByStarCalls + rejectedByStarDedications
      };
    }

    const insights =
      user.role === 'star'
        ? { overview: starOverview, cancelled: starCancelled }
        : user.role === 'fan'
          ? { overview: fanOverview, cancelled: fanCancelled }
          : null;

    return res.json({
      success: true,
      message: 'User overview retrieved successfully',
      data: {
        role: user.role,
        periodDays,
        insights
      }
    });
  } catch (err) {
    console.error('Get management user overview error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user overview'
    });
  }
};

// Update profile for fan or star (admin only) - Comprehensive update including services and samples
export const updateManagementUserProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0]?.msg || 'Validation failed'
      });
    }

    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    const {
      // Basic profile fields
      name,
      pseudo,
      email,
      contact,
      profilePic,
      country,
      profession,
      category,
      about,
      location,
      preferredLanguage,
      // Toggle fields
      availableForBookings,
      hidden,
      appNotification,
      isVerified,
      feature_star,
      role,
      // Status field
      status,
      // Intro video
      introVideo,
      // Services management (for stars)
      services,
      // Dedication samples management (for stars)
      dedicationSamples,
      // Online status (for stars) - updates lastLoginAt
      isOnlineStar
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Email uniqueness check if changing email
    if (email !== undefined && email !== null && email !== '') {
      const normalizedEmail = email.toLowerCase();
      // Check if email is different (case-insensitive comparison)
      if (user.email?.toLowerCase() !== normalizedEmail) {
        const existing = await User.findOne({ 
          email: normalizedEmail, 
          _id: { $ne: id } 
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use'
          });
        }
        user.email = normalizedEmail;
      } else {
        // Even if same email, ensure it's stored in lowercase
        user.email = normalizedEmail;
      }
    }

    // Update basic profile fields
    if (name !== undefined) user.name = name;
    if (pseudo !== undefined) user.pseudo = pseudo;
    if (contact !== undefined) user.contact = contact;
    if (profilePic !== undefined) {
      // Allow empty string to clear profile picture
      user.profilePic = profilePic === '' || profilePic === null ? null : profilePic;
    }
    if (country !== undefined) user.country = country;
    // Support both profession and category (they refer to the same field)
    if (profession !== undefined) user.profession = profession;
    if (category !== undefined) user.profession = category;
    if (about !== undefined) {
      // Validate about field minimum length if provided (only for stars)
      if (user.role === 'star' && about !== null && about !== '' && typeof about === 'string') {
        const trimmedAbout = about.trim();
        if (trimmedAbout.length > 0 && trimmedAbout.length < 100) {
          return res.status(400).json({
            success: false,
            message: 'About field must be at least 100 characters if provided for stars'
          });
        }
        user.about = trimmedAbout;
      } else {
        // For fans, no minimum length requirement
        user.about = typeof about === 'string' ? about.trim() : about;
      }
    }
    if (location !== undefined) user.location = location;
    if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

    // Update toggle fields (available for both fan and star)
    if (availableForBookings !== undefined) user.availableForBookings = availableForBookings;
    if (hidden !== undefined) user.hidden = hidden;
    if (appNotification !== undefined) user.appNotification = appNotification;
    if (isVerified !== undefined) user.isVerified = isVerified;
    
    // Star-specific fields (only update if user is or becomes a star)
    if (feature_star !== undefined) {
      // Only allow feature_star for stars
      if (user.role === 'star' || (role !== undefined && role === 'star')) {
        user.feature_star = feature_star;
      }
      // Silently ignore for fans
    }

    // Update role (only if changing to star or fan, not admin)
    if (role !== undefined && ['star', 'fan'].includes(role)) {
      user.role = role;
    }

    // Update status (maps to availableForBookings and hidden)
    if (status !== undefined) {
      if (status === 'active') {
        user.availableForBookings = true;
        user.hidden = false;
      } else if (status === 'blocked' || status === 'inactive') {
        user.availableForBookings = false;
        user.hidden = true;
      }
    }

    // Update intro video (typically for stars, but allow for fans too)
    if (introVideo !== undefined) {
      // Allow empty string to remove intro video
      user.introVideo = introVideo === '' || introVideo === null ? null : introVideo;
    }

    // Handle isOnlineStar - updates lastLoginAt to make star appear online
    // Only works for stars
    if (isOnlineStar !== undefined && user.role === 'star') {
      if (isOnlineStar === true) {
        // Set lastLoginAt to current time to make star appear online
        user.lastLoginAt = new Date();
      } else if (isOnlineStar === false) {
        // Set lastLoginAt to 1 hour ago to make star appear offline
        user.lastLoginAt = new Date(Date.now() - 60 * 60 * 1000);
      }
    }

    // Save user first
    await user.save();

    // Handle services management (only for stars)
    // If services are provided for a fan, ignore them silently
    if (services !== undefined && Array.isArray(services) && services.length > 0) {
      if (user.role !== 'star') {
        // Silently ignore services for non-stars
      } else {
      for (const serviceOp of services) {
        if (!serviceOp || typeof serviceOp !== 'object') continue;

        const { operation, id: serviceId, type, price } = serviceOp;

        if (operation === 'add') {
          // Add new service
          if (!type || price === undefined) {
            return res.status(400).json({
              success: false,
              message: 'Service type and price are required for add operation'
            });
          }

          // Check if service already exists
          const existingService = await Service.findOne({ userId: user._id, type });
          if (existingService) {
            return res.status(409).json({
              success: false,
              message: `Service type "${type}" already exists for this star`
            });
          }

          const newService = new Service({
            type,
            price: parseFloat(price),
            userId: user._id
          });
          await newService.save();
        } else if (operation === 'update') {
          // Update existing service
          if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({
              success: false,
              message: 'Valid service ID is required for update operation'
            });
          }

          const service = await Service.findOne({ _id: serviceId, userId: user._id });
          if (!service) {
            return res.status(404).json({
              success: false,
              message: 'Service not found'
            });
          }

          if (type !== undefined) service.type = type;
          if (price !== undefined) service.price = parseFloat(price);
          await service.save();
        } else if (operation === 'delete') {
          // Delete service
          if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({
              success: false,
              message: 'Valid service ID is required for delete operation'
            });
          }

          const service = await Service.findOne({ _id: serviceId, userId: user._id });
          if (!service) {
            return res.status(404).json({
              success: false,
              message: 'Service not found'
            });
          }

          await Service.deleteOne({ _id: serviceId });
        }
      }
      }
    }

    // Handle dedication samples management (only for stars)
    // If samples are provided for a fan, ignore them silently
    if (dedicationSamples !== undefined && Array.isArray(dedicationSamples) && dedicationSamples.length > 0) {
      if (user.role !== 'star') {
        // Silently ignore samples for non-stars
      } else {
      for (const sampleOp of dedicationSamples) {
        if (!sampleOp || typeof sampleOp !== 'object') continue;

        const { operation, id: sampleId, type, video, description } = sampleOp;

        if (operation === 'add') {
          // Add new dedication sample
          if (!type || !video) {
            return res.status(400).json({
              success: false,
              message: 'Sample type and video are required for add operation'
            });
          }

          const newSample = new DedicationSample({
            type,
            video,
            description: description || '',
            userId: user._id
          });
          await newSample.save();
        } else if (operation === 'update') {
          // Update existing dedication sample
          if (!sampleId || !mongoose.Types.ObjectId.isValid(sampleId)) {
            return res.status(400).json({
              success: false,
              message: 'Valid sample ID is required for update operation'
            });
          }

          const sample = await DedicationSample.findOne({ _id: sampleId, userId: user._id });
          if (!sample) {
            return res.status(404).json({
              success: false,
              message: 'Dedication sample not found'
            });
          }

          if (type !== undefined) sample.type = type;
          if (video !== undefined) sample.video = video;
          if (description !== undefined) sample.description = description;
          await sample.save();
        } else if (operation === 'delete') {
          // Delete dedication sample
          if (!sampleId || !mongoose.Types.ObjectId.isValid(sampleId)) {
            return res.status(400).json({
              success: false,
              message: 'Valid sample ID is required for delete operation'
            });
          }

          const sample = await DedicationSample.findOne({ _id: sampleId, userId: user._id });
          if (!sample) {
            return res.status(404).json({
              success: false,
              message: 'Dedication sample not found'
            });
          }

          await DedicationSample.deleteOne({ _id: sampleId });
        }
      }
      }
    }

    // Populate profession for response
    await user.populate('profession', 'name');

    // Get updated services and samples for response (only for stars)
    let updatedServices = [];
    let updatedSamples = [];
    if (user.role === 'star') {
      updatedServices = await Service.find({ userId: user._id }).lean();
      updatedSamples = await DedicationSample.find({ userId: user._id }).lean();
    }

    // Helper function to check if user is online (logged in within last 15 minutes)
    const isUserOnline = (lastLoginAt) => {
      if (!lastLoginAt) return false;
      const now = new Date();
      const lastLogin = new Date(lastLoginAt);
      const diffInMinutes = (now - lastLogin) / (1000 * 60);
      return diffInMinutes <= 15; // Consider online if logged in within last 15 minutes
    };

    return res.json({
      success: true,
      message: 'User profile updated successfully',
      data: {
        user: {
          id: user._id,
          baroniId: user.baroniId,
          role: user.role,
          name: user.name,
          pseudo: user.pseudo,
          email: user.email,
          contact: user.contact,
          profilePic: user.profilePic,
          country: user.country,
          profession: user.profession ? {
            id: user.profession._id || user.profession.id || null,
            name: user.profession.name || ''
          } : null,
          about: user.about,
          location: user.location,
          preferredLanguage: user.preferredLanguage,
          availableForBookings: user.availableForBookings,
          hidden: user.hidden,
          appNotification: user.appNotification,
          isVerified: user.isVerified || false,
          feature_star: user.role === 'star' ? (user.feature_star || false) : undefined,
          isAddedInFeatureStar: user.role === 'star' ? (user.feature_star || false) : false,
          isOnlineStar: user.role === 'star' ? isUserOnline(user.lastLoginAt) : false,
          introVideo: user.introVideo || null,
          status: user.availableForBookings && !user.hidden ? 'active' : 'blocked',
          // Only include services and samples for stars
          ...(user.role === 'star' ? {
            services: updatedServices.map(s => ({
              id: s._id,
              type: s.type,
              price: s.price,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt
            })),
            dedicationSamples: updatedSamples.map(s => ({
              id: s._id,
              type: s.type,
              video: s.video,
              description: s.description,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt
            }))
          } : {}),
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (err) {
    console.error('Update management user profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user profile'
    });
  }
};

// Update user status (block/unblock)
export const updateUserStatus = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;
    const { action, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "block" or "unblock"'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user status
    if (action === 'block') {
      user.availableForBookings = false;
      user.hidden = true;
    } else {
      user.availableForBookings = true;
      user.hidden = false;
    }

    await user.save();

    return res.json({
      success: true,
      message: `User ${action}ed successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          pseudo: user.pseudo,
          status: user.availableForBookings && !user.hidden ? 'active' : 'blocked',
          availableForBookings: user.availableForBookings,
          hidden: user.hidden
        }
      }
    });

  } catch (err) {
    console.error('Update user status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!['fan', 'star'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Use "fan" or "star"'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // SECURITY FIX: Validate star promotion payment before role change
    if (role === 'star') {
      // Check if user has completed star promotion payment
      const Transaction = (await import('../models/Transaction.js')).default;
      const starPayment = await Transaction.findOne({
        payerId: userId,
        type: 'become_star_payment',
        status: 'completed'
      });
      
      if (!starPayment) {
        return res.status(400).json({
          success: false,
          message: 'User must complete star promotion payment before role change to star'
        });
      }
    }

    user.role = role;
    await user.save();

    return res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          pseudo: user.pseudo,
          role: user.role
        }
      }
    });

  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
};

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete user
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.availableForBookings = false;
    user.hidden = true;
    await user.save();

    return res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          pseudo: user.pseudo,
          deletedAt: user.deletedAt
        }
      }
    });

  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;

    // Get date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let startDate, endDate;
    switch (period) {
      case 'current_month':
        startDate = startOfMonth;
        endDate = endOfMonth;
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
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
        startDate = startOfMonth;
        endDate = endOfMonth;
    }

    // Get user statistics
    const totalUsers = await User.countDocuments({ isDeleted: { $ne: true } });
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    });

    const activeUsers = await User.countDocuments({
      availableForBookings: true,
      hidden: false,
      isDeleted: { $ne: true }
    });

    const blockedUsers = await User.countDocuments({
      $or: [
        { availableForBookings: false },
        { hidden: true }
      ],
      isDeleted: { $ne: true }
    });

    const starsCount = await User.countDocuments({
      role: 'star',
      isDeleted: { $ne: true }
    });

    const fansCount = await User.countDocuments({
      role: 'fan',
      isDeleted: { $ne: true }
    });

    // Get users by country
    const usersByCountry = await User.aggregate([
      {
        $match: {
          country: { $exists: true, $ne: null },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 },
          stars: {
            $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
          },
          fans: {
            $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get device statistics
    const deviceStats = await User.aggregate([
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
    ]);

    return res.json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: {
        overview: {
          totalUsers,
          newUsers,
          activeUsers,
          blockedUsers,
          starsCount,
          fansCount
        },
        usersByCountry: usersByCountry.map(country => ({
          country: country._id,
          total: country.count,
          stars: country.stars,
          fans: country.fans
        })),
        deviceStats: deviceStats.map(device => ({
          device: device._id,
          count: device.count
        })),
        period: {
          startDate,
          endDate,
          type: period
        }
      }
    });

  } catch (err) {
    console.error('Get user stats error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
};
