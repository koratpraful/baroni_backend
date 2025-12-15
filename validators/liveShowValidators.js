import { body } from 'express-validator';

export const createLiveShowValidator = [
  body('sessionTitle')
    .notEmpty().withMessage('Session title is required')
    .trim().isLength({ min: 3, max: 100 }).withMessage('Session title must be between 3 and 100 characters'),
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid ISO 8601 date')
    .custom((value) => {
      const showDate = new Date(value);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfToday.getDate() + 1);
      const allowToday = String(process.env.LIVESHOW_TODAY || '').toLowerCase() === 'true';
      const earliestAllowed = allowToday ? startOfToday : startOfTomorrow;
      if (isNaN(showDate.getTime()) || showDate < earliestAllowed) {
        throw new Error(allowToday ? 'Show date must be today or later' : 'Show date must be from tomorrow onwards');
      }
      return true;
    }),
  body('time')
    .notEmpty().withMessage('Time is required')
    .isString().withMessage('Time must be a string'),
  body('attendanceFee')
    .notEmpty().withMessage('Attendance fee is required')
    .isNumeric().withMessage('Attendance fee must be a number')
    .isFloat({ min: 0 }).withMessage('Attendance fee must be non-negative'),
  body('hostingPrice')
    .notEmpty().withMessage('Hosting price is required')
    .isNumeric().withMessage('Hosting price must be a number')
    .isFloat({ min: 0 }).withMessage('Hosting price must be non-negative'),
  body('maxCapacity')
    .optional()
    .custom((value) => {
      if (value === 'unlimited') return true;
      if (typeof value === 'string' && Number(value) > 0) return true;
      throw new Error('Max capacity must be "unlimited" or a positive number');
    }),
  body('description')
    .optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('thumbnail')
    .optional().isURL().withMessage('Thumbnail must be a valid URL'),
];

export const updateLiveShowValidator = [
  body('sessionTitle')
    .optional().trim().isLength({ min: 3, max: 100 }).withMessage('Session title must be between 3 and 100 characters'),
  body('date')
    .optional().isISO8601().withMessage('Date must be a valid ISO 8601 date')
    .custom((value) => {
      const showDate = new Date(value);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfToday.getDate() + 1);
      const allowToday = String(process.env.LIVESHOW_TODAY || '').toLowerCase() === 'true';
      const earliestAllowed = allowToday ? startOfToday : startOfTomorrow;
      if (isNaN(showDate.getTime()) || showDate < earliestAllowed) {
        throw new Error(allowToday ? 'Show date must be today or later' : 'Show date must be from tomorrow onwards');
      }
      return true;
    }),
  body('time')
    .optional().isString().withMessage('Time must be a string'),
  body('attendanceFee')
    .optional().isNumeric().withMessage('Attendance fee must be a number')
    .isFloat({ min: 0 }).withMessage('Attendance fee must be non-negative'),
  body('hostingPrice')
    .optional().isNumeric().withMessage('Hosting price must be a number')
    .isFloat({ min: 0 }).withMessage('Hosting price must be non-negative'),
  body('maxCapacity')
    .optional().custom((value) => {
      if (value === 'unlimited') return true;
      if (typeof value === 'number' && value > 0) return true;
      throw new Error('Max capacity must be "unlimited" or a positive number');
    }),
  body('description')
    .optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('thumbnail')
    .optional().isURL().withMessage('Thumbnail must be a valid URL'),
];

export const rescheduleLiveShowValidator = [
  body('date').optional().isISO8601().withMessage('Date must be valid ISO 8601'),
  body('time').optional().isString().withMessage('Time must be a string')
];
