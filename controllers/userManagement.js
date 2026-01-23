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
      } else if (status === 'reported') {
        // Get all reported user IDs
        const reportedUserIds = await ReportUser.distinct('reportedUserId');
        if (reportedUserIds.length === 0) {
          // No reported users, return empty result
          return res.json({
            success: true,
            message: 'Users retrieved successfully',
            data: {
              users: [],
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0,
                pages: 0
              },
              filters: {
                countries: [],
                roles: ['star', 'fan'],
                statuses: ['active', 'blocked', 'reported']
              },
              stats: {
                roles: {},
                status: {
                  active: 0,
                  blocked: 0,
                  reported: 0
                }
              }
            }
          });
        }
        // Filter to only reported users
        // If there's already a $or filter from search, we need to combine them
        if (filter.$or) {
          // Keep the $or for search, but also ensure user is in reported list
          const originalOr = filter.$or;
          delete filter.$or;
          filter.$and = [
            { $or: originalOr },
            { _id: { $in: reportedUserIds } }
          ];
        } else {
          filter._id = { $in: reportedUserIds };
        }
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

    // Get reported users count
    const reportedUserIds = await ReportUser.distinct('reportedUserId');
    const reportedCount = reportedUserIds.length > 0 
      ? await User.countDocuments({ 
          _id: { $in: reportedUserIds },
          isDeleted: { $ne: true }
        })
      : 0;

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
          statuses: ['active', 'blocked', 'reported']
        },
        stats: {
          roles: roleStats,
          status: {
            active: activeCount,
            blocked: blockedCount,
            reported: reportedCount
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
    const videoCallServices = servicesRaw.map(s => ({
      id: s._id,
      type: s.type,
      price: s.price,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    // Get user's dedications (Dedication charges)
    const dedicationsRaw = await Dedication.find({ userId: user._id }).lean();
    const dedicationServices = dedicationsRaw.map(d => ({
      id: d._id,
      type: d.type,
      price: d.price,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));

    // Merge dedications into services array
    const services = [...videoCallServices, ...dedicationServices];

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

      // Overview should count COMPLETED items, not all items
      const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
        Appointment.countDocuments({
          starId: user._id,
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        DedicationRequest.countDocuments({
          starId: user._id,
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        LiveShow.countDocuments({
          starId: user._id,
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo }
        }),
        // Engaged users: unique fans who have completed transactions with this star
        Transaction.distinct('payerId', {
          receiverId: user._id,
          status: 'completed',
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

    // Get availability data for stars (similar to getStarProfile)
    let filteredAvailability = [];
    if (user.role === 'star') {
      try {
        // Get star's country for timezone-aware date calculation
        const { getCountryTimezoneOffset, convertLocalToUTC } = await import('../utils/timezoneHelper.js');
        const starCountry = user.country || null;

        // Helper function to get current date in star's country timezone
        const getCurrentDateString = () => {
          if (!starCountry) {
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          
          try {
            const offsetHours = getCountryTimezoneOffset(starCountry);
            const offsetMs = offsetHours * 60 * 60 * 1000;
            const now = new Date();
            const localTime = new Date(now.getTime() + offsetMs);
            const year = localTime.getUTCFullYear();
            const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(localTime.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error getting current date for star country:', error);
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        };

        const currentDateString = getCurrentDateString();

        // Fetch availability data
        const availability = await Availability.find({
          userId: user._id,
          date: { $gte: currentDateString }
        }).sort({ date: 1 }).lean();

        // Helper function to parse time slot and convert to UTC Date object
        function parseTimeSlotToUTCDate(dateStr, slot, country) {
          if (!slot || typeof slot !== 'string' || !dateStr) return null;
          
          try {
            const utcDate = convertLocalToUTC(dateStr, slot, country);
            return utcDate;
          } catch (error) {
            console.error(`Error parsing time slot ${slot} on ${dateStr}:`, error);
            return null;
          }
        }

        // Merge availabilities by date
        const mergedByDate = new Map();
        
        availability.forEach(item => {
          const doc = item;
          const dateKey = doc.date;
          
          if (!mergedByDate.has(dateKey)) {
            mergedByDate.set(dateKey, {
              _id: doc._id,
              userId: doc.userId,
              date: doc.date,
              isWeekly: doc.isWeekly || false,
              isDaily: doc.isDaily || false,
              timeSlots: [...(doc.timeSlots || [])],
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            });
          } else {
            const merged = mergedByDate.get(dateKey);
            const existingSlotsMap = new Map();
            
            merged.timeSlots.forEach(slot => {
              existingSlotsMap.set(slot.slot, slot);
            });
            
            doc.timeSlots.forEach(slot => {
              if (!existingSlotsMap.has(slot.slot)) {
                merged.timeSlots.push(slot);
              }
            });
            
            if (doc.isWeekly) merged.isWeekly = true;
            if (doc.isDaily) merged.isDaily = true;
          }
        });

        const mergedAvailability = Array.from(mergedByDate.values());

        // Helper function to parse time slot for sorting
        function parseTimeSlot(slot) {
          if (!slot || typeof slot !== 'string') return 0;

          const parts = slot.split(' - ');
          if (parts.length !== 2) return 0;

          const startTime = parts[0].trim();

          const h24Match = startTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
          if (h24Match) {
            const hour = parseInt(h24Match[1], 10);
            const minute = parseInt(h24Match[2], 10);
            return hour * 60 + minute;
          }

          const ampmMatch = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (ampmMatch) {
            let hour = parseInt(ampmMatch[1], 10);
            const minute = parseInt(ampmMatch[2], 10);
            const ampm = ampmMatch[3].toUpperCase();

            if (ampm === 'PM' && hour !== 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;

            return hour * 60 + minute;
          }

          return 0;
        }

        // Filter out unavailable and past slots
        filteredAvailability = Array.isArray(mergedAvailability)
          ? mergedAvailability
              .map((item) => {
                const timeSlots = Array.isArray(item.timeSlots)
                  ? item.timeSlots
                      .filter((s) => {
                        // Only show available slots
                        if (!s || s.status !== 'available') return false;

                        // Filter out past slots
                        const currentUTCTime = new Date();
                        const today = currentDateString;

                        let slotStartTime = null;
                        if (s.utcStartTime) {
                          slotStartTime = new Date(s.utcStartTime);
                        } else {
                          slotStartTime = parseTimeSlotToUTCDate(item.date, s.slot, starCountry);
                        }

                        if (slotStartTime && slotStartTime <= currentUTCTime) {
                          return false;
                        }
                        return true;
                      })
                      .sort((a, b) => {
                        // Sort by UTC start time if available, otherwise by slot string
                        if (a.utcStartTime && b.utcStartTime) {
                          return new Date(a.utcStartTime) - new Date(b.utcStartTime);
                        }
                        const timeA = parseTimeSlot(a.slot);
                        const timeB = parseTimeSlot(b.slot);
                        return timeA - timeB;
                      })
                  : [];
                return { ...item, timeSlots };
              })
              .filter((item) => Array.isArray(item.timeSlots) && item.timeSlots.length > 0)
              .sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
              })
          : [];
      } catch (error) {
        console.error('Error fetching availability for star:', error);
        filteredAvailability = [];
      }
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

    // Calculate status based on availableForBookings and hidden
    // active: availableForBookings === true && hidden !== true
    // blocked: availableForBookings === false || hidden === true
    const userStatus = (user.availableForBookings === true && user.hidden !== true) 
      ? 'active' 
      : 'blocked';

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
          status: userStatus,
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
          isAddedInFeatureStar: Boolean(user.feature_star),
          isOnlineStar: user.role === 'star' ? isUserOnline(user.lastLoginAt) : false,
          verified: user.isVerified !== undefined ? user.isVerified : false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        },
        services,
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
        fanInsights,
        availability: user.role === 'star' ? filteredAvailability : null
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
    const servicesRaw = await Service.find({ userId: user._id }).lean();
    const dedicationsRaw = await Dedication.find({ userId: user._id }).lean();
    const dedicationSamples = await DedicationSample.find({ userId: user._id }).lean();

    // Merge dedications into services array
    const videoCallServices = servicesRaw.map(s => ({
      id: s._id,
      type: s.type,
      price: s.price,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    const dedicationServices = dedicationsRaw.map(d => ({
      id: d._id,
      type: d.type,
      price: d.price,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));

    const services = [...videoCallServices, ...dedicationServices];

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
    let managementAvailability = [];

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

      // Detailed availability list for management profile (future available slots)
      try {
        const { getCountryTimezoneOffset, convertLocalToUTC } = await import('../utils/timezoneHelper.js');
        const starCountry = user.country || null;

        const getCurrentDateString = () => {
          if (!starCountry) {
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }

          try {
            const offsetHours = getCountryTimezoneOffset(starCountry);
            const offsetMs = offsetHours * 60 * 60 * 1000;
            const now = new Date();
            const localTime = new Date(now.getTime() + offsetMs);
            const year = localTime.getUTCFullYear();
            const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(localTime.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          } catch (error) {
            console.error('Error getting current date for star country (management profile):', error);
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day = String(now.getUTCDate()).
              padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        };

        const currentDateString = getCurrentDateString();

        const availabilityDocs = await Availability.find({
          userId: user._id,
          date: { $gte: currentDateString }
        }).sort({ date: 1 }).lean();

        const parseTimeSlotToUTCDate = (dateStr, slot, country) => {
          if (!slot || typeof slot !== 'string' || !dateStr) return null;
          try {
            return convertLocalToUTC(dateStr, slot, country);
          } catch (error) {
            console.error(`Error parsing time slot ${slot} on ${dateStr} (management profile):`, error);
            return null;
          }
        };

        const mergedByDate = new Map();
        availabilityDocs.forEach(doc => {
          const dateKey = doc.date;
          if (!mergedByDate.has(dateKey)) {
            mergedByDate.set(dateKey, {
              _id: doc._id,
              userId: doc.userId,
              date: doc.date,
              isWeekly: doc.isWeekly || false,
              isDaily: doc.isDaily || false,
              timeSlots: [...(doc.timeSlots || [])],
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt
            });
          } else {
            const merged = mergedByDate.get(dateKey);
            const existingSlotsMap = new Map();
            merged.timeSlots.forEach(slot => {
              existingSlotsMap.set(slot.slot, slot);
            });
            doc.timeSlots.forEach(slot => {
              if (!existingSlotsMap.has(slot.slot)) {
                merged.timeSlots.push(slot);
              }
            });
            if (doc.isWeekly) merged.isWeekly = true;
            if (doc.isDaily) merged.isDaily = true;
          }
        });

        const mergedAvailability = Array.from(mergedByDate.values());

        const parseSlotMinutes = (slot) => {
          if (!slot || typeof slot !== 'string') return 0;
          const parts = slot.split(' - ');
          if (parts.length !== 2) return 0;
          const startTime = parts[0].trim();
          const h24Match = startTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
          if (h24Match) {
            const hour = parseInt(h24Match[1], 10);
            const minute = parseInt(h24Match[2], 10);
            return hour * 60 + minute;
          }
          const ampmMatch = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (ampmMatch) {
            let hour = parseInt(ampmMatch[1], 10);
            const minute = parseInt(ampmMatch[2], 10);
            const ampm = ampmMatch[3].toUpperCase();
            if (ampm === 'PM' && hour !== 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            return hour * 60 + minute;
          }
          return 0;
        };

        managementAvailability = Array.isArray(mergedAvailability)
          ? mergedAvailability
              .map(item => {
                const timeSlots = Array.isArray(item.timeSlots)
                  ? item.timeSlots
                      .filter(s => {
                        if (!s || s.status !== 'available') return false;
                        const currentUTCTime = new Date();
                        let slotStartTime = null;
                        if (s.utcStartTime) {
                          slotStartTime = new Date(s.utcStartTime);
                        } else {
                          slotStartTime = parseTimeSlotToUTCDate(item.date, s.slot, starCountry);
                        }
                        if (slotStartTime && slotStartTime <= currentUTCTime) {
                          return false;
                        }
                        return true;
                      })
                      .sort((a, b) => {
                        if (a.utcStartTime && b.utcStartTime) {
                          return new Date(a.utcStartTime) - new Date(b.utcStartTime);
                        }
                        const timeA = parseSlotMinutes(a.slot);
                        const timeB = parseSlotMinutes(b.slot);
                        return timeA - timeB;
                      })
                  : [];
                return { ...item, timeSlots };
              })
              .filter(item => Array.isArray(item.timeSlots) && item.timeSlots.length > 0)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
          : [];
      } catch (err) {
        console.error('Error building management availability list for star:', err);
        managementAvailability = [];
      }
    }

    // Calculate status based on availableForBookings and hidden
    // active: availableForBookings === true && hidden !== true
    // blocked: availableForBookings === false || hidden === true
    const userStatus = (user.availableForBookings === true && user.hidden !== true) 
      ? 'active' 
      : 'blocked';

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
          status: userStatus,
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
          isAddedInFeatureStar: Boolean(user.feature_star),
          isOnlineStar: user.role === 'star' ? isUserOnline(user.lastLoginAt) : false,
          verified: user.isVerified !== undefined ? user.isVerified : false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        },
        services,
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
        starInsights,
        availability: user.role === 'star' ? managementAvailability : null
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

// Overview (7/15/30 day or named periods) for fan or star by ID (admin)
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
    const rawPeriod = (req.query.period || '30').toString().trim();

    const getSinceFromPeriod = (periodValue) => {
      const now = new Date();
      const msPerDay = 24 * 60 * 60 * 1000;

      // Support old numeric style ("7", "15", "30")
      if (['7', '15', '30'].includes(periodValue)) {
        const days = parseInt(periodValue, 10);
        const since = new Date(now.getTime() - days * msPerDay);
        return { since, periodDays: days };
      }

      // Support named periods
      const normalized = periodValue.toLowerCase();

      if (normalized === 'current_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const diffDays = Math.round((now.getTime() - startOfMonth.getTime()) / msPerDay);
        return { since: startOfMonth, periodDays: diffDays || 1 };
      }

      if (normalized === 'last_month') {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const diffDays = Math.round((endOfLastMonth.getTime() - startOfLastMonth.getTime()) / msPerDay);
        return { since: startOfLastMonth, periodDays: diffDays || 1 };
      }

      if (normalized === 'last_3_months') {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const diffDays = Math.round((now.getTime() - threeMonthsAgo.getTime()) / msPerDay);
        return { since: threeMonthsAgo, periodDays: diffDays || 1 };
      }

      if (normalized === 'last_6_months') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        const diffDays = Math.round((now.getTime() - sixMonthsAgo.getTime()) / msPerDay);
        return { since: sixMonthsAgo, periodDays: diffDays || 1 };
      }

      if (normalized === 'this_year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diffDays = Math.round((now.getTime() - startOfYear.getTime()) / msPerDay);
        return { since: startOfYear, periodDays: diffDays || 1 };
      }

      if (normalized === 'all_time') {
        const start = new Date(1970, 0, 1);
        const diffDays = Math.round((now.getTime() - start.getTime()) / msPerDay);
        return { since: start, periodDays: diffDays || 1 };
      }

      // Fallback: behave like 30 days
      const fallbackDays = 30;
      const fallbackSince = new Date(now.getTime() - fallbackDays * msPerDay);
      return { since: fallbackSince, periodDays: fallbackDays };
    };

    const { since, periodDays } = getSinceFromPeriod(rawPeriod);

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

    let starOverview = null;
    let starCancelled = null;
    let fanOverview = null;
    let fanCancelled = null;

    if (user.role === 'star') {
      // Overview should count COMPLETED items, not all items
      const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
        Appointment.countDocuments({ starId: user._id, status: 'completed', createdAt: { $gte: since } }),
        DedicationRequest.countDocuments({ starId: user._id, status: 'completed', createdAt: { $gte: since } }),
        LiveShow.countDocuments({ starId: user._id, status: 'completed', createdAt: { $gte: since } }),
        // Engaged users: unique fans who have completed transactions with this star
        Transaction.distinct('payerId', { receiverId: user._id, status: 'completed', createdAt: { $gte: since } }).then(u => u.length)
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
      isAddedInFeatureStar, // Accept both feature_star and isAddedInFeatureStar
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
      // Allow null or empty string to clear the field
      if (about === null || about === '') {
        user.about = null; // Clear the field for both stars and fans
      } else if (typeof about === 'string') {
        const trimmedAbout = about.trim();
        if (trimmedAbout.length === 0) {
          user.about = null; // Clear if empty after trim
        } else if (user.role === 'star') {
          // For stars, must be at least 100 characters if provided
          if (trimmedAbout.length < 100) {
            return res.status(400).json({
              success: false,
              message: 'About field must be at least 100 characters if provided for stars'
            });
          }
          user.about = trimmedAbout;
        } else {
          // For fans, no minimum length requirement
          user.about = trimmedAbout;
        }
      }
    }
    if (location !== undefined) user.location = location;
    if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

    // Update toggle fields (available for both fan and star)
    // IMPORTANT: Only update availableForBookings if provided - do NOT change hidden
    if (availableForBookings !== undefined) user.availableForBookings = availableForBookings;
    // IMPORTANT: Only update hidden if explicitly provided - do NOT change based on availableForBookings
    if (hidden !== undefined) user.hidden = hidden;
    if (appNotification !== undefined) user.appNotification = appNotification;
    if (isVerified !== undefined) user.isVerified = isVerified;
    
    // Star-specific fields (only update if user is or becomes a star)
    // Accept both feature_star and isAddedInFeatureStar (they mean the same thing)
    const featureStarValue = feature_star !== undefined ? feature_star : isAddedInFeatureStar;
    if (featureStarValue !== undefined) {
      // Only allow feature_star for stars
      if (user.role === 'star' || (role !== undefined && role === 'star')) {
        user.feature_star = Boolean(featureStarValue);
      }
      // Silently ignore for fans
    }

    // Update role (only if changing to star or fan, not admin)
    if (role !== undefined && ['star', 'fan'].includes(role)) {
      user.role = role;
    }

    // Update status (maps to availableForBookings and hidden)
    // IMPORTANT: Only apply status logic if status is explicitly provided AND 
    // availableForBookings/hidden are NOT individually provided
    // This prevents status from overriding individual toggle updates
    if (status !== undefined && availableForBookings === undefined && hidden === undefined) {
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
    if (services !== undefined && Array.isArray(services)) {
      if (user.role !== 'star') {
        // Silently ignore services for non-stars
      } else {
        // Handle empty array: clear all services
        if (services.length === 0) {
          await Service.deleteMany({ userId: user._id });
        } else {
          // Check if services array uses operation-based format or simple replace format
          const firstService = services[0];
          const hasOperation = firstService && 'operation' in firstService;

          if (hasOperation) {
            // Operation-based format: add/update/delete operations
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
          } else {
            // Simple replace format: delete all existing services and insert new ones
            // Filter valid services (must have type and price)
            const validServices = services
              .filter((s) => s && typeof s === 'object' && s.type && s.price !== undefined)
              .map((s) => ({
                type: typeof s.type === 'string' ? s.type.trim() : String(s.type),
                price: parseFloat(s.price) || 0,
                userId: user._id
              }));

            // Delete all existing services for this user
            await Service.deleteMany({ userId: user._id });
            // Insert new services (even if empty array, this will just clear all services)
            if (validServices.length > 0) {
              await Service.insertMany(validServices);
            }
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
          feature_star: user.role === 'star' ? Boolean(user.feature_star) : undefined,
          isAddedInFeatureStar: user.role === 'star' ? Boolean(user.feature_star) : false,
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

// Upload profile picture for fan or star (admin only)
export const uploadUserProfilePicture = async (req, res) => {
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

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if file is uploaded
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture file is required'
      });
    }

    // Upload file to Cloudinary
    const { uploadFile } = await import('../utils/uploadFile.js');
    const profilePicUrl = await uploadFile(req.file.buffer);

    // Update user's profile picture
    user.profilePic = profilePicUrl;
    await user.save();

    return res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePic: user.profilePic,
        userId: user._id
      }
    });

  } catch (err) {
    console.error('Upload profile picture error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to upload profile picture'
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

    // Populate profession if exists
    await user.populate('profession', 'name image');

    // Build complete user response for FAN/STAR view
    const userResponse = {
      id: user._id,
      baroniId: user.baroniId || null,
      name: user.name || '',
      pseudo: user.pseudo || '',
      email: user.email || null,
      contact: user.contact || null,
      profilePic: user.profilePic || null,
      role: user.role || 'fan',
      country: user.country || null,
      profession: user.profession ? {
        id: user.profession._id || user.profession.id || null,
        name: user.profession.name || ''
      } : null,
      about: user.about || null,
      location: user.location || null,
      availableForBookings: user.availableForBookings !== undefined ? user.availableForBookings : true,
      hidden: user.hidden !== undefined ? user.hidden : false,
      status: (user.availableForBookings === true && user.hidden !== true) ? 'active' : 'blocked',
      isVerified: user.isVerified !== undefined ? user.isVerified : false,
      coinBalance: user.coinBalance || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt || user.createdAt,
      lastLoginAt: user.lastLoginAt || null
    };

    // Add star-specific fields if user is a star
    if (user.role === 'star') {
      userResponse.feature_star = user.feature_star !== undefined ? user.feature_star : false;
      userResponse.isAddedInFeatureStar = Boolean(user.feature_star);
      userResponse.averageRating = user.averageRating || 0;
      userResponse.totalReviews = user.totalReviews || 0;
      userResponse.introVideo = user.introVideo || null;
    }

    return res.json({
      success: true,
      message: `${user.role === 'star' ? 'Star' : 'User'} ${action}ed successfully`,
      data: {
        user: userResponse,
        reason: reason || null
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
