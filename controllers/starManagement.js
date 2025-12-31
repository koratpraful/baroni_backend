import User from '../models/User.js';
import Service from '../models/Service.js';
import Dedication from '../models/Dedication.js';
import DedicationSample from '../models/DedicationSample.js';
import Review from '../models/Review.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import Availability from '../models/Availability.js';
import mongoose from 'mongoose';

// Helper function to get country flag emoji from country name or code
const getCountryFlag = (country) => {
  if (!country) return null;
  
  const countryToFlag = {
    // Country names to flag emojis
    'India': '🇮🇳',
    'भारत': '🇮🇳',
    'Bharat': '🇮🇳',
    'USA': '🇺🇸',
    'United States': '🇺🇸',
    'America': '🇺🇸',
    'United Kingdom': '🇬🇧',
    'UK': '🇬🇧',
    'Britain': '🇬🇧',
    'England': '🇬🇧',
    'Canada': '🇨🇦',
    'Australia': '🇦🇺',
    'France': '🇫🇷',
    'Germany': '🇩🇪',
    'Japan': '🇯🇵',
    'China': '🇨🇳',
    'Brazil': '🇧🇷',
    'Mali': '🇲🇱',
    'Spain': '🇪🇸',
    'Italy': '🇮🇹',
    'Russia': '🇷🇺',
    'South Korea': '🇰🇷',
    'Mexico': '🇲🇽',
    'Argentina': '🇦🇷',
    'South Africa': '🇿🇦',
    'Nigeria': '🇳🇬',
    'Egypt': '🇪🇬',
    'Turkey': '🇹🇷',
    'Saudi Arabia': '🇸🇦',
    'UAE': '🇦🇪',
    'United Arab Emirates': '🇦🇪',
    'Singapore': '🇸🇬',
    'Thailand': '🇹🇭',
    'Indonesia': '🇮🇩',
    'Philippines': '🇵🇭',
    'Vietnam': '🇻🇳',
    'Malaysia': '🇲🇾',
    // Country codes to flag emojis
    'IN': '🇮🇳',
    'US': '🇺🇸',
    'GB': '🇬🇧',
    'CA': '🇨🇦',
    'AU': '🇦🇺',
    'FR': '🇫🇷',
    'DE': '🇩🇪',
    'JP': '🇯🇵',
    'CN': '🇨🇳',
    'BR': '🇧🇷',
    'ML': '🇲🇱',
    'ES': '🇪🇸',
    'IT': '🇮🇹',
    'RU': '🇷🇺',
    'KR': '🇰🇷',
    'MX': '🇲🇽',
    'AR': '🇦🇷',
    'ZA': '🇿🇦',
    'NG': '🇳🇬',
    'EG': '🇪🇬',
    'TR': '🇹🇷',
    'SA': '🇸🇦',
    'AE': '🇦🇪',
    'SG': '🇸🇬',
    'TH': '🇹🇭',
    'ID': '🇮🇩',
    'PH': '🇵🇭',
    'VN': '🇻🇳',
    'MY': '🇲🇾'
  };
  
  // Try direct lookup
  if (countryToFlag[country]) {
    return countryToFlag[country];
  }
  
  // Try case-insensitive lookup
  const normalizedCountry = country.trim();
  for (const [key, flag] of Object.entries(countryToFlag)) {
    if (key.toLowerCase() === normalizedCountry.toLowerCase()) {
      return flag;
    }
  }
  
  return null;
};

// Helper function to check if star is online (logged in within last 15 minutes)
const isStarOnline = (lastLoginAt) => {
  if (!lastLoginAt) return false;
  const now = new Date();
  const lastLogin = new Date(lastLoginAt);
  const diffInMinutes = (now - lastLogin) / (1000 * 60);
  return diffInMinutes <= 15; // Consider online if logged in within last 15 minutes
};

