import express from 'express';
import { getGuestStarById } from '../../controllers/star.js';
import { getGuestDashboard } from '../../controllers/dashboard.js';

const router = express.Router();

// Public guest routes (no auth)
router.get('/dashboard', getGuestDashboard);
router.get('/star/:id', getGuestStarById);

export default router;


