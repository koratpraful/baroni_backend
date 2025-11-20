import express from 'express';
import {
  addToFavorites,
  removeFromFavorites,
  toggleFavorite,
  getFavorites
} from '../../controllers/favorites.js';
import {
  addToFavoritesValidator,
  removeFromFavoritesValidator,
  toggleFavoriteValidator
} from '../../validators/favoritesValidators.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Allow both fan and star roles to access favorites
router.use(requireRole('fan', 'star'));

router.post('/add', addToFavoritesValidator, addToFavorites);
router.post('/remove', removeFromFavoritesValidator, removeFromFavorites);
router.post('/toggle', toggleFavoriteValidator, toggleFavorite);
router.get('/', getFavorites);

export default router;