// Get star profile details with comprehensive information
export const getStarProfile = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { period = '30' } = req.query; // Default to 30 days

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    // Validate period
    const validPeriods = ['7', '15', '30', '60', '90'];
    const periodDays = validPeriods.includes(period) ? parseInt(period) : 30;

    const star = await User.findById(starId)
      .populate('profession', 'name')
      .lean();

    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Get star's services
    const services = await Service.find({ userId: star._id }).lean();

    // Get star's dedication samples
    const dedicationSamples = await DedicationSample.find({ userId: star._id }).lean();

    // Get star's reviews and rating
    const reviews = await Review.find({ starId: star._id }).lean();
    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;

    // Get star's revenue and activity stats (based on period)
    const periodStartDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // Revenue insights
    const revenueStats = await Transaction.aggregate([
      {
        $match: {
          receiverId: star._id,
          status: 'completed',
          createdAt: { $gte: periodStartDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          escrowAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const revenue = revenueStats[0] || { totalRevenue: 0, escrowAmount: 0 };

    // Activity overview (based on period)
    const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
      Appointment.countDocuments({
        starId: star._id,
        createdAt: { $gte: periodStartDate }
      }),
      DedicationRequest.countDocuments({
        starId: star._id,
        createdAt: { $gte: periodStartDate }
      }),
      LiveShow.countDocuments({
        starId: star._id,
        createdAt: { $gte: periodStartDate }
      }),
      Transaction.distinct('payerId', {
        receiverId: star._id,
        createdAt: { $gte: periodStartDate }
      }).then(users => users.length)
    ]);

    // Cancelled activities (based on period)
    const [cancelledVideoCalls, cancelledDedications, cancelledLiveShows, rejectedByStarCalls, rejectedByStarDedications] = await Promise.all([
      Appointment.countDocuments({
        starId: star._id,
        status: 'cancelled',
        createdAt: { $gte: periodStartDate }
      }),
      DedicationRequest.countDocuments({
        starId: star._id,
        status: 'cancelled',
        createdAt: { $gte: periodStartDate }
      }),
      LiveShow.countDocuments({
        starId: star._id,
        status: 'cancelled',
        createdAt: { $gte: periodStartDate }
      }),
      Appointment.countDocuments({
        starId: star._id,
        status: 'rejected',
        createdAt: { $gte: periodStartDate }
      }),
      DedicationRequest.countDocuments({
        starId: star._id,
        status: 'rejected',
        createdAt: { $gte: periodStartDate }
      })
    ]);

    // Check if star has available time slots
    const hasAvailableTimeSlots = await Availability.findOne({
      userId: star._id,
      'timeSlots.status': 'available'
    });

    // Update availableForBookings logic based on time slot availability
    let finalAvailableForBookings = star.availableForBookings;
    
    if (star.availableForBookings === true) {
      // If availableForBookings is true, check if there are available time slots
      finalAvailableForBookings = hasAvailableTimeSlots ? true : false;
    } else {
      // If availableForBookings is false, keep it false
      finalAvailableForBookings = false;
    }

    return res.json({
      success: true,
      message: 'Star profile retrieved successfully',
      data: {
        star: {
          id: star._id,
          baroniId: star.baroniId,
          name: star.name,
          pseudo: star.pseudo,
          email: star.email || null,
          contact: star.contact,
          profilePic: star.profilePic,
          role: star.role,
          country: star.country,
          countryFlag: getCountryFlag(star.country),
          preferredLanguage: star.preferredLanguage || null,
          profession: star.profession ? {
            id: star.profession._id || star.profession.id || null,
            name: star.profession.name || ''
          } : null,
          about: star.about,
          location: star.location,
          availableForBookings: finalAvailableForBookings,
          hidden: star.hidden,
          appNotification: star.appNotification,
          coinBalance: star.coinBalance,
          deviceType: star.deviceType,
          isAddedInFeatureStar: star.feature_star || false,
          isOnlineStar: isStarOnline(star.lastLoginAt),
          isVerified: star.isVerified || false,
          introVideo: star.introVideo || null,
          createdAt: star.createdAt,
          lastLoginAt: star.lastLoginAt
        },
        rating: {
          average: Math.round(averageRating * 10) / 10,
          totalReviews: reviews.length
        },
        services: services.map(service => ({
          id: service._id,
          type: service.type,
          price: service.price,
          createdAt: service.createdAt
        })),
        dedicationSamples: dedicationSamples.map(sample => ({
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          createdAt: sample.createdAt
        })),
        overview: {
          period: `${periodDays} days`,
          videoCalls,
          dedications,
          liveShows,
          engagedUsers
        },
        cancelled: {
          period: `${periodDays} days`,
          videoCalls: cancelledVideoCalls,
          dedications: cancelledDedications,
          liveShows: cancelledLiveShows,
          rejectedByStar: rejectedByStarCalls + rejectedByStarDedications
        },
        revenue: {
          total: revenue.totalRevenue,
          escrow: revenue.escrowAmount
        }
      }
    });

  } catch (err) {
    console.error('Get star profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get star profile'
    });
  }
};

