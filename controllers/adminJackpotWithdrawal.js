import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import JackpotWithdrawalRequest from '../models/JackpotWithdrawalRequest.js';
import StarWallet from '../models/StarWallet.js';
import StarTransaction from '../models/StarTransaction.js';
import User from '../models/User.js';
import { withdrawFromJackpot } from '../services/starWalletService.js';
import { getEffectiveCommission, applyCommission } from '../utils/commissionHelper.js';

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
};

const parseRange = (from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
};

/**
 * Get jackpot withdrawal metrics (Admin side)
 * GET /api/admin/jackpot/withdrawal-requests/metrics
 */
export const getWithdrawalMetrics = async (req, res) => {
  try {
    const { date, from, to } = req.query;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dateFilter = date === 'today' ? { $gte: todayStart } : parseRange(from, to);

    // Get total current jackpot from all wallets
    const walletsAgg = await StarWallet.aggregate([
      { $group: { _id: null, jackpot: { $sum: '$jackpot' } } }
    ]);
    const totalCurrentJackpot = walletsAgg[0]?.jackpot || 0;

    // Get paid (approved and processed) withdrawals
    const paidToday = await JackpotWithdrawalRequest.aggregate([
      { $match: { status: 'approved', ...(dateFilter ? { processedAt: dateFilter } : {}) } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Get pending withdrawals
    const pending = await JackpotWithdrawalRequest.aggregate([
      { $match: { status: 'pending', ...(dateFilter ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // Get failed/rejected withdrawals (map rejected to failed for UI)
    const failed = await JackpotWithdrawalRequest.aggregate([
      { $match: { status: 'rejected', ...(dateFilter ? { processedAt: dateFilter } : {}) } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalCurrentJackpot,
        paidToday: { 
          count: paidToday[0]?.count || 0, 
          amount: paidToday[0]?.amount || 0 
        },
        pending: { 
          count: pending[0]?.count || 0, 
          amount: pending[0]?.amount || 0 
        },
        failed: { 
          count: failed[0]?.count || 0, 
          amount: failed[0]?.amount || 0 
        }
      }
    });
  } catch (err) {
    console.error('Error getting withdrawal metrics:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * List all withdrawal requests (Admin side)
 * GET /api/admin/jackpot/withdrawal-requests
 */
export const listWithdrawalRequests = async (req, res) => {
  try {
    const { status, from, to, q, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 20)));

    const match = {};
    
    // Status filter - map UI status to DB status
    // UI: all, pending, paid, failed, today
    // DB: pending, approved, rejected
    if (status) {
      if (status === 'paid') {
        match.status = 'approved';
      } else if (status === 'failed') {
        match.status = 'rejected';
      } else if (status === 'pending') {
        match.status = 'pending';
      } else if (status === 'all') {
        // No status filter - show all
      } else if (['pending', 'approved', 'rejected'].includes(status)) {
        match.status = status;
      }
    }
    
    // Today filter
    if (req.query.today === 'true' || req.query.today === true) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: todayStart, $lte: todayEnd };
    }
    
    // Date range filter
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;

    // Search by star name, pseudo, or baroniId
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const matchingStars = await User.find({
        role: 'star',
        $or: [
          { name: searchRegex },
          { pseudo: searchRegex },
          { baroniId: searchRegex }
        ]
      }).select('_id').lean();
      
      const starIds = matchingStars.map(s => s._id);
      if (starIds.length > 0) {
        match.starId = { $in: starIds };
      } else {
        // No matching stars, return empty result
        return res.json({
          success: true,
          data: {
            items: [],
            pagination: {
              currentPage: pageNum,
              totalPages: 0,
              totalCount: 0,
              limit: limitNum,
              hasNextPage: false,
              hasPrevPage: false
            }
          }
        });
      }
    }

    const total = await JackpotWithdrawalRequest.countDocuments(match);
    const requests = await JackpotWithdrawalRequest.find(match)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId country contact profession isVerified role',
        populate: { path: 'profession', select: 'name' }
      })
      .populate('approvedBy', 'name baroniId')
      .populate('rejectedBy', 'name baroniId')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    // Enrich requests with commission calculations and formatted data
    const enrichedItems = await Promise.all(requests.map(async (request) => {
      const star = request.starId;
      const approvedBy = request.approvedBy;
      const rejectedBy = request.rejectedBy;
      
      // Calculate commission and net amount based on admin commission configuration
      let commissionAmount = 0;
      let netAmount = request.amount || 0;
      
      // Ensure amount is a valid number
      const grossAmount = Number(request.amount) || 0;
      
      if (grossAmount > 0) {
        try {
          const countryCode = star?.country;
          // Use videoCall service type for jackpot withdrawals (jackpot comes from all services)
          // Admin config will provide country override, service default, or global default
          const commissionRate = await getEffectiveCommission({ 
            serviceType: 'videoCall',
            countryCode 
          });
          
          if (commissionRate && commissionRate > 0) {
            const { commission, netAmount: net } = applyCommission(grossAmount, commissionRate);
            commissionAmount = commission;
            netAmount = net;
          } else {
            console.warn(`[ListWithdrawalRequests] Invalid commission rate: ${commissionRate}, using fallback`);
            // Fallback to global default
            const CommissionConfig = (await import('../models/CommissionConfig.js')).default;
            const cfg = await CommissionConfig.getSingleton();
            const fallbackRate = cfg.globalDefault || 0.15;
            const { commission, netAmount: net } = applyCommission(grossAmount, fallbackRate);
            commissionAmount = commission;
            netAmount = net;
          }
        } catch (err) {
          console.error('Error calculating withdrawal commission:', err);
          // Fallback: try to get global default from config
          try {
            const CommissionConfig = (await import('../models/CommissionConfig.js')).default;
            const cfg = await CommissionConfig.getSingleton();
            const fallbackRate = cfg.globalDefault || 0.15; // Use global default or 15% as last resort
            const { commission, netAmount: net } = applyCommission(grossAmount, fallbackRate);
            commissionAmount = commission;
            netAmount = net;
          } catch (fallbackErr) {
            console.error('Error getting fallback commission rate:', fallbackErr);
            // Last resort: use 15% (0.15) as default
            const { commission, netAmount: net } = applyCommission(grossAmount, 0.15);
            commissionAmount = commission;
            netAmount = net;
          }
        }
      } else {
        console.warn(`[ListWithdrawalRequests] Invalid or zero amount for request ${request._id}: ${request.amount}`);
      }
      
      // Map DB status to UI status
      let uiStatus = request.status;
      if (request.status === 'approved') {
        uiStatus = 'paid';
      } else if (request.status === 'rejected') {
        uiStatus = 'failed';
      }
      
      // Get error message for failed requests
      let errorMessage = null;
      if (request.status === 'rejected' && request.rejectionReason) {
        errorMessage = request.rejectionReason;
        // If metadata has error, use that
        if (request.metadata?.error) {
          errorMessage = request.metadata.error;
        }
      }
      
      return {
        id: request._id,
        withdrawalRequestId: request._id,
        status: request.status, // DB status
        uiStatus: uiStatus, // UI status (paid, pending, failed)
        amount: request.amount,
        grossAmount: request.amount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        note: request.note,
        rejectionReason: request.rejectionReason,
        errorMessage: errorMessage, // Error message for failed requests
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        processedAt: request.processedAt,
        formattedDate: formatDate(request.createdAt),
        operatorId: approvedBy?._id ? approvedBy._id.toString().slice(-8) : rejectedBy?._id ? rejectedBy._id.toString().slice(-8) : 'N/A',
        star: star ? {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          country: star.country,
          contact: star.contact,
          profession: star.profession?.name || 'Singer',
          isVerified: star.isVerified,
          role: star.role
        } : null,
        approvedBy: approvedBy ? {
          id: approvedBy._id,
          name: approvedBy.name,
          baroniId: approvedBy.baroniId
        } : null,
        rejectedBy: rejectedBy ? {
          id: rejectedBy._id,
          name: rejectedBy.name,
          baroniId: rejectedBy.baroniId
        } : null,
        metadata: request.metadata
      };
    }));

    return res.json({
      success: true,
      data: {
        items: enrichedItems,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalCount: total,
          limit: limitNum,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (err) {
    console.error('Error listing withdrawal requests:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Approve withdrawal request (Admin side)
 * PATCH /api/admin/jackpot/withdrawal-requests/:id/approve
 */
export const approveWithdrawalRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Validation failed'
      });
    }

    const { id } = req.params;
    const { note } = req.body;

    const request = await JackpotWithdrawalRequest.findById(id)
      .populate('starId', 'name pseudo baroniId country');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status: ${request.status}. Only pending requests can be approved.`
      });
    }

    // Get wallet for reference (amount was already deducted when request was created)
    const wallet = await StarWallet.findOne({ starId: request.starId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Star wallet not found'
      });
    }

    // IMPORTANT: Amount was already deducted from jackpot when request was created (pending status)
    // So we don't need to check balance again - the amount is already reserved
    // We just need to update totalWithdrawn and create transaction record
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Get wallet within transaction
        const walletDoc = await StarWallet.findOne({ starId: request.starId }).session(session);
        if (!walletDoc) {
          throw new Error('Star wallet not found');
        }
        
        // Verify that amount was already deducted (current jackpot should be original - amount)
        const currentJackpot = walletDoc.jackpot || 0;
        const expectedJackpotAfterDeduction = currentJackpot; // Current balance already has amount deducted
        
        // Log for verification (amount should already be deducted from jackpot)
        console.log(`[ApproveWithdrawal] Current jackpot: ${currentJackpot}, Request amount: ${request.amount}, Expected original: ${currentJackpot + request.amount}`);
        
        // Amount was already deducted when request was created (pending status)
        // Just update totalWithdrawn to track the withdrawal
        walletDoc.totalWithdrawn = (walletDoc.totalWithdrawn || 0) + request.amount;
        await walletDoc.save({ session });
        
        console.log(`[ApproveWithdrawal] Updated totalWithdrawn. Amount: ${request.amount}, New TotalWithdrawn: ${walletDoc.totalWithdrawn}`);
        
        // Create transaction record
        await StarTransaction.create([{
          starId: request.starId,
          amount: request.amount,
          type: 'withdrawal',
          status: 'completed',
          escrowMovement: 'release',
          completedAt: new Date(),
          fanId: req.user._id // adminId stored as fanId in transaction
        }], { session });
        
        // Update request status to approved within transaction
        request.status = 'approved';
        request.approvedBy = req.user._id;
        request.processedAt = new Date();
        if (note) request.note = (request.note ? request.note + '\n' : '') + `Admin Note: ${note}`;
        await request.save({ session });
        
        console.log(`[ApproveWithdrawal] Updated totalWithdrawn. Amount: ${request.amount}, TotalWithdrawn: ${walletDoc.totalWithdrawn}`);
      });
      
      // Verify wallet was updated correctly
      const updatedWallet = await StarWallet.findOne({ starId: request.starId });
      if (!updatedWallet) {
        throw new Error('Failed to verify wallet update after withdrawal');
      }
      
      console.log(`[ApproveWithdrawal] Request approved successfully. Jackpot: ${updatedWallet.jackpot}, TotalWithdrawn: ${updatedWallet.totalWithdrawn}, Amount: ${request.amount}`);
      
      // Populate for response
      await request.populate('starId', 'name pseudo baroniId');
      await request.populate('approvedBy', 'name baroniId');

      return res.json({
        success: true,
        message: 'Withdrawal request approved and processed successfully',
        data: {
          id: request._id,
          status: request.status,
          amount: request.amount,
          processedAt: request.processedAt,
          wallet: {
            previousJackpot: wallet.jackpot,
            currentJackpot: updatedWallet.jackpot,
            totalWithdrawn: updatedWallet.totalWithdrawn
          }
        }
      });
    } catch (err) {
      console.error('[ApproveWithdrawal] Transaction error:', err);
      
      // Only update to rejected if transaction failed and request is still pending
      // If transaction partially succeeded, we need to handle it carefully
      if (request.status === 'pending') {
        try {
          request.status = 'rejected';
          const errorMsg = err.message || 'Payment processing failed';
          request.rejectionReason = `Payment failed - ${errorMsg}`;
          request.rejectedBy = req.user._id;
          request.processedAt = new Date();
          request.metadata = { ...request.metadata, error: errorMsg };
          await request.save();
        } catch (saveErr) {
          console.error('[ApproveWithdrawal] Error updating request status:', saveErr);
        }
      }

      return res.status(400).json({
        success: false,
        message: 'Failed to process withdrawal: ' + (err.message || 'Unknown error')
      });
    } finally {
      await session.endSession();
    }
  } catch (err) {
    console.error('Error approving withdrawal request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve withdrawal request',
      error: err.message
    });
  }
};

/**
 * Reject withdrawal request (Admin side)
 * PATCH /api/admin/jackpot/withdrawal-requests/:id/reject
 */
export const rejectWithdrawalRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Validation failed'
      });
    }

    const { id } = req.params;
    const { reason, note } = req.body;

    const request = await JackpotWithdrawalRequest.findById(id)
      .populate('starId', 'name pseudo baroniId');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status: ${request.status}. Only pending requests can be rejected.`
      });
    }

    // Update request status to rejected
    request.status = 'rejected';
    request.rejectedBy = req.user._id;
    const rejectionMsg = reason || 'Rejected by admin';
    request.rejectionReason = rejectionMsg.startsWith('Payment failed -') ? rejectionMsg : `Payment failed - ${rejectionMsg}`;
    request.processedAt = new Date();
    request.metadata = { ...request.metadata, error: rejectionMsg };
    if (note) request.note = (request.note ? request.note + '\n' : '') + `Admin Note: ${note}`;
    await request.save();
    
    // Populate for response
    await request.populate('starId', 'name pseudo baroniId');
    await request.populate('rejectedBy', 'name baroniId');

    return res.json({
      success: true,
      message: 'Withdrawal request rejected successfully. Amount was not refunded to jackpot.',
      data: {
        id: request._id,
        status: request.status,
        rejectionReason: request.rejectionReason,
        processedAt: request.processedAt,
        refundedAmount: 0
      }
    });
  } catch (err) {
    console.error('Error rejecting withdrawal request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject withdrawal request',
      error: err.message
    });
  }
};

/**
 * Retry failed/rejected withdrawal request (Admin side)
 * PATCH /api/admin/jackpot/withdrawal-requests/:id/retry
 */
export const retryWithdrawalRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({
        success: false,
        message: errorMessage || 'Validation failed'
      });
    }

    const { id } = req.params;
    const { note } = req.body;

    const request = await JackpotWithdrawalRequest.findById(id)
      .populate('starId', 'name pseudo baroniId country');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Only allow retrying rejected requests (failed payments)
    if (request.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Cannot retry request with status: ${request.status}. Only rejected (failed) requests can be retried.`
      });
    }

    // Get wallet for reference
    const wallet = await StarWallet.findOne({ starId: request.starId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Star wallet not found'
      });
    }

    // IMPORTANT: Amount was already deducted when request was created (pending status)
    // Even though request was rejected, amount was NOT refunded (as per design)
    // So we don't need to deduct again or check balance
    // We just need to update status and totalWithdrawn
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Get wallet within transaction
        const walletDoc = await StarWallet.findOne({ starId: request.starId }).session(session);
        if (!walletDoc) {
          throw new Error('Star wallet not found');
    }

        // Amount was already deducted when request was created
        // Just update totalWithdrawn (if not already updated)
        walletDoc.totalWithdrawn = (walletDoc.totalWithdrawn || 0) + request.amount;
        await walletDoc.save({ session });
        
        // Create transaction record
        await StarTransaction.create([{
          starId: request.starId,
          amount: request.amount,
          type: 'withdrawal',
          status: 'completed',
          escrowMovement: 'release',
          completedAt: new Date(),
          fanId: req.user._id // adminId stored as fanId in transaction
        }], { session });
      
        // Update request status to approved
      request.status = 'approved';
      request.approvedBy = req.user._id;
      request.rejectedBy = null; // Clear rejectedBy since it's now approved
      request.rejectionReason = null; // Clear rejection reason
      request.processedAt = new Date();
      request.metadata = { 
        ...request.metadata, 
        retriedAt: new Date(), 
        retriedBy: req.user._id,
        originalError: request.metadata?.error // Keep original error for reference
      };
        if (note) request.note = (request.note ? request.note + '\n' : '') + `Admin Note: ${note}`;
        await request.save({ session });
        
        console.log(`[RetryWithdrawal] Request retried successfully. Amount: ${request.amount}, TotalWithdrawn: ${walletDoc.totalWithdrawn}`);
      });
      
      // Verify wallet was updated correctly
      const updatedWallet = await StarWallet.findOne({ starId: request.starId });
      if (!updatedWallet) {
        throw new Error('Failed to verify wallet update after retry');
      }

      // Populate for response
      await request.populate('starId', 'name pseudo baroniId');
      await request.populate('approvedBy', 'name baroniId');

      return res.json({
        success: true,
        message: 'Withdrawal request retried and processed successfully',
        data: {
          id: request._id,
          status: request.status,
          amount: request.amount,
          processedAt: request.processedAt,
          wallet: {
            previousJackpot: wallet.jackpot,
            currentJackpot: updatedWallet.jackpot,
            totalWithdrawn: updatedWallet.totalWithdrawn
          }
        }
      });
    } catch (err) {
      console.error('[RetryWithdrawal] Transaction error:', err);
      
      // Only update to rejected if transaction failed and request is still rejected
      if (request.status === 'rejected') {
        try {
      request.metadata = { 
        ...request.metadata, 
        retryError: err.message,
        retriedAt: new Date(),
        retriedBy: req.user._id
      };
      if (note) request.note = (request.note ? request.note + '\n' : '') + `Retry Failed: ${note}`;
      await request.save();
        } catch (saveErr) {
          console.error('[RetryWithdrawal] Error updating request status:', saveErr);
        }
      }

      return res.status(400).json({
        success: false,
        message: 'Failed to retry withdrawal: ' + (err.message || 'Unknown error')
      });
    } finally {
      await session.endSession();
    }
  } catch (err) {
    console.error('Error retrying withdrawal request:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retry withdrawal request',
      error: err.message
    });
  }
};

/**
 * Get withdrawal request details (Admin side)
 * GET /api/admin/jackpot/withdrawal-requests/:id
 */
export const getWithdrawalRequestDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await JackpotWithdrawalRequest.findById(id)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId country contact profession isVerified role',
        populate: { path: 'profession', select: 'name' }
      })
      .populate('approvedBy', 'name baroniId')
      .populate('rejectedBy', 'name baroniId')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Get star wallet for current balance
    const wallet = await StarWallet.findOne({ starId: request.starId }).lean();

    // Calculate commission based on admin commission configuration
    let commissionAmount = 0;
    let netAmount = request.amount || 0;
    
    // Ensure amount is a valid number
    const grossAmount = Number(request.amount) || 0;
    
    if (grossAmount > 0) {
      try {
        const countryCode = request.starId?.country;
        // Use videoCall service type for jackpot withdrawals (jackpot comes from all services)
        // Admin config will provide country override, service default, or global default
        const commissionRate = await getEffectiveCommission({ 
          serviceType: 'videoCall',
          countryCode 
        });
        
        if (commissionRate && commissionRate > 0) {
          const { commission, netAmount: net } = applyCommission(grossAmount, commissionRate);
          commissionAmount = commission;
          netAmount = net;
        } else {
          console.warn(`[GetWithdrawalRequestDetails] Invalid commission rate: ${commissionRate}, using fallback`);
          // Fallback to global default
          const CommissionConfig = (await import('../models/CommissionConfig.js')).default;
          const cfg = await CommissionConfig.getSingleton();
          const fallbackRate = cfg.globalDefault || 0.15;
          const { commission, netAmount: net } = applyCommission(grossAmount, fallbackRate);
          commissionAmount = commission;
          netAmount = net;
        }
      } catch (err) {
        console.error('Error calculating withdrawal commission:', err);
        // Fallback: try to get global default from config
        try {
          const CommissionConfig = (await import('../models/CommissionConfig.js')).default;
          const cfg = await CommissionConfig.getSingleton();
          const fallbackRate = cfg.globalDefault || 0.15; // Use global default or 15% as last resort
          const { commission, netAmount: net } = applyCommission(grossAmount, fallbackRate);
          commissionAmount = commission;
          netAmount = net;
        } catch (fallbackErr) {
          console.error('Error getting fallback commission rate:', fallbackErr);
          // Last resort: use 15% (0.15) as default
          const { commission, netAmount: net } = applyCommission(grossAmount, 0.15);
          commissionAmount = commission;
          netAmount = net;
        }
      }
    } else {
      console.warn(`[GetWithdrawalRequestDetails] Invalid or zero amount for request ${request._id}: ${request.amount}`);
    }

    // Map DB status to UI status
    let uiStatus = request.status;
    if (request.status === 'approved') {
      uiStatus = 'paid';
    } else if (request.status === 'rejected') {
      uiStatus = 'failed';
    }
    
    // Get error message for failed requests
    let errorMessage = null;
    if (request.status === 'rejected' && request.rejectionReason) {
      errorMessage = request.rejectionReason;
      // If metadata has error, use that
      if (request.metadata?.error) {
        errorMessage = request.metadata.error;
      }
    }

    return res.json({
      success: true,
      data: {
        id: request._id,
        status: request.status, // DB status
        uiStatus: uiStatus, // UI status (paid, pending, failed)
        amount: request.amount,
        grossAmount: request.amount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        note: request.note,
        rejectionReason: request.rejectionReason,
        errorMessage: errorMessage, // Error message for failed requests
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        processedAt: request.processedAt,
        formattedDate: formatDate(request.createdAt),
        operatorId: request.approvedBy?._id ? request.approvedBy._id.toString().slice(-8) : request.rejectedBy?._id ? request.rejectedBy._id.toString().slice(-8) : 'N/A',
        star: request.starId ? {
          id: request.starId._id,
          name: request.starId.name,
          pseudo: request.starId.pseudo,
          baroniId: request.starId.baroniId,
          profilePic: request.starId.profilePic,
          country: request.starId.country,
          contact: request.starId.contact,
          profession: request.starId.profession?.name || 'Singer',
          isVerified: request.starId.isVerified
        } : null,
        wallet: wallet ? {
          jackpot: wallet.jackpot,
          escrow: wallet.escrow,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn
        } : null,
        approvedBy: request.approvedBy ? {
          id: request.approvedBy._id,
          name: request.approvedBy.name,
          baroniId: request.approvedBy.baroniId
        } : null,
        rejectedBy: request.rejectedBy ? {
          id: request.rejectedBy._id,
          name: request.rejectedBy.name,
          baroniId: request.rejectedBy.baroniId
        } : null,
        metadata: request.metadata
      }
    });
  } catch (err) {
    console.error('Error getting withdrawal request details:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve withdrawal request details',
      error: err.message
    });
  }
};

