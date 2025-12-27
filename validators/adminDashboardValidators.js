import { query, body, param } from 'express-validator';

// Dashboard Summary Validator
export const dashboardSummaryValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Revenue Insights Validator
export const revenueInsightsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Active Users by Country Validator
export const activeUsersByCountryValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Cost Evaluation Validator
export const costEvaluationValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Service Insights Validator
export const serviceInsightsValidator = [
  param('serviceType')
    .isIn(['video-call', 'live-show', 'dedication'])
    .withMessage('Service type must be one of: video-call, live-show, dedication'),
  
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Top Stars Validator
export const topStarsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['revenue', 'engagement'])
    .withMessage('Sort by must be one of: revenue, engagement')
];

// Complete Dashboard Validator
export const completeDashboardValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Service Revenue Breakdown Validator
export const serviceRevenueBreakdownValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Device Change Stats Validator
export const deviceChangeStatsValidator = [
  query('period')
    .optional()
    .isIn(['current_month', 'last_month', 'last_7_days', 'last_30_days'])
    .withMessage('Period must be one of: current_month, last_month, last_7_days, last_30_days')
];

// Reported Users Details Validator
export const reportedUsersDetailsValidator = [
  query('status')
    .optional()
    .isIn(['pending', 'reviewed', 'resolved', 'dismissed'])
    .withMessage('Status must be one of: pending, reviewed, resolved, dismissed'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
];

// Event Creation Validator
export const createEventValidator = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('type')
    .optional()
    .isIn(['event', 'ad', 'promotion', 'announcement'])
    .withMessage('Type must be one of: event, ad, promotion, announcement'),
  
  body('eventDate')
    .notEmpty()
    .withMessage('Event date is required')
    .custom((value) => {
      // Accept both ISO 8601 format and YYYY-MM-DD format
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Event date must be a valid date');
      }
      return true;
    })
    .withMessage('Event date must be a valid date'),
  
  body('eventTime')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      // Accept time in HH:mm or HH:mm:ss format
      const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      if (!timePattern.test(value)) {
        throw new Error('Event time must be in HH:mm or HH:mm:ss format');
      }
      return true;
    })
    .withMessage('Event time must be in HH:mm or HH:mm:ss format'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('targetAudience')
    .optional()
    .isIn(['all', 'fans', 'stars', 'specific_country'])
    .withMessage('Target audience must be one of: all, fans, stars, specific_country'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number')
];

// Get Events Validator
export const getEventsValidator = [
  query('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Status must be one of: draft, active, paused, completed, cancelled'),
  
  query('type')
    .optional()
    .isIn(['event', 'ad', 'promotion', 'announcement'])
    .withMessage('Type must be one of: event, ad, promotion, announcement'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
];

// Update Event Status Validator
export const updateEventStatusValidator = [
  param('eventId')
    .isMongoId()
    .withMessage('Event ID must be a valid MongoDB ObjectId'),
  
  body('status')
    .isIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Status must be one of: draft, active, paused, completed, cancelled')
];

// Update Event Validator
export const updateEventValidator = [
  param('eventId')
    .isMongoId()
    .withMessage('Event ID must be a valid MongoDB ObjectId'),
  
  body('title')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('Title must be between 3 and 100 characters'),
  
  body('type')
    .optional()
    .isIn(['event', 'ad', 'promotion', 'announcement'])
    .withMessage('Type must be one of: event, ad, promotion, announcement'),
  
  body('eventDate')
    .optional()
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('Event date must be a valid date');
      }
      return true;
    })
    .withMessage('Event date must be a valid date'),
  
  body('eventTime')
    .optional()
    .trim()
    .custom((value) => {
      if (!value || value.trim() === '') return true;
      const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      if (!timePattern.test(value)) {
        throw new Error('Event time must be in HH:mm or HH:mm:ss format');
      }
      return true;
    })
    .withMessage('Event time must be in HH:mm or HH:mm:ss format'),
  
  body('endDate')
    .optional()
    .custom((value) => {
      if (!value || value === '') return true;
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('End date must be a valid date');
      }
      return true;
    })
    .withMessage('End date must be a valid date'),
  
  body('targetAudience')
    .optional()
    .isIn(['all', 'fans', 'stars', 'specific_country'])
    .withMessage('Target audience must be one of: all, fans, stars, specific_country'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  body('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Status must be one of: draft, active, paused, completed, cancelled'),
  
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number')
];

// Delete Event Validator
export const deleteEventValidator = [
  param('eventId')
    .isMongoId()
    .withMessage('Event ID must be a valid MongoDB ObjectId')
];

// Top Stars List Validator
export const topStarsListValidator = [
  query('filter')
    .optional()
    .isIn(['income', 'videoCalls', 'dedications'])
    .withMessage('Filter must be one of: income, videoCalls, dedications')
];