// Update star profile
export const updateStarProfile = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const {
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
      availableForBookings,
      hidden,
      appNotification,
      role,
      isVerified,
      introVideo,
      status,
      feature_star
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate about field minimum length if provided
    // Allow empty string/null to clear, but if provided, must be at least 100 characters
    if (about !== undefined && about !== null && about !== '') {
      const trimmedAbout = typeof about === 'string' ? about.trim() : '';
      if (trimmedAbout.length > 0 && trimmedAbout.length < 100) {
        return res.status(400).json({
          success: false,
          message: 'About field must be at least 100 characters if provided'
        });
      }
    }

    // Email uniqueness check if changing email
    if (email !== undefined && email !== null && email !== '') {
      const normalizedEmail = email.toLowerCase();
      // Check if email is different (case-insensitive comparison)
      if (star.email?.toLowerCase() !== normalizedEmail) {
        const existing = await User.findOne({ 
          email: normalizedEmail, 
          _id: { $ne: starId } 
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use'
          });
        }
        star.email = normalizedEmail;
      }
    }

    // Update fields
    if (name !== undefined) star.name = name;
    if (pseudo !== undefined) star.pseudo = pseudo;
    if (contact !== undefined) star.contact = contact;
    if (profilePic !== undefined) {
      // Allow empty string to clear profile picture
      star.profilePic = profilePic === '' ? null : profilePic;
    }
    if (country !== undefined) star.country = country;
    // Support both profession and category (they refer to the same field)
    if (profession !== undefined) star.profession = profession;
    if (category !== undefined) star.profession = category;
    if (about !== undefined) {
      // Only update if it meets minimum length requirement or is being cleared
      if (about === '' || about === null) {
        star.about = about;
      } else if (about.trim().length >= 100) {
        star.about = about;
      }
      // If it doesn't meet requirement, validation should have caught it
    }
    if (location !== undefined) star.location = location;
    if (preferredLanguage !== undefined) star.preferredLanguage = preferredLanguage;
    if (availableForBookings !== undefined) star.availableForBookings = availableForBookings;
    if (hidden !== undefined) star.hidden = hidden;
    if (appNotification !== undefined) star.appNotification = appNotification;
    if (introVideo !== undefined) {
      // Allow empty string to remove intro video
      star.introVideo = introVideo === '' || introVideo === null ? null : introVideo;
    }
    
    // Update role (only if changing to star or fan, not admin)
    if (role !== undefined && ['star', 'fan'].includes(role)) {
      star.role = role;
    }
    
    // Update verified status
    if (isVerified !== undefined) star.isVerified = isVerified;
    
    // Update featured star status
    if (feature_star !== undefined) star.feature_star = feature_star;
    
    // Update status (maps to availableForBookings and hidden)
    if (status !== undefined) {
      if (status === 'active') {
        star.availableForBookings = true;
        star.hidden = false;
      } else if (status === 'blocked' || status === 'inactive') {
        star.availableForBookings = false;
        star.hidden = true;
      }
    }

    await star.save();

    // Populate profession for response
    await star.populate('profession', 'name');

    return res.json({
      success: true,
      message: 'Star profile updated successfully',
      data: {
        star: {
          id: star._id,
          baroniId: star.baroniId,
          name: star.name,
          pseudo: star.pseudo,
          email: star.email,
          contact: star.contact,
          profilePic: star.profilePic,
          country: star.country,
          countryFlag: getCountryFlag(star.country),
          profession: star.profession ? {
            id: star.profession._id || star.profession.id || null,
            name: star.profession.name || ''
          } : null,
          about: star.about,
          location: star.location,
          preferredLanguage: star.preferredLanguage,
          availableForBookings: star.availableForBookings,
          hidden: star.hidden,
          appNotification: star.appNotification,
          role: star.role,
          isVerified: star.isVerified || false,
          feature_star: star.feature_star || false,
          introVideo: star.introVideo || null,
          status: star.availableForBookings && !star.hidden ? 'active' : 'blocked',
          createdAt: star.createdAt,
          lastLoginAt: star.lastLoginAt
        }
      }
    });

  } catch (err) {
    console.error('Update star profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update star profile'
    });
  }
};

