import express from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import {
  getAppointmentsWithFilters,
  getAppointmentStatistics,
  approveAppointment,
  rejectAppointment,
  rescheduleAppointment,
  cancelAppointment,
  getAppointmentDetails,
  getLiveShowAppointments,
  getDedicationAppointments
} from '../../controllers/adminAppointmentManagement.js';

const router = express.Router();

// Apply authentication and admin role middleware to all routes
router.use(requireAuth);
router.use(requireRole('admin'));

// Validation middleware
const appointmentIdValidator = [
  param('appointmentId').isMongoId().withMessage('Invalid appointment ID')
];

const appointmentFiltersValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('category').optional().isIn(['all', 'video_calls', 'dedications', 'live_shows']).withMessage('Invalid category'),
  query('status').optional().isIn(['all', 'pending', 'approved', 'rejected', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'date', 'price']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

const statisticsValidator = [
  query('period').optional().isIn(['current_month', 'last_month', 'current_year', 'last_7_days', 'last_30_days']).withMessage('Invalid period'),
  query('category').optional().isIn(['all', 'video_calls', 'dedications', 'live_shows']).withMessage('Invalid category')
];

const approveAppointmentValidator = [
  ...appointmentIdValidator,
  body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
];

const rejectAppointmentValidator = [
  ...appointmentIdValidator,
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
];

const rescheduleAppointmentValidator = [
  ...appointmentIdValidator,
  body('newDateTime').isISO8601().withMessage('New date time must be a valid ISO date'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
];

const cancelAppointmentValidator = [
  ...appointmentIdValidator,
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('refundAmount').optional().isNumeric().withMessage('Refund amount must be a number'),
  body('adminNotes').optional().isString().withMessage('Admin notes must be a string')
];

// Middleware to prevent reserved route names from being treated as appointment IDs
const checkReservedRoutes = (req, res, next) => {
  const reservedRoutes = ['dedications', 'live-shows', 'statistics'];
  if (reservedRoutes.includes(req.params.appointmentId)) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found'
    });
  }
  next();
};

// Routes

// GET /api/admin/appointments - Get appointments with filters
router.get('/', appointmentFiltersValidator, getAppointmentsWithFilters);

// GET /api/admin/appointments/statistics - Get appointment statistics
router.get('/statistics', statisticsValidator, getAppointmentStatistics);

// GET /api/admin/appointments/live-shows - Get live show appointments
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/live-shows', appointmentFiltersValidator, getLiveShowAppointments);

// GET /api/admin/appointments/dedications - Get dedication appointments
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/dedications', appointmentFiltersValidator, getDedicationAppointments);

// GET /api/admin/appointments/:appointmentId - Get appointment details

router.get('/:appointmentId', checkReservedRoutes, appointmentIdValidator, getAppointmentDetails);

// PUT /api/admin/appointments/:appointmentId/approve - Approve appointment
router.put('/:appointmentId/approve', checkReservedRoutes, approveAppointmentValidator, approveAppointment);

// PUT /api/admin/appointments/:appointmentId/reject - Reject appointment
router.put('/:appointmentId/reject', checkReservedRoutes, rejectAppointmentValidator, rejectAppointment);

// PUT /api/admin/appointments/:appointmentId/reschedule - Reschedule appointment
router.put('/:appointmentId/reschedule', checkReservedRoutes, rescheduleAppointmentValidator, rescheduleAppointment);

// PUT /api/admin/appointments/:appointmentId/cancel - Cancel appointment
router.put('/:appointmentId/cancel', checkReservedRoutes, cancelAppointmentValidator, cancelAppointment);

export default router;
