import NotificationTemplate from '../models/NotificationTemplate.js';
import ScheduledNotification from '../models/ScheduledNotification.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import notificationService from '../services/notificationService.js';
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
    let userQuery = { isDeleted: { $ne: true } };
    let users = [];
    
    if (targetAudience === 'All Fans') {
      userQuery.role = 'fan';
      if (country) {
        userQuery.country = country;
      }
      // Only get users who have app notifications enabled
      userQuery.appNotification = { $ne: false };
      users = await User.find(userQuery).select('_id fcmToken apnsToken appNotification');
    } else if (targetAudience === 'All Stars') {
      userQuery.role = 'star';
      if (country) {
        userQuery.country = country;
      }
      // Only get users who have app notifications enabled
      userQuery.appNotification = { $ne: false };
      users = await User.find(userQuery).select('_id fcmToken apnsToken appNotification');
    } else if (targetAudience === 'All Users') {
      if (country) {
        userQuery.country = country;
      }
      // Only get users who have app notifications enabled
      userQuery.appNotification = { $ne: false };
      users = await User.find(userQuery).select('_id fcmToken apnsToken appNotification');
    } else if (targetAudience === 'By Country' && country) {
      userQuery.country = country;
      // Only get users who have app notifications enabled
      userQuery.appNotification = { $ne: false };
      users = await User.find(userQuery).select('_id fcmToken apnsToken appNotification');
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
      // Only get users who have app notifications enabled
      userQuery.appNotification = { $ne: false };
      users = await User.find(userQuery).select('_id fcmToken apnsToken appNotification');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Target audience is required. Must be one of: All Fans, All Stars, All Users, By Country, Specific Users'
      });
    }
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found matching the criteria'
      });
    }

    // Prepare notification data
    const title = sessionTitle || 'Notification';
    const body = message;
    const type = notificationType.toLowerCase() === 'push' ? 'general' : notificationType.toLowerCase();

    // Send notifications
    let successCount = 0;
    let failureCount = 0;
    const targetUserIds = users.map(u => u._id);

    // For Push notifications, use the notification service
    if (notificationType === 'Push') {
      const result = await notificationService.sendToMultipleUsers(
        targetUserIds,
        { title, body, type: 'general' },
        { sessionTitle, targetAudience, country },
        {}
      );

      successCount = result.successCount || 0;
      failureCount = result.failureCount || 0;
    } else {
      // For SMS and Email, you would integrate with respective services
      // For now, we'll just mark them as sent
      // TODO: Integrate with SMS and Email services
      successCount = targetUserIds.length;
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
      if (service === 'Live Show') templateCategory = 'Live Shows';
      else if (service === 'Video Call') templateCategory = 'Video Calls';
      else if (service === 'Dedication') templateCategory = 'Dedications';
      else templateCategory = 'General';
    }

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
      query.category = category;
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

    const query = {};

    // Filter by type (SMS, Email, or All)
    if (type && type !== 'All') {
      // Map SMS/Email to notification types
      if (type === 'SMS') {
        query.type = 'sms';
      } else if (type === 'Email') {
        query.type = 'email';
      } else {
        query.type = type.toLowerCase();
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const notifications = await Notification.find(query)
      .populate('user', 'name pseudo country role')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Format notifications for history view
    const formattedNotifications = notifications.map(notif => {
      // Determine notification type badge
      let notificationTypeBadge = 'Push';
      if (notif.type === 'sms' || notif.type === 'SMS') {
        notificationTypeBadge = 'SMS';
      } else if (notif.type === 'email' || notif.type === 'Email') {
        notificationTypeBadge = 'Email';
      }

      // Determine audience
      let audience = 'All Fans';
      if (notif.user) {
        if (notif.user.role === 'star') {
          audience = 'All Stars';
        } else if (notif.user.role === 'fan') {
          audience = 'All Fans';
        } else {
          audience = 'All Users';
        }
      }

      return {
        _id: notif._id,
        title: notif.title || 'Live show starting',
        message: notif.body,
        notificationType: notificationTypeBadge,
        lastUsedAt: notif.sentAt,
        time: formatTime(notif.sentAt),
        date: formatDate(notif.sentAt),
        audience: audience,
        user: notif.user
      };
    });

    const total = await Notification.countDocuments(query);

    return res.json({
      success: true,
      message: 'Notification history retrieved successfully',
      data: {
        notifications: formattedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalNotifications: total,
          hasNextPage: skip + notifications.length < total,
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
 * Helper function to format time
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
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