// Manage star services
export const getStarServices = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const services = await Service.find({ userId: star._id }).lean();

    return res.json({
      success: true,
      message: 'Star services retrieved successfully',
      data: {
        services: services.map(service => ({
          id: service._id,
          type: service.type,
          price: service.price,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt
        }))
      }
    });

  } catch (err) {
    console.error('Get star services error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get star services'
    });
  }
};

// Add star service
export const addStarService = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { type, price } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    if (!type || !price) {
      return res.status(400).json({
        success: false,
        message: 'Service type and price are required'
      });
    }

    // Check if service already exists
    const existingService = await Service.findOne({ userId: star._id, type });
    if (existingService) {
      return res.status(409).json({
        success: false,
        message: 'Service type already exists for this star'
      });
    }

    const service = new Service({
      type,
      price: parseFloat(price),
      userId: star._id
    });

    await service.save();

    return res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: {
        service: {
          id: service._id,
          type: service.type,
          price: service.price,
          createdAt: service.createdAt
        }
      }
    });

  } catch (err) {
    console.error('Add star service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add service'
    });
  }
};

// Update star service
export const updateStarService = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, serviceId } = req.params;
    const { type, price } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or service ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const service = await Service.findOne({ _id: serviceId, userId: star._id });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (type) service.type = type;
    if (price !== undefined) service.price = parseFloat(price);

    await service.save();

    return res.json({
      success: true,
      message: 'Service updated successfully',
      data: {
        service: {
          id: service._id,
          type: service.type,
          price: service.price,
          updatedAt: service.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Update star service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service'
    });
  }
};

// Delete star service
export const deleteStarService = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or service ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const service = await Service.findOne({ _id: serviceId, userId: star._id });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await Service.deleteOne({ _id: serviceId });

    return res.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (err) {
    console.error('Delete star service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service'
    });
  }
};

// Get star dedications (charges)
export const getStarDedications = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const dedications = await Dedication.find({ userId: star._id }).lean();

    return res.json({
      success: true,
      message: 'Star dedications retrieved successfully',
      data: {
        dedications: dedications.map(dedication => ({
          id: dedication._id,
          type: dedication.type,
          price: dedication.price,
          createdAt: dedication.createdAt,
          updatedAt: dedication.updatedAt
        }))
      }
    });

  } catch (err) {
    console.error('Get star dedications error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dedications'
    });
  }
};

