import express from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { createEvent, getEvents, updateEventStatus, deleteEvent } from '../../controllers/adminDashboard.js';
import { createEventValidator, getEventsValidator, updateEventStatusValidator, deleteEventValidator } from '../../validators/adminDashboardValidators.js';
import { uploadEvent } from '../../middlewares/upload.js';

const router = express.Router();

// All event routes require admin authentication
router.use(requireAuth);
router.use(requireRole('admin'));

// Event Management Routes
// Support both JSON and form-data (with optional image upload)
router.post('/', uploadEvent.single('image'), createEventValidator, createEvent);
router.get('/', getEventsValidator, getEvents);
router.patch('/:eventId/status', updateEventStatusValidator, updateEventStatus);
router.delete('/:eventId', deleteEventValidator, deleteEvent);

export default router;
