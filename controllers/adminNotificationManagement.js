import NotificationTemplate from '../models/NotificationTemplate.js';
import ScheduledNotification from '../models/ScheduledNotification.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import notificationService from '../services/notificationService.js';
import { sendEmail } from '../services/emailService.js';
import { sendBulkSMS } from '../services/smsService.js';
import mongoose from 'mongoose';

/**
 * Create and send notification immediately
 * POST /api/admin/notifications/create
 */
export const createAndSendNotification = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { notificationType, sessionTitle, message, targetAudience, country, userIds } = req.body;

    // Validation
    if (!notificationType || !message) {
      return res.status(400).json({
        success: false,
        message: 'Notification type and message are required'
      });
    }

    if (!['Push', 'SMS', 'Email'].includes(notificationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification type. Must be Push, SMS, or Email'
      });
    }

    // Validate target audience if provided
    if (targetAudience && !['All Fans', 'All Stars', 'All Users', 'By Country', 'Specific Users'].includes(targetAudience)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid target audience. Must be one of: All Fans, All Stars, All Users, By Country, Specific Users'
      });
    }

    // Build user query based on target audience
    // For Email and SMS, we need different fields than Push notifications
    let userQuery = { isDeleted: { $ne: true } };
    let users = [];
    
    // Determine which fields to select based on notification type
    let selectFields = '_id';
    if (notificationType === 'Push') {
      selectFields = '_id fcmToken apnsToken appNotification';
    } else if (notificationType === 'Email') {
      selectFields = '_id email';
    } else if (notificationType === 'SMS') {
      selectFields = '_id contact';
    }
    
    if (targetAudience === 'All Fans') {
      userQuery.role = 'fan';
      if (country) {
        userQuery.country = country;
      }
      if (notificationType === 'Push') {
        // Only get users who have app notifications enabled for Push
        userQuery.appNotification = { $ne: false };
      } else if (notificationType === 'Email') {
        // Only get users who have email addresses
        userQuery.email = { $exists: true, $ne: null, $ne: '' };
      } else if (notificationType === 'SMS') {
        // Only get users who have contact numbers
        userQuery.contact = { $exists: true, $ne: null, $ne: '' };
      }
      users = await User.find(userQuery).select(selectFields);
    } else if (targetAudience === 'All Stars') {
      userQuery.role = 'star';
      if (country) {
        userQuery.country = country;
      }
      if (notificationType === 'Push') {
        userQuery.appNotification = { $ne: false };
      } else if (notificationType === 'Email') {
        userQuery.email = { $exists: true, $ne: null, $ne: '' };
      } else if (notificationType === 'SMS') {
        userQuery.contact = { $exists: true, $ne: null, $ne: '' };
      }
      users = await User.find(userQuery).select(selectFields);
    } else if (targetAudience === 'All Users') {
      if (country) {
        userQuery.country = country;
      }
      if (notificationType === 'Push') {
        userQuery.appNotification = { $ne: false };
      } else if (notificationType === 'Email') {
        userQuery.email = { $exists: true, $ne: null, $ne: '' };
      } else if (notificationType === 'SMS') {
        userQuery.contact = { $exists: true, $ne: null, $ne: '' };
      }
      users = await User.find(userQuery).select(selectFields);
    } else if (targetAudience === 'By Country' && country) {
      userQuery.country = country;
      if (notificationType === 'Push') {
        userQuery.appNotification = { $ne: false };
      } else if (notificationType === 'Email') {
        userQuery.email = { $exists: true, $ne: null, $ne: '' };
      } else if (notificationType === 'SMS') {
        userQuery.contact = { $exists: true, $ne: null, $ne: '' };
      }
      users = await User.find(userQuery).select(selectFields);
    } else if (targetAudience === 'Specific Users') {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Specific users target requires userIds array'
        });
      }
      // Validate all userIds are valid ObjectIds
      const invalidUserIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidUserIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid user IDs: ${invalidUserIds.join(', ')}`
        });
      }
      userQuery._id = { $in: userIds };
      if (notificationType === 'Push') {
        userQuery.appNotification = { $ne: false };
      } else if (notificationType === 'Email') {
        userQuery.email = { $exists: true, $ne: null, $ne: '' };
      } else if (notificationType === 'SMS') {
        userQuery.contact = { $exists: true, $ne: null, $ne: '' };
      }
      users = await User.find(userQuery).select(selectFields);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Target audience is required. Must be one of: All Fans, All Stars, All Users, By Country, Specific Users'
      });
    }
    
    // Filter out users without required fields (for Email/SMS)
    if (notificationType === 'Email') {
      users = users.filter(u => u.email && u.email.trim());
    } else if (notificationType === 'SMS') {
      users = users.filter(u => u.contact && u.contact.trim());
    }
    
    if (users.length === 0) {
      let errorMessage = 'No users found matching the criteria';
      if (notificationType === 'Email') {
        errorMessage = 'No users found with valid email addresses';
      } else if (notificationType === 'SMS') {
        errorMessage = 'No users found with valid phone numbers';
      }
      return res.status(404).json({
        success: false,
        message: errorMessage
      });
    }

    // Prepare notification data
    const title = sessionTitle || 'Notification';
    const body = message;
    const type = notificationType.toLowerCase() === 'push' ? 'general' : notificationType.toLowerCase();

    // Create or update notification template to track usage
    try {
      const templateData = {
        service: 'General',
        notificationType: notificationType,
        message: body,
        category: 'General',
        createdBy: admin._id
      };
      
      // Find existing template with same message and type, or create new
      let template = await NotificationTemplate.findOne({
        message: body,
        notificationType: notificationType
      });
      
      if (template) {
        // Update last used time and increment usage count
        template.lastUsedAt = new Date();
        template.usageCount = (template.usageCount || 0) + 1;
        await template.save();
      } else {
        // Create new template
        template = new NotificationTemplate(templateData);
        template.lastUsedAt = new Date();
        template.usageCount = 1;
        await template.save();
      }
    } catch (templateError) {
      console.error('Error creating/updating notification template:', templateError);
      // Continue with notification sending even if template save fails
    }

    // Send notifications
    let successCount = 0;
    let failureCount = 0;
    const targetUserIds = users.map(u => u._id);

    // For Push notifications, use the notification service
    // IMPORTANT: Admin notifications should NEVER use VoIP - only regular push notifications
    if (notificationType === 'Push') {
      const result = await notificationService.sendToMultipleUsers(
        targetUserIds,
        { title, body, type: 'general' },
        { sessionTitle, targetAudience, country, isAdminNotification: true }, // Flag to prevent VoIP
        { apnsVoip: false } // Explicitly disable VoIP for admin notifications
      );

      successCount = result.successCount || 0;
      failureCount = result.failureCount || 0;
    } else if (notificationType === 'SMS') {
      // Send SMS to all users with valid phone numbers
      try {
        const usersWithContact = users.filter(u => u.contact && u.contact.trim());
        const phoneNumbers = usersWithContact.map(u => u.contact.trim());
        
        if (phoneNumbers.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No users found with valid phone numbers for SMS'
          });
        }

        // Send bulk SMS
        const smsResult = await sendBulkSMS(phoneNumbers, body);
        successCount = smsResult.successCount;
        failureCount = smsResult.failureCount;

        // Create notification records for all users (both successful and failed)
        const smsNotifications = targetUserIds.map((userId, index) => {
          const user = users.find(u => u._id.toString() === userId.toString());
          const phoneNumber = user?.contact?.trim();
          const smsResultForUser = smsResult.results.find(r => r.phoneNumber === phoneNumber);
          
          return {
            user: userId,
            title: title,
            body: body,
            type: 'sms',
            data: { sessionTitle, targetAudience, country, phoneNumber },
            deliveryStatus: smsResultForUser?.success ? 'sent' : 'failed',
            failureReason: smsResultForUser?.error || null
          };
        });
        
        await Notification.insertMany(smsNotifications);
      } catch (err) {
        console.error('Error sending SMS notifications:', err);
        // Create failed notification records
        try {
          const failedNotifications = targetUserIds.map(userId => ({
            user: userId,
            title: title,
            body: body,
            type: 'sms',
            data: { sessionTitle, targetAudience, country },
            deliveryStatus: 'failed',
            failureReason: err.message
          }));
          await Notification.insertMany(failedNotifications);
        } catch (dbErr) {
          console.error('Error creating failed SMS notification records:', dbErr);
        }
        successCount = 0;
        failureCount = targetUserIds.length;
      }
    } else if (notificationType === 'Email') {
      // Send email to all users with valid email addresses
      try {
        const usersWithEmail = users.filter(u => u.email && u.email.trim());
        const emailAddresses = usersWithEmail.map(u => u.email.trim());
        
        if (emailAddresses.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No users found with valid email addresses'
          });
        }

        // Send emails to all recipients
        const emailResults = [];
        for (const emailAddress of emailAddresses) {
          try {
            const messageId = await sendEmail(emailAddress, title, body, true);
            emailResults.push({ email: emailAddress, success: true, messageId });
            successCount++;
          } catch (emailError) {
            console.error(`Error sending email to ${emailAddress}:`, emailError);
            // Extract user-friendly error message
            let errorMsg = emailError.message || 'Failed to send email';
            if (emailError.code === 'SMTP_NOT_CONFIGURED') {
              errorMsg = 'SMTP not configured. Please set EMAIL_USER and EMAIL_PASS in environment variables.';
            } else if (emailError.responseCode === 530 || errorMsg.includes('Authentication Required')) {
              errorMsg = 'SMTP authentication failed. For Gmail, use App Password instead of regular password.';
            }
            emailResults.push({ email: emailAddress, success: false, error: errorMsg });
            failureCount++;
          }
        }

        // Create notification records for all users
        const emailNotifications = targetUserIds.map((userId) => {
          const user = users.find(u => u._id.toString() === userId.toString());
          const emailAddress = user?.email?.trim();
          const emailResult = emailResults.find(r => r.email === emailAddress);
          
          return {
            user: userId,
            title: title,
            body: body,
            type: 'email',
            data: { sessionTitle, targetAudience, country, emailAddress },
            deliveryStatus: emailResult?.success ? 'sent' : 'failed',
            failureReason: emailResult?.error || null
          };
        });
        
        await Notification.insertMany(emailNotifications);
      } catch (err) {
        console.error('Error sending email notifications:', err);
        // Create failed notification records
        try {
          const failedNotifications = targetUserIds.map(userId => ({
            user: userId,
            title: title,
            body: body,
            type: 'email',
            data: { sessionTitle, targetAudience, country },
            deliveryStatus: 'failed',
            failureReason: err.message
          }));
          await Notification.insertMany(failedNotifications);
        } catch (dbErr) {
          console.error('Error creating failed email notification records:', dbErr);
        }
        successCount = 0;
        failureCount = targetUserIds.length;
      }
    }

    return res.json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        totalUsers: users.length,
        successCount,
        failureCount,
        notificationType,
        targetAudience,
        country: country || null
      }
    });
  } catch (error) {
    console.error('Error creating and sending notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating and sending notification',
      error: error.message
    });
  }
};

/**
 * Create notification template
 * POST /api/admin/notifications/templates
 */
// Helper to normalize category keys: lowercase, no spaces
const normalizeTemplateCategory = (value) => {
  if (!value) return null;
  const raw = value.toString().trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  // Map various inputs to canonical keys
  if (['video_calls', 'video_call', 'video'].includes(normalized)) return 'video_calls';
  if (['dedications', 'dedication'].includes(normalized)) return 'dedications';
  if (['live_shows', 'live_show', 'live'].includes(normalized)) return 'live_shows';
  if (['general'].includes(normalized)) return 'general';
  // Fallback: return normalized as-is
  return normalized;
};

export const createNotificationTemplate = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { service, notificationType, message, category } = req.body;

    // Validation
    if (!service || !notificationType || !message) {
      return res.status(400).json({
        success: false,
        message: 'Service, notification type, and message are required'
      });
    }

    if (!['Live Show', 'Video Call', 'Dedication', 'General'].includes(service)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service type'
      });
    }

    if (!['Push', 'SMS', 'Email'].includes(notificationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification type'
      });
    }

    // Map service to category if not provided
    let templateCategory = category;
    if (!templateCategory) {
      if (service === 'Live Show' || service === 'live_show') templateCategory = 'live_shows';
      else if (service === 'Video Call' || service === 'video_call') templateCategory = 'video_calls';
      else if (service === 'Dedication' || service === 'dedication') templateCategory = 'dedications';
      else templateCategory = 'general';
    }

    // Normalize category to canonical lowercase key (no spaces)
    templateCategory = normalizeTemplateCategory(templateCategory);

    const template = new NotificationTemplate({
      service,
      notificationType,
      message,
      category: templateCategory,
      createdBy: admin._id
    });

    await template.save();

    return res.json({
      success: true,
      message: 'Notification template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Error creating notification template:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating notification template',
      error: error.message
    });
  }
};

/**
 * Get notification templates with filters
 * GET /api/admin/notifications/templates
 */
export const getNotificationTemplates = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { category, notificationType, search, page = 1, limit = 20 } = req.query;

    const query = {};

    // Filter by category
    if (category && category !== 'All') {
      // Normalize requested category and support both legacy and new keys
      const normalized = normalizeTemplateCategory(category);
      const categoryVariants = [];
      if (normalized === 'video_calls') {
        categoryVariants.push('video_calls', 'Video Calls');
      } else if (normalized === 'dedications') {
        categoryVariants.push('dedications', 'Dedications');
      } else if (normalized === 'live_shows') {
        categoryVariants.push('live_shows', 'Live Shows');
      } else if (normalized === 'general') {
        categoryVariants.push('general', 'General');
      } else {
        categoryVariants.push(normalized);
      }
      query.category = { $in: categoryVariants };
    }

    // Filter by notification type
    if (notificationType && notificationType !== 'All') {
      query.notificationType = notificationType;
    }

    // Search filter
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: 'i' } },
        { service: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const templates = await NotificationTemplate.find(query)
      .populate('createdBy', 'name pseudo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await NotificationTemplate.countDocuments(query);

    return res.json({
      success: true,
      message: 'Notification templates retrieved successfully',
      data: {
        templates,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalTemplates: total,
          hasNextPage: skip + templates.length < total,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting notification templates:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting notification templates',
      error: error.message
    });
  }
};

/**
 * Update notification template
 * PUT /api/admin/notifications/templates/:id
 */
export const updateNotificationTemplate = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    const { service, notificationType, message, category } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }

    const template = await NotificationTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Update fields
    if (service) template.service = service;
    if (notificationType) template.notificationType = notificationType;
    if (message) template.message = message;
    if (category) template.category = category;

    await template.save();

    return res.json({
      success: true,
      message: 'Template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Error updating notification template:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating notification template',
      error: error.message
    });
  }
};

/**
 * Delete notification template
 * DELETE /api/admin/notifications/templates/:id
 */
export const deleteNotificationTemplate = async (req, res) => {
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
        message: 'Invalid template ID'
      });
    }

    const template = await NotificationTemplate.findByIdAndDelete(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    return res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification template:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting notification template',
      error: error.message
    });
  }
};

/**
 * Get notification history
 * GET /api/admin/notifications/history
 */
export const getNotificationHistory = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { type, page = 1, limit = 20, search } = req.query;

    // Build base query - only show admin notifications (general/sms/email type or with admin data)
    const baseQuery = {
      $or: [
        { type: 'general' },
        { type: 'sms' },
        { type: 'email' },
        { 'data.isAdminNotification': true }
      ]
    };

    // Filter by type (Push, SMS, Email, or All)
    if (type && type !== 'All') {
      // Normalize type value (case-insensitive, classic style)
      const normalizedType = type.toString().trim().toLowerCase();
      if (normalizedType === 'push') {
        baseQuery.type = 'general';
      } else if (normalizedType === 'sms') {
        baseQuery.type = 'sms';
      } else if (normalizedType === 'email') {
        baseQuery.type = 'email';
      }
    }

    // Search filter
    if (search) {
      baseQuery.$or = [
        ...(baseQuery.$or || []),
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } }
      ];
    }

    // Group notifications by title + body + type to show unique sent notifications
    // Get the most recent notification for each unique title+body+type combination
    const groupedNotifications = await Notification.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            title: '$title',
            body: '$body',
            type: '$type'
          },
          lastUsedAt: { $max: '$sentAt' },
          firstNotification: { $first: '$$ROOT' },
          count: { $sum: 1 }
        }
      },
      { $sort: { lastUsedAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    // Format notifications for history view
    const formattedNotifications = groupedNotifications.map(group => {
      const notif = group.firstNotification;
      
      // Determine notification type badge
      let notificationTypeBadge = 'Push';
      if (notif.type === 'sms' || notif.type === 'SMS') {
        notificationTypeBadge = 'SMS';
      } else if (notif.type === 'email' || notif.type === 'Email') {
        notificationTypeBadge = 'Email';
      }

      // Get audience from data field (stored when notification was sent)
      let audience = 'All Users';
      if (notif.data && notif.data.targetAudience) {
        audience = notif.data.targetAudience;
      }

      // Use the most recent sentAt time
      const sentAt = group.lastUsedAt || notif.sentAt || notif.createdAt;

      return {
        _id: notif._id,
        title: notif.title || 'Notification',
        message: notif.body,
        notificationType: notificationTypeBadge,
        lastUsedAt: sentAt,
        time: formatTime(sentAt),
        date: formatDate(sentAt),
        audience: audience,
        sentCount: group.count // Number of users who received this notification
      };
    });

    // Get total count of unique notifications
    const totalResult = await Notification.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            title: '$title',
            body: '$body',
            type: '$type'
          }
        }
      },
      { $count: 'total' }
    ]);
    const total = totalResult[0]?.total || 0;

    return res.json({
      success: true,
      message: 'Notification history retrieved successfully',
      data: {
        notifications: formattedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalNotifications: total,
          hasNextPage: (parseInt(page) * parseInt(limit)) < total,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting notification history',
      error: error.message
    });
  }
};

/**
 * Schedule a notification
 * POST /api/admin/notifications/schedule
 */
export const scheduleNotification = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { title, body, notificationType, sessionTitle, targetAudience, country, scheduledAt, userIds } = req.body;

    // Validation
    if (!title || !body || !notificationType || !targetAudience || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: 'Title, body, notification type, target audience, and scheduled date are required'
      });
    }

    if (!['Push', 'SMS', 'Email'].includes(notificationType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification type'
      });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled date. Must be a future date'
      });
    }

    const scheduledNotification = new ScheduledNotification({
      title,
      body,
      notificationType,
      sessionTitle,
      targetAudience,
      country,
      scheduledAt: scheduledDate,
      userIds: userIds || [],
      createdBy: admin._id,
      status: 'scheduled'
    });

    await scheduledNotification.save();

    // TODO: Schedule the actual notification job using a scheduler (e.g., node-cron, agenda, etc.)

    return res.json({
      success: true,
      message: 'Notification scheduled successfully',
      data: scheduledNotification
    });
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Error scheduling notification',
      error: error.message
    });
  }
};

/**
 * Get scheduled notifications
 * GET /api/admin/notifications/scheduled
 */
export const getScheduledNotifications = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { notificationType, search, page = 1, limit = 20 } = req.query;

    const query = {};

    // Filter by notification type
    if (notificationType && notificationType !== 'All') {
      query.notificationType = notificationType;
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
        { sessionTitle: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const scheduledNotifications = await ScheduledNotification.find(query)
      .populate('createdBy', 'name pseudo')
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ScheduledNotification.countDocuments(query);

    return res.json({
      success: true,
      message: 'Scheduled notifications retrieved successfully',
      data: {
        scheduledNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalScheduled: total,
          hasNextPage: skip + scheduledNotifications.length < total,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting scheduled notifications',
      error: error.message
    });
  }
};

/**
 * Update scheduled notification
 * PUT /api/admin/notifications/scheduled/:id
 */
export const updateScheduledNotification = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { id } = req.params;
    const { title, body, notificationType, sessionTitle, targetAudience, country, scheduledAt, userIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scheduled notification ID'
      });
    }

    const scheduledNotification = await ScheduledNotification.findById(id);
    if (!scheduledNotification) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled notification not found'
      });
    }

    // Can't update if already sent
    if (scheduledNotification.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a notification that has already been sent'
      });
    }

    // Update fields
    if (title) scheduledNotification.title = title;
    if (body) scheduledNotification.body = body;
    if (notificationType) scheduledNotification.notificationType = notificationType;
    if (sessionTitle !== undefined) scheduledNotification.sessionTitle = sessionTitle;
    if (targetAudience) scheduledNotification.targetAudience = targetAudience;
    if (country !== undefined) scheduledNotification.country = country;
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduled date. Must be a future date'
        });
      }
      scheduledNotification.scheduledAt = scheduledDate;
    }
    if (userIds) scheduledNotification.userIds = userIds;

    await scheduledNotification.save();

    // TODO: Update the scheduled job

    return res.json({
      success: true,
      message: 'Scheduled notification updated successfully',
      data: scheduledNotification
    });
  } catch (error) {
    console.error('Error updating scheduled notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating scheduled notification',
      error: error.message
    });
  }
};

/**
 * Delete scheduled notification
 * DELETE /api/admin/notifications/scheduled/:id
 */
export const deleteScheduledNotification = async (req, res) => {
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
        message: 'Invalid scheduled notification ID'
      });
    }

    const scheduledNotification = await ScheduledNotification.findByIdAndDelete(id);
    if (!scheduledNotification) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled notification not found'
      });
    }

    // TODO: Cancel the scheduled job

    return res.json({
      success: true,
      message: 'Scheduled notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting scheduled notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting scheduled notification',
      error: error.message
    });
  }
};

/**
 * Helper function to format time (using local timezone)
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  // Use local timezone for display
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes.toString().padStart(2, '0');
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

/**
 * Helper function to format date
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