// Manage star dedication samples
export const getStarDedicationSamples = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const samples = await DedicationSample.find({ userId: star._id }).lean();

    return res.json({
      success: true,
      message: 'Star dedication samples retrieved successfully',
      data: {
        samples: samples.map(sample => ({
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          createdAt: sample.createdAt,
          updatedAt: sample.updatedAt
        }))
      }
    });

  } catch (err) {
    console.error('Get star dedication samples error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dedication samples'
    });
  }
};

// Add star dedication sample (supports both file upload and video URL)
export const addStarDedicationSample = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { type, description } = req.body;
    let { video } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Sample type is required'
      });
    }

    // Handle video: either from file upload or URL
    if (!video) {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'Video is required (either upload a file or provide a video URL)'
        });
      }
      // Upload video file
      const { uploadVideo } = await import('../utils/uploadFile.js');
      video = await uploadVideo(req.file.buffer);
    }

    const sample = new DedicationSample({
      type: type.trim(),
      video: String(video).trim(),
      description: description ? description.trim() : '',
      userId: star._id
    });

    await sample.save();

    return res.status(201).json({
      success: true,
      message: 'Dedication sample added successfully',
      data: {
        sample: {
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          createdAt: sample.createdAt,
          updatedAt: sample.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Add star dedication sample error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add dedication sample'
    });
  }
};

// Update star dedication sample (supports both file upload and video URL)
export const updateStarDedicationSample = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, sampleId } = req.params;
    const { type, description } = req.body;
    let { video } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(sampleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or sample ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const sample = await DedicationSample.findOne({ _id: sampleId, userId: star._id });
    if (!sample) {
      return res.status(404).json({
        success: false,
        message: 'Dedication sample not found'
      });
    }

    if (type) sample.type = type.trim();
    if (description !== undefined) sample.description = description ? description.trim() : '';
    
    // Handle video: either from file upload or URL
    if (video) {
      sample.video = String(video).trim();
    } else if (req.file && req.file.buffer) {
      // Upload video file
      const { uploadVideo } = await import('../utils/uploadFile.js');
      sample.video = await uploadVideo(req.file.buffer);
    }

    await sample.save();

    return res.json({
      success: true,
      message: 'Dedication sample updated successfully',
      data: {
        sample: {
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          updatedAt: sample.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Update star dedication sample error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update dedication sample'
    });
  }
};

// Delete star dedication sample
export const deleteStarDedicationSample = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, sampleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(sampleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or sample ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const sample = await DedicationSample.findOne({ _id: sampleId, userId: star._id });
    if (!sample) {
      return res.status(404).json({
        success: false,
        message: 'Dedication sample not found'
      });
    }

    await DedicationSample.deleteOne({ _id: sampleId });

    return res.json({
      success: true,
      message: 'Dedication sample deleted successfully'
    });

  } catch (err) {
    console.error('Delete star dedication sample error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dedication sample'
    });
  }
};

// Delete star dedication (charges)
export const deleteStarDedication = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, dedicationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(dedicationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or dedication ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const dedication = await Dedication.findOne({ _id: dedicationId, userId: star._id });
    if (!dedication) {
      return res.status(404).json({
        success: false,
        message: 'Dedication not found'
      });
    }

    await Dedication.deleteOne({ _id: dedicationId });

    return res.json({
      success: true,
      message: 'Dedication deleted successfully',
      data: {
        dedication: {
          id: dedication._id,
          type: dedication.type,
          price: dedication.price
        }
      }
    });

  } catch (err) {
    console.error('Delete star dedication error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dedication'
    });
  }
};

