import express from 'express';
import {
  createAndSendNotification,
  createNotificationTemplate,
  getNotificationTemplates,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  getNotificationHistory,
  scheduleNotification,
  getScheduledNotifications,
  updateScheduledNotification,
  deleteScheduledNotification
} from '../../controllers/adminNotificationManagement.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireRole('admin'));

// Create and send notification immediately
router.post('/create', createAndSendNotification);

// Notification Templates
router.post('/templates', createNotificationTemplate);
router.get('/templates', getNotificationTemplates);
router.put('/templates/:id', updateNotificationTemplate);
router.delete('/templates/:id', deleteNotificationTemplate);

// Notification History
router.get('/history', getNotificationHistory);

// Scheduled Notifications
router.post('/schedule', scheduleNotification);
router.get('/scheduled', getScheduledNotifications);
router.put('/scheduled/:id', updateScheduledNotification);
router.delete('/scheduled/:id', deleteScheduledNotification);

export default router;

