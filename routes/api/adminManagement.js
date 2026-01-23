import express from 'express';
import {
  getAllUsers,
  getUserDetails,
  getManagementUserProfile,
  getManagementUserOverview,
  updateManagementUserProfile,
  uploadUserProfilePicture,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getUserStats
} from '../../controllers/userManagement.js';
import { uploadVideoOnly, upload } from '../../middlewares/upload.js';
import {
  getAllStars,
  getStarProfile,
  updateStarProfile,
  getStarServices,
  addStarService,
  updateStarService,
  deleteStarService,
  getStarDedications,
  deleteStarDedication,
  getStarDedicationSamples,
  addStarDedicationSample,
  updateStarDedicationSample,
  deleteStarDedicationSample,
  toggleFeaturedStar,
  getFeaturedStars,
  bulkUpdateFeaturedStars,
  updateStarStatus,
  resetStarPassword,
  deleteStar,
  updateStarVerifiedStatus,
  updateStarIntroVideo,
  adminDeleteSlot,
  adminDeleteSlotsByDate
} from '../../controllers/starManagement.js';
import {
  getAllReviews,
  getReviewDetails,
  updateReview,
  deleteReview,
  getStarReviews,
  getReviewStats
} from '../../controllers/reviewManagement.js';
import {
  getAllReportedUsers,
  getReportedUserDetails,
  updateReportStatus,
  blockReportedUser,
  unblockReportedUser,
  deleteReport,
  getReportedUsersStats,
  getReportedUsersGrouped
} from '../../controllers/reportedUsersManagement.js';
import {
  getAllUsersValidator,
  getUserDetailsValidator,
  getManagementUserProfileValidator,
  getManagementUserOverviewValidator,
  updateManagementUserProfileValidator,
  uploadUserProfilePictureValidator,
  updateUserStatusValidator,
  updateUserRoleValidator,
  deleteUserValidator,
  getUserStatsValidator,
  getAllStarsValidator,
  getStarProfileValidator,
  updateStarProfileValidator,
  getStarServicesValidator,
  addStarServiceValidator,
  updateStarServiceValidator,
  deleteStarServiceValidator,
  getStarDedicationsValidator,
  deleteStarDedicationValidator,
  getStarDedicationSamplesValidator,
  addStarDedicationSampleValidator,
  updateStarDedicationSampleValidator,
  deleteStarDedicationSampleValidator,
  updateStarStatusValidator,
  resetStarPasswordValidator,
  deleteStarValidator,
  updateStarVerifiedStatusValidator,
  updateStarIntroVideoValidator,
  adminDeleteSlotValidator,
  adminDeleteSlotsByDateValidator,
  getAllReviewsValidator,
  getReviewDetailsValidator,
  updateReviewValidator,
  deleteReviewValidator,
  getStarReviewsValidator,
  getReviewStatsValidator,
  getAllReportedUsersValidator,
  getReportedUserDetailsValidator,
  updateReportStatusValidator,
  blockReportedUserValidator,
  unblockReportedUserValidator,
  deleteReportValidator,
  getReportedUsersStatsValidator
} from '../../validators/adminManagementValidators.js';
import { requireAuth, requireRole } from '../../middlewares/auth.js';

const router = express.Router();

// All management routes require admin authentication
router.use(requireAuth);
router.use(requireRole('admin'));

// ==================== USER MANAGEMENT ROUTES ====================

// Get all users with filtering and search
router.get('/users', getAllUsersValidator, getAllUsers);

// Get user details by ID
router.get('/users/:userId', getUserDetailsValidator, getUserDetails);

// Unified profile fetch (fan or star) by ID
router.get('/user/:id', getManagementUserProfileValidator, getManagementUserProfile);

// Overview metrics (fan or star) by ID with period filter
router.get('/user/:id/overview', getManagementUserOverviewValidator, getManagementUserOverview);

// Update profile (fan or star) by ID (supports both PATCH and PUT)
router.patch('/user/:id', updateManagementUserProfileValidator, updateManagementUserProfile);
router.put('/user/:id', updateManagementUserProfileValidator, updateManagementUserProfile);

// Upload profile picture for fan or star (admin only)
router.post('/user/:id/profile-picture', upload.single('profilePic'), uploadUserProfilePictureValidator, uploadUserProfilePicture);

// Update user status (block/unblock)
router.patch('/users/:userId/status', updateUserStatusValidator, updateUserStatus);

// Update user role
router.patch('/users/:userId/role', updateUserRoleValidator, updateUserRole);

// Delete user (soft delete)
router.delete('/users/:userId', deleteUserValidator, deleteUser);

// Get user statistics
router.get('/users-stats', getUserStatsValidator, getUserStats);

// ==================== STAR MANAGEMENT ROUTES ====================

// Get all stars with filtering and search
router.get('/stars', getAllStarsValidator, getAllStars);

// Get star profile details
router.get('/stars/:starId', getStarProfileValidator, getStarProfile);

// Update star profile
router.put('/stars/:starId', updateStarProfileValidator, updateStarProfile);

// Get star services
router.get('/stars/:starId/services', getStarServicesValidator, getStarServices);

// Add star service
router.post('/stars/:starId/services', addStarServiceValidator, addStarService);

// Update star service
router.put('/stars/:starId/services/:serviceId', updateStarServiceValidator, updateStarService);

// Delete star service
router.delete('/stars/:starId/services/:serviceId', deleteStarServiceValidator, deleteStarService);

// Get star dedications (charges)
router.get('/stars/:starId/dedications', getStarDedicationsValidator, getStarDedications);

// Delete star dedication (charges)
router.delete('/stars/:starId/dedications/:dedicationId', deleteStarDedicationValidator, deleteStarDedication);

// Get star dedication samples
router.get('/stars/:starId/dedication-samples', getStarDedicationSamplesValidator, getStarDedicationSamples);

// Add star dedication sample (supports file upload or video URL)
router.post('/stars/:starId/dedication-samples', uploadVideoOnly.single('video'), addStarDedicationSampleValidator, addStarDedicationSample);

// Update star dedication sample (supports file upload or video URL)
router.put('/stars/:starId/dedication-samples/:sampleId', uploadVideoOnly.single('video'), updateStarDedicationSampleValidator, updateStarDedicationSample);

// Delete star dedication sample
router.delete('/stars/:starId/dedication-samples/:sampleId', deleteStarDedicationSampleValidator, deleteStarDedicationSample);

// Admin: Delete a single time slot
router.delete('/stars/:starId/availabilities/:availabilityId/slots/:slotId', adminDeleteSlotValidator, adminDeleteSlot);

// Admin: Delete all slots for a specific date
router.delete('/stars/:starId/availabilities/date', adminDeleteSlotsByDateValidator, adminDeleteSlotsByDate);

// ==================== REVIEW MANAGEMENT ROUTES ====================

// Get all reviews with filtering and search
router.get('/reviews', getAllReviewsValidator, getAllReviews);

// Get review details by ID
router.get('/reviews/:reviewId', getReviewDetailsValidator, getReviewDetails);

// Update review
router.put('/reviews/:reviewId', updateReviewValidator, updateReview);

// Delete review
router.delete('/reviews/:reviewId', deleteReviewValidator, deleteReview);

// Get reviews for a specific star
router.get('/stars/:starId/reviews', getStarReviewsValidator, getStarReviews);

// Get review statistics
router.get('/reviews-stats', getReviewStatsValidator, getReviewStats);

// ==================== REPORTED USERS MANAGEMENT ROUTES ====================

// Get reported users grouped by user (for Reported Users screen)
router.get('/reported-users-grouped', getAllReportedUsersValidator, getReportedUsersGrouped);

// Get all reported users with filtering and search
router.get('/reported-users', getAllReportedUsersValidator, getAllReportedUsers);

// Get reported user details by ID
router.get('/reported-users/:reportId', getReportedUserDetailsValidator, getReportedUserDetails);

// Update report status
router.patch('/reported-users/:reportId/status', updateReportStatusValidator, updateReportStatus);

// Block reported user
router.post('/reported-users/:reportId/block', blockReportedUserValidator, blockReportedUser);

// Unblock reported user
router.post('/reported-users/:reportId/unblock', unblockReportedUserValidator, unblockReportedUser);

// Delete report
router.delete('/reported-users/:reportId', deleteReportValidator, deleteReport);

// Get reported users statistics
router.get('/reported-users-stats', getReportedUsersStatsValidator, getReportedUsersStats);

// ==================== FEATURED STAR MANAGEMENT ROUTES ====================

// Toggle featured star status for a specific star
router.patch('/stars/:starId/feature', toggleFeaturedStar);

// Get all featured stars
router.get('/featured-stars', getFeaturedStars);

// Bulk update featured stars
router.patch('/stars/bulk-feature', bulkUpdateFeaturedStars);

// Update star status (block/unblock)
router.patch('/stars/:starId/status', updateStarStatusValidator, updateStarStatus);

// Reset star password
router.post('/stars/:starId/reset-password', resetStarPasswordValidator, resetStarPassword);

// Delete star (soft delete)
router.delete('/stars/:starId', deleteStarValidator, deleteStar);

// Update star verified status
router.patch('/stars/:starId/verified', updateStarVerifiedStatusValidator, updateStarVerifiedStatus);

// Update star intro video
router.patch('/stars/:starId/intro-video', updateStarIntroVideoValidator, updateStarIntroVideo);

export default router;