// Get all stars with filtering and search
export const getAllStars = async (req, res) => {
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
      role: 'star',
      isDeleted: { $ne: true }
    };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { pseudo: { $regex: search, $options: 'i' } },
        { baroniId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Add country filter
    if (country && country !== 'all') {
      filter.country = country;
    }

    // Add status filter
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

    // Get stars with pagination
    const stars = await User.find(filter)
      .populate('profession', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalStars = await User.countDocuments(filter);

    // Get unique countries for filter options
    const countries = await User.distinct('country', {
      role: 'star',
      country: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    });

    // Get status counts
    const activeCount = await User.countDocuments({
      role: 'star',
      availableForBookings: true,
      hidden: false,
      isDeleted: { $ne: true }
    });

    const blockedCount = await User.countDocuments({
      role: 'star',
      $or: [
        { availableForBookings: false },
        { hidden: true }
      ],
      isDeleted: { $ne: true }
    });

    return res.json({
      success: true,
      message: 'Stars retrieved successfully',
      data: {
        stars: stars.map(star => ({
          id: star._id,
          baroniId: star.baroniId,
          name: star.name,
          pseudo: star.pseudo,
          email: star.email,
          profilePic: star.profilePic,
          country: star.country,
          profession: star.profession ? {
            id: star.profession._id || star.profession.id || null,
            name: star.profession.name || ''
          } : null,
          availableForBookings: star.availableForBookings,
          hidden: star.hidden,
          status: star.availableForBookings && !star.hidden ? 'active' : 'blocked',
          coinBalance: star.coinBalance,
          createdAt: star.createdAt,
          lastLoginAt: star.lastLoginAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalStars,
          pages: Math.ceil(totalStars / parseInt(limit))
        },
        filters: {
          countries: countries.sort(),
          statuses: ['active', 'blocked']
        },
        stats: {
          status: {
            active: activeCount,
            blocked: blockedCount
          }
        }
      }
    });

  } catch (err) {
    console.error('Get all stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stars'
    });
  }
};

// ==================== FEATURED STAR MANAGEMENT ====================

// Toggle featured star status
export const toggleFeaturedStar = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { feature_star } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    if (typeof feature_star !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'feature_star must be a boolean value (true/false)'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Update featured star status
    star.feature_star = feature_star;
    await star.save();

    return res.json({
      success: true,
      message: `Star ${feature_star ? 'featured' : 'unfeatured'} successfully`,
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          baroniId: star.baroniId,
          feature_star: star.feature_star
        }
      }
    });

  } catch (err) {
    console.error('Toggle featured star error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle featured star status'
    });
  }
};

// Get all featured stars
export const getFeaturedStars = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const featuredStars = await User.find({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true }
    })
      .populate('profession', 'name')
      .select('name pseudo baroniId profilePic country profession feature_star createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalFeaturedStars = await User.countDocuments({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true }
    });

    return res.json({
      success: true,
      message: 'Featured stars retrieved successfully',
      data: {
        featuredStars: featuredStars.map(star => ({
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          country: star.country,
          profession: star.profession ? {
            id: star.profession._id || star.profession.id || null,
            name: star.profession.name || ''
          } : null,
          feature_star: star.feature_star,
          createdAt: star.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalFeaturedStars,
          pages: Math.ceil(totalFeaturedStars / parseInt(limit))
        }
      }
    });

  } catch (err) {
    console.error('Get featured stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get featured stars'
    });
  }
};

// Bulk update featured stars
export const bulkUpdateFeaturedStars = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starIds, feature_star } = req.body;

    if (!Array.isArray(starIds) || starIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'starIds must be a non-empty array'
      });
    }

    if (typeof feature_star !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'feature_star must be a boolean value (true/false)'
      });
    }

    // Validate all star IDs
    const invalidIds = starIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid star IDs: ${invalidIds.join(', ')}`
      });
    }

    // Update all stars
    const result = await User.updateMany(
      { 
        _id: { $in: starIds },
        role: 'star',
        isDeleted: { $ne: true }
      },
      { feature_star }
    );

    return res.json({
      success: true,
      message: `${result.modifiedCount} stars ${feature_star ? 'featured' : 'unfeatured'} successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    });

  } catch (err) {
    console.error('Bulk update featured stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update featured stars'
    });
  }
};

// ==================== STAR STATUS MANAGEMENT ====================

// Block/Unblock star
export const updateStarStatus = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { action, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "block" or "unblock"'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Update star status
    if (action === 'block') {
      star.availableForBookings = false;
      star.hidden = true;
    } else {
      star.availableForBookings = true;
      star.hidden = false;
    }

    await star.save();

    // Populate profession if exists
    await star.populate('profession', 'name image');

    // Build complete star response for FAN/STAR view
    const starResponse = {
      id: star._id,
      baroniId: star.baroniId || null,
      name: star.name || '',
      pseudo: star.pseudo || '',
      email: star.email || null,
      contact: star.contact || null,
      profilePic: star.profilePic || null,
      role: star.role || 'star',
      country: star.country || null,
      profession: star.profession ? {
        id: star.profession._id || star.profession.id || null,
        name: star.profession.name || ''
      } : null,
      about: star.about || null,
      location: star.location || null,
      availableForBookings: star.availableForBookings !== undefined ? star.availableForBookings : true,
      hidden: star.hidden !== undefined ? star.hidden : false,
      status: (star.availableForBookings === true && star.hidden !== true) ? 'active' : 'blocked',
      isVerified: star.isVerified !== undefined ? star.isVerified : false,
      coinBalance: star.coinBalance || 0,
      feature_star: star.feature_star !== undefined ? star.feature_star : false,
      isAddedInFeatureStar: Boolean(star.feature_star),
      averageRating: star.averageRating || 0,
      totalReviews: star.totalReviews || 0,
      introVideo: star.introVideo || null,
      createdAt: star.createdAt,
      updatedAt: star.updatedAt || star.createdAt,
      lastLoginAt: star.lastLoginAt || null
    };

    return res.json({
      success: true,
      message: `Star ${action}ed successfully`,
      data: {
        star: starResponse,
        user: starResponse, // Also include as 'user' for consistency
        reason: reason || null
      }
    });

  } catch (err) {
    console.error('Update star status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update star status'
    });
  }
};

// Reset star password
export const resetStarPassword = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password is required and must be at least 6 characters'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Hash new password
    const bcrypt = (await import('bcryptjs')).default;
    const salt = await bcrypt.genSalt(10);
    star.password = await bcrypt.hash(newPassword, salt);
    star.passwordResetToken = undefined;
    star.passwordResetExpires = undefined;
    star.sessionVersion = (star.sessionVersion || 0) + 1; // Invalidate existing sessions
    await star.save();

    return res.json({
      success: true,
      message: 'Star password reset successfully',
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo
        }
      }
    });

  } catch (err) {
    console.error('Reset star password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset star password'
    });
  }
};

// Delete star (soft delete)
export const deleteStar = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Soft delete
    star.isDeleted = true;
    star.deletedAt = new Date();
    star.availableForBookings = false;
    star.hidden = true;
    await star.save();

    return res.json({
      success: true,
      message: 'Star deleted successfully',
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          isDeleted: star.isDeleted,
          deletedAt: star.deletedAt,
          reason: reason || null
        }
      }
    });

  } catch (err) {
    console.error('Delete star error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete star'
    });
  }
};

// Update star verified status
export const updateStarVerifiedStatus = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { isVerified } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isVerified must be a boolean value (true/false)'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    star.isVerified = isVerified;
    await star.save();

    return res.json({
      success: true,
      message: `Star ${isVerified ? 'verified' : 'unverified'} successfully`,
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          isVerified: star.isVerified
        }
      }
    });

  } catch (err) {
    console.error('Update star verified status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update star verified status'
    });
  }
};

// Update star intro video
export const updateStarIntroVideo = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { introVideo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // If introVideo is empty string, set to null to remove it
    star.introVideo = introVideo === '' || introVideo === null ? null : introVideo;
    await star.save();

    return res.json({
      success: true,
      message: 'Star intro video updated successfully',
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          introVideo: star.introVideo
        }
      }
    });

  } catch (err) {
    console.error('Update star intro video error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update star intro video'
    });
  }
};