import mongoose from 'mongoose';
import StarWallet from '../models/StarWallet.js';
import StarTransaction from '../models/StarTransaction.js';
import Withdrawal from '../models/Withdrawal.js';
import JackpotWithdrawalRequest from '../models/JackpotWithdrawalRequest.js';
import User from '../models/User.js';
import { withdrawFromJackpot, getOrCreateStarWallet } from '../services/starWalletService.js';
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
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : undefined;
};

/**
 * Jackpot metrics (Paid / Pending / Failed) from JackpotWithdrawalRequest.
 * Calendar: use ?date=today or ?from=ISO&to=ISO (to is end-of-day).
 */
export const getJackpotMetrics = async (req, res) => {
  try {
    const { date, from, to } = req.query;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dateFilter = date === 'today' ? { $gte: todayStart } : parseRange(from, to);

    const walletsAgg = await StarWallet.aggregate([{ $group: { _id: null, jackpot: { $sum: '$jackpot' } } }]);
    const totalCurrentJackpot = walletsAgg[0]?.jackpot || 0;

    // Use JackpotWithdrawalRequest (same source as list) – Paid=approved, Pending=pending, Failed=rejected
    const paidMatch = { status: 'approved' };
    if (dateFilter) paidMatch.processedAt = dateFilter;
    const paidToday = await JackpotWithdrawalRequest.aggregate([
      { $match: paidMatch },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const pendingMatch = { status: 'pending' };
    if (dateFilter) pendingMatch.createdAt = dateFilter;
    const pending = await JackpotWithdrawalRequest.aggregate([
      { $match: pendingMatch },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    const failedMatch = { status: 'rejected' };
    if (dateFilter) failedMatch.processedAt = dateFilter;
    const failed = await JackpotWithdrawalRequest.aggregate([
      { $match: failedMatch },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalCurrentJackpot,
        paidToday: { count: paidToday[0]?.count || 0, amount: paidToday[0]?.amount || 0 },
        pending: { count: pending[0]?.count || 0, amount: pending[0]?.amount || 0 },
        failed: { count: failed[0]?.count || 0, amount: failed[0]?.amount || 0 }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listStars = async (req, res) => {
  try {
    const { q, status } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const userMatch = { role: 'star' };
    if (q) {
      const regex = new RegExp(q, 'i');
      userMatch.$or = [{ name: regex }, { pseudo: regex }, { baroniId: regex }];
    }
    const users = await User.find(userMatch)
      .populate('profession', 'name')
      .select('name pseudo profilePic baroniId country contact profession isVerified role')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const ids = users.map((u) => u._id);
    const wallets = await StarWallet.find({ starId: { $in: ids } }).lean();
    const mapWallet = new Map(wallets.map((w) => [String(w.starId), w]));

    // Get today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get all withdrawal requests for these stars
    const withdrawalRequests = await JackpotWithdrawalRequest.find({ starId: { $in: ids } })
      .sort({ createdAt: -1 })
      .lean();

    // Get all withdrawals (completed) for these stars
    const withdrawals = await Withdrawal.find({ starId: { $in: ids } })
      .sort({ createdAt: -1 })
      .lean();

    // Group withdrawal requests and withdrawals by starId
    const requestsByStar = new Map();
    const withdrawalsByStar = new Map();
    const lastWithdrawalByStar = new Map();

    withdrawalRequests.forEach(req => {
      const starId = String(req.starId);
      if (!requestsByStar.has(starId)) {
        requestsByStar.set(starId, []);
      }
      requestsByStar.get(starId).push(req);
    });

    withdrawals.forEach(w => {
      const starId = String(w.starId);
      if (!withdrawalsByStar.has(starId)) {
        withdrawalsByStar.set(starId, []);
      }
      withdrawalsByStar.get(starId).push(w);
      
      // Track last withdrawal
      if (!lastWithdrawalByStar.has(starId)) {
        lastWithdrawalByStar.set(starId, w);
      }
    });

    // Build items with status, today stats, and last withdrawal
    const items = users.map((u) => {
      const starId = String(u._id);
      const wallet = mapWallet.get(starId) || { escrow: 0, jackpot: 0, totalEarned: 0, totalWithdrawn: 0 };
      
      // Get withdrawal requests for this star
      const starRequests = requestsByStar.get(starId) || [];
      const starWithdrawals = withdrawalsByStar.get(starId) || [];
      
      // Determine status: eligible (no pending), pending (has pending request), failed (has rejected request)
      let starStatus = 'eligible';
      const hasPending = starRequests.some(r => r.status === 'pending');
      const hasRejected = starRequests.some(r => r.status === 'rejected');
      
      if (hasPending) {
        starStatus = 'pending';
      } else if (hasRejected) {
        starStatus = 'failed';
      }

      // Calculate today's stats
      const todayRequests = starRequests.filter(r => {
        const reqDate = new Date(r.createdAt);
        return reqDate >= todayStart && reqDate <= todayEnd;
      });
      const todayWithdrawals = starWithdrawals.filter(w => {
        const wDate = new Date(w.createdAt);
        return wDate >= todayStart && wDate <= todayEnd;
      });

      const todayPaid = todayWithdrawals.filter(w => w.status === 'completed').length;
      const todayPaidAmount = todayWithdrawals
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + (w.amount || 0), 0);
      const todayFailed = todayRequests.filter(r => r.status === 'rejected').length;

      // Get last withdrawal
      const lastWithdrawal = lastWithdrawalByStar.get(starId);
      let lastWithdrawalData = null;
      if (lastWithdrawal) {
        lastWithdrawalData = {
          id: lastWithdrawal._id,
          status: lastWithdrawal.status === 'completed' ? 'completed' : lastWithdrawal.status,
          amount: lastWithdrawal.amount || 0
        };
      }

      return {
        starId: u._id,
        name: u.name || u.pseudo,
        pseudo: u.pseudo,
        baroniId: u.baroniId,
        profilePic: u.profilePic,
        country: u.country,
        contact: u.contact,
        profession: u.profession?.name || 'Singer',
        isVerified: u.isVerified,
        wallet: {
          escrow: wallet.escrow || 0,
          jackpot: wallet.jackpot || 0,
          totalEarned: wallet.totalEarned || 0,
          totalWithdrawn: wallet.totalWithdrawn || 0
        },
        status: starStatus,
        today: {
          paid: todayPaid,
          amount: todayPaidAmount,
          failed: todayFailed
        },
        lastWithdrawal: lastWithdrawalData
      };
    });

    // Filter by status if provided
    let filteredItems = items;
    if (status && status !== 'all') {
      filteredItems = items.filter(item => item.status === status);
    }

    // Get total count for pagination (before filtering)
    const totalUsers = await User.countDocuments(userMatch);

    return res.json({ 
      success: true, 
      data: { 
        items: filteredItems, 
        page, 
        limit, 
        total: totalUsers 
      } 
    });
  } catch (err) {
    console.error('Error listing stars:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createWithdrawal = async (req, res) => {
  try {
    const { starId, amount, note } = req.body;
    if (!starId) return res.status(400).json({ success: false, message: 'starId required' });
    
    // Validate starId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid starId format. starId must be a valid MongoDB ObjectId (24 hexadecimal characters)' 
      });
    }
    
    // Convert starId to ObjectId to ensure proper format
    const starObjectId = new mongoose.Types.ObjectId(starId);
    
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

    // Get star wallet - MUST find existing wallet, withdrawal is ONLY from jackpot
    // Use ObjectId for proper MongoDB query matching
    let wallet = await StarWallet.findOne({ starId: starObjectId }).lean();
    
    // If not found, try with string (in case of data inconsistency)
    if (!wallet) {
      wallet = await StarWallet.findOne({ starId: mongoose.Types.ObjectId.isValid(starId) ? new mongoose.Types.ObjectId(starId) : starId }).lean();
    }
    
    // If wallet doesn't exist, create it (but this should be rare - wallet should exist)
    if (!wallet) {
      console.warn(`[AdminJackpot] Wallet not found for starId ${starId}, creating new wallet with 0 balance`);
      const newWallet = await StarWallet.create({ starId: starObjectId });
      wallet = newWallet.toObject ? newWallet.toObject() : newWallet;
    }
    
    // Ensure we have the actual jackpot value (not undefined or null)
    const currentJackpot = wallet.jackpot || 0;
    
    // Optional: Verify that the star exists (warning only, don't block withdrawal)
    const star = await User.findById(starObjectId);
    if (!star) {
      console.warn(`[AdminJackpot] Warning: User not found for starId ${starId}, but wallet exists. Proceeding with withdrawal.`);
    } else if (star.role !== 'star') {
      console.warn(`[AdminJackpot] Warning: User ${starId} does not have 'star' role (current role: ${star.role}), but wallet exists. Proceeding with withdrawal.`);
    }
    
    // Debug: Log wallet details
    console.log(`[AdminJackpot] Wallet details:`, {
      walletId: wallet._id,
      starId: wallet.starId,
      starIdString: String(wallet.starId),
      requestedStarId: starId,
      jackpot: currentJackpot,
      requestedAmount: numericAmount,
      walletObject: wallet
    });
    
    // Withdrawal is ONLY from jackpot amount
    if (currentJackpot < numericAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient jackpot balance',
        data: {
          availableBalance: currentJackpot,
          requestedAmount: numericAmount,
          starId: starId
        }
      });
    }

    // Check if there's already a pending request for this star
    const existingPendingRequest = await JackpotWithdrawalRequest.findOne({
      starId: starObjectId,
      status: 'pending'
    });

    if (existingPendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Star already has a pending withdrawal request. Please approve or reject the existing request first.',
        data: {
          existingRequestId: existingPendingRequest._id,
          existingAmount: existingPendingRequest.amount,
          existingCreatedAt: existingPendingRequest.createdAt
        }
      });
    }

    // IMPORTANT: Deduct amount from jackpot IMMEDIATELY when creating pending request
    // This reserves/holds the amount so it can't be used for other withdrawals
    const session = await mongoose.startSession();
    let withdrawalRequest;
    
    try {
      await session.withTransaction(async () => {
        // Get fresh wallet within transaction
        const walletDoc = await StarWallet.findOne({ starId: starObjectId }).session(session);
        if (!walletDoc) {
          throw new Error('Star wallet not found');
        }
        
        // Verify balance again within transaction
        const walletJackpot = walletDoc.jackpot || 0;
        if (walletJackpot < numericAmount) {
          throw new Error(`Insufficient jackpot balance. Available: ${walletJackpot}, Requested: ${numericAmount}`);
        }
        
        // Deduct from jackpot immediately (reserve the amount)
        walletDoc.jackpot = walletJackpot - numericAmount;
        await walletDoc.save({ session });
        
        console.log(`[CreateWithdrawal] Deducted ${numericAmount} from jackpot. Old: ${walletJackpot}, New: ${walletDoc.jackpot}`);
        
        // Create withdrawal request with 'pending' status
        withdrawalRequest = await JackpotWithdrawalRequest.create([{
          starId: starObjectId,
          amount: numericAmount,
          status: 'pending', // Start as pending, admin must approve
          note: note || undefined
        }], { session });
        
        withdrawalRequest = withdrawalRequest[0];
      });
    } catch (err) {
      console.error('[CreateWithdrawal] Error in transaction:', err);
      throw err;
    } finally {
      await session.endSession();
    }

    // Populate star details for response
    await withdrawalRequest.populate('starId', 'name pseudo profilePic baroniId country contact');
    
    // Get updated wallet balance
    const updatedWallet = await StarWallet.findOne({ starId: starObjectId });

    return res.status(201).json({ 
      success: true, 
      message: 'Withdrawal request created successfully. Amount deducted from jackpot. Waiting for admin approval.',
      data: { 
        id: withdrawalRequest._id,
        withdrawalRequestId: withdrawalRequest._id,
        starId: starObjectId,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        note: withdrawalRequest.note,
        createdAt: withdrawalRequest.createdAt,
        previousBalance: currentJackpot,
        currentBalance: updatedWallet?.jackpot || 0,
        message: 'Use PATCH /api/admin/jackpot/withdrawal-requests/:id/approve to approve, or :id/reject to reject and refund'
      } 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listWithdrawals = async (req, res) => {
  try {
    const { status, from, to, q } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const match = {};
    
    // Map UI status to withdrawal request status
    // UI: paid, pending, failed
    // DB: approved (paid), pending (pending), rejected (failed)
    if (status) {
      if (status === 'paid') {
        match.status = 'approved';
      } else if (status === 'pending') {
        match.status = 'pending';
      } else if (status === 'failed') {
        match.status = 'rejected';
      } else if (status === 'all' || status === '') {
        // Show all - no status filter
      } else {
        match.status = status;
      }
    }
    
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
            page, 
            limit, 
            total: 0 
          } 
        });
      }
    }

    // Query JackpotWithdrawalRequest instead of old Withdrawal model
    const total = await JackpotWithdrawalRequest.countDocuments(match);
    
    // Get withdrawals - use lean but we'll manually populate stars
    const withdrawals = await JackpotWithdrawalRequest.find(match)
      .populate('approvedBy', 'name baroniId')
      .populate('rejectedBy', 'name baroniId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    // Extract all unique starIds to fetch stars in batch
    // Handle both ObjectId objects and strings
    console.log(`[ListWithdrawals] Processing ${withdrawals.length} withdrawals`);
    
    const starIdValues = withdrawals
      .map((w, index) => {
        console.log(`[ListWithdrawals] Withdrawal ${index}: starId type=${typeof w.starId}, value=`, w.starId);
        // Handle different formats of starId
        if (!w.starId) {
          console.warn(`[ListWithdrawals] Withdrawal ${w._id} has null/undefined starId`);
          return null;
        }
        if (typeof w.starId === 'string') {
          console.log(`[ListWithdrawals] starId is string: ${w.starId}`);
          return w.starId;
        }
        if (w.starId._id) {
          const idStr = String(w.starId._id);
          console.log(`[ListWithdrawals] starId has _id property: ${idStr}`);
          return idStr;
        }
        if (w.starId.toString) {
          const idStr = w.starId.toString();
          console.log(`[ListWithdrawals] starId has toString method: ${idStr}`);
          return idStr;
        }
        const idStr = String(w.starId);
        console.log(`[ListWithdrawals] starId converted to string: ${idStr}`);
        return idStr;
      })
      .filter(Boolean);
    
    const uniqueStarIds = [...new Set(starIdValues)];
    console.log(`[ListWithdrawals] Found ${uniqueStarIds.length} unique starIds:`, uniqueStarIds);
    
    // Convert string IDs to ObjectIds for MongoDB query
    const starObjectIds = uniqueStarIds
      .filter(id => {
        const isValid = mongoose.Types.ObjectId.isValid(id);
        if (!isValid) {
          console.warn(`[ListWithdrawals] Invalid ObjectId: ${id}`);
        }
        return isValid;
      })
      .map(id => {
        const objId = new mongoose.Types.ObjectId(id);
        console.log(`[ListWithdrawals] Converted ${id} to ObjectId: ${objId}`);
        return objId;
      });
    
    console.log(`[ListWithdrawals] Converted to ${starObjectIds.length} ObjectIds:`, starObjectIds.map(id => id.toString()));
    
    // Fetch all stars in one query for better performance
    // Include soft-deleted users too (they might have withdrawal requests)
    let stars = [];
    if (starObjectIds.length > 0) {
      console.log(`[ListWithdrawals] Querying User collection with ObjectIds:`, starObjectIds.map(id => id.toString()));
      // Don't filter by isDeleted - include all users (even soft-deleted ones)
      stars = await User.find({ _id: { $in: starObjectIds } })
        .populate('profession', 'name image')
        .select('name pseudo profilePic baroniId country contact profession isVerified role isDeleted deletedAt')
        .lean();
      console.log(`[ListWithdrawals] User.find returned ${stars.length} results`);
      stars.forEach(s => {
        console.log(`[ListWithdrawals] Found star: _id=${s._id}, name=${s.name || s.pseudo}, isDeleted=${s.isDeleted || false}`);
      });
      
      // If we got fewer results than expected, log which IDs are missing
      if (stars.length < starObjectIds.length) {
        const foundIds = new Set(stars.map(s => String(s._id)));
        const missingIds = starObjectIds.filter(id => !foundIds.has(String(id)));
        console.warn(`[ListWithdrawals] Missing ${missingIds.length} users:`, missingIds.map(id => id.toString()));
      }
    } else {
      console.warn(`[ListWithdrawals] No valid ObjectIds to query`);
    }
    
    // Create a map for quick lookup (use both string and ObjectId as keys)
    const starMap = new Map();
    stars.forEach(s => {
      const idString = String(s._id);
      starMap.set(idString, s);
      starMap.set(s._id.toString(), s);
      console.log(`[ListWithdrawals] Added star to map: key=${idString}, name=${s.name || s.pseudo}`);
    });
    
    console.log(`[ListWithdrawals] Star map created with ${starMap.size} entries`);
    
    // Debug: Check if specific starId exists
    if (uniqueStarIds.length > 0) {
      const testStarId = uniqueStarIds[0];
      console.log(`[ListWithdrawals] Testing lookup for starId: ${testStarId}`);
      const testStar = starMap.get(testStarId);
      console.log(`[ListWithdrawals] Test lookup result:`, testStar ? `Found: ${testStar.name || testStar.pseudo}` : 'NOT FOUND');
    }

    // Enrich withdrawals with commission calculations and formatted data
    const enrichedItems = await Promise.all(withdrawals.map(async (withdrawal) => {
      // Get star data from the map we created
      const starIdValue = withdrawal.starId;
      
      // Try multiple formats to find star in map
      let star = null;
      if (starIdValue) {
        // Try different key formats
        const keysToTry = [
          String(starIdValue),
          starIdValue.toString ? starIdValue.toString() : null,
          starIdValue._id ? String(starIdValue._id) : null,
          starIdValue._id?.toString ? starIdValue._id.toString() : null
        ].filter(Boolean);
        
        for (const key of keysToTry) {
          star = starMap.get(key);
          if (star) {
            console.log(`[ListWithdrawals] Found star in map using key: ${key}`);
            break;
          }
        }
      }
      
      // If star not found in map, try to fetch it directly
      if (!star && starIdValue) {
        try {
          // Convert to ObjectId
          let starObjectId;
          if (typeof starIdValue === 'string') {
            starObjectId = mongoose.Types.ObjectId.isValid(starIdValue) 
              ? new mongoose.Types.ObjectId(starIdValue) 
              : null;
          } else if (starIdValue._id) {
            starObjectId = starIdValue._id;
          } else if (starIdValue.toString) {
            const idStr = starIdValue.toString();
            starObjectId = mongoose.Types.ObjectId.isValid(idStr) 
              ? new mongoose.Types.ObjectId(idStr) 
              : null;
          } else {
            starObjectId = starIdValue;
          }
          
          if (starObjectId) {
            // Try to find user (including soft-deleted)
            star = await User.findById(starObjectId)
              .populate('profession', 'name image')
              .select('name pseudo profilePic baroniId country contact profession isVerified role isDeleted deletedAt')
              .lean();
            
            if (star) {
              // Cache it in the map with all possible keys
              const idString = String(star._id);
              starMap.set(idString, star);
              starMap.set(star._id.toString(), star);
              console.log(`[ListWithdrawals] Successfully fetched star ${idString}: ${star.name || star.pseudo}, isDeleted=${star.isDeleted || false}`);
            } else {
              console.warn(`[ListWithdrawals] User not found in database for starId: ${starObjectId}`);
              
              // FALLBACK: Try to get user info from other sources (Appointment, Transaction, etc.)
              let fallbackStarData = null;
              
              // Try to find user info from Appointment
              const Appointment = (await import('../models/Appointment.js')).default;
              const appointment = await Appointment.findOne({ starId: starObjectId })
                .populate('starId', 'name pseudo profilePic baroniId country contact profession')
                .lean();
              
              if (appointment && appointment.starId && typeof appointment.starId === 'object' && appointment.starId.name) {
                console.log(`[ListWithdrawals] Found star info from Appointment for starId ${starObjectId}`);
                fallbackStarData = appointment.starId;
              } else {
                // Try to find from Transaction
                const Transaction = (await import('../models/Transaction.js')).default;
                const transaction = await Transaction.findOne({ 
                  $or: [
                    { receiverId: starObjectId },
                    { payerId: starObjectId }
                  ]
                })
                .populate('receiverId', 'name pseudo profilePic baroniId country contact profession')
                .populate('payerId', 'name pseudo profilePic baroniId country contact profession')
                .lean();
                
                if (transaction) {
                  const userFromTransaction = transaction.receiverId?._id?.toString() === String(starObjectId) 
                    ? transaction.receiverId 
                    : transaction.payerId?._id?.toString() === String(starObjectId)
                      ? transaction.payerId
                      : null;
                  
                  if (userFromTransaction && userFromTransaction.name) {
                    console.log(`[ListWithdrawals] Found star info from Transaction for starId ${starObjectId}`);
                    fallbackStarData = userFromTransaction;
                  }
                }
              }
              
              // If we found fallback data, use it; otherwise create minimal object
              if (fallbackStarData) {
                star = {
                  _id: starObjectId,
                  id: starObjectId,
                  name: fallbackStarData.name || null,
                  pseudo: fallbackStarData.pseudo || null,
                  baroniId: fallbackStarData.baroniId || null,
                  profilePic: fallbackStarData.profilePic || null,
                  country: fallbackStarData.country || null,
                  contact: fallbackStarData.contact || null,
                  profession: fallbackStarData.profession?.name || (typeof fallbackStarData.profession === 'string' ? fallbackStarData.profession : 'Singer'),
                  professionImage: fallbackStarData.profession?.image || null,
                  isVerified: fallbackStarData.isVerified || false,
                  role: 'star',
                  isDeleted: false
                };
              } else {
                // Last resort: Check wallet and create minimal object
                const wallet = await StarWallet.findOne({ starId: starObjectId }).lean();
                if (wallet) {
                  console.log(`[ListWithdrawals] Wallet found for starId ${starObjectId}, creating minimal star object`);
                  star = {
                    _id: starObjectId,
                    id: starObjectId,
                    name: null,
                    pseudo: null,
                    baroniId: null,
                    profilePic: null,
                    country: null,
                    contact: null,
                    profession: { name: 'Singer', image: null },
                    professionImage: null,
                    isVerified: false,
                    role: 'star',
                    isDeleted: false
                  };
                } else {
                  console.error(`[ListWithdrawals] Neither User, Wallet, Appointment, nor Transaction found for starId: ${starObjectId}`);
                }
              }
              
              // Cache it if we created a star object
              if (star) {
                const idString = String(starObjectId);
                starMap.set(idString, star);
                starMap.set(starObjectId.toString(), star);
              }
            }
          }
        } catch (err) {
          console.error(`[ListWithdrawals] Error fetching star ${starIdValue}:`, err.message);
          star = null;
        }
      }
      
      if (!star) {
        console.error(`[ListWithdrawals] Star not found for withdrawal ${withdrawal._id}, starId: ${starIdValue}`);
      }
      
      const approvedBy = withdrawal.approvedBy;
      const rejectedBy = withdrawal.rejectedBy;
      
      // Calculate commission and net amount based on admin commission configuration
      let commissionAmount = 0;
      let netAmount = withdrawal.amount;
      
      try {
        const countryCode = star?.country;
        // Use videoCall service type for jackpot withdrawals (jackpot comes from all services)
        // Admin config will provide country override, service default, or global default
        const commissionRate = await getEffectiveCommission({ 
          serviceType: 'videoCall',
          countryCode 
        });
        const { commission, netAmount: net } = applyCommission(withdrawal.amount, commissionRate);
        commissionAmount = commission;
        netAmount = net;
      } catch (err) {
        console.error('Error calculating withdrawal commission:', err);
        // Fallback: try to get global default from config
        try {
          const CommissionConfig = (await import('../models/CommissionConfig.js')).default;
          const cfg = await CommissionConfig.getSingleton();
          const fallbackRate = cfg.globalDefault || 0.15; // Use global default or 15% as last resort
          const { commission, netAmount: net } = applyCommission(withdrawal.amount, fallbackRate);
          commissionAmount = commission;
          netAmount = net;
        } catch (fallbackErr) {
          console.error('Error getting fallback commission rate:', fallbackErr);
          // Last resort: use 15% (0.15) as default
          const { commission, netAmount: net } = applyCommission(withdrawal.amount, 0.15);
          commissionAmount = commission;
          netAmount = net;
        }
      }
      
      // Map DB status to UI status
      // DB: pending, approved, rejected
      // UI: pending, paid, failed
      let uiStatus = 'pending';
      if (withdrawal.status === 'approved') {
        uiStatus = 'paid';
      } else if (withdrawal.status === 'rejected') {
        uiStatus = 'failed';
      } else if (withdrawal.status === 'pending') {
        uiStatus = 'pending';
      }
      
      // Get error message for failed requests
      let errorMessage = null;
      if (withdrawal.status === 'rejected' && withdrawal.rejectionReason) {
        errorMessage = withdrawal.rejectionReason;
        if (withdrawal.metadata?.error) {
          errorMessage = withdrawal.metadata.error;
        }
      }
      
      // Get operator ID (approvedBy or rejectedBy)
      const operatorId = approvedBy?._id 
        ? approvedBy._id.toString().slice(-8) 
        : rejectedBy?._id 
          ? rejectedBy._id.toString().slice(-8) 
          : 'N/A';
      
      return {
        id: withdrawal._id,
        withdrawalId: withdrawal._id,
        withdrawalRequestId: withdrawal._id,
        status: withdrawal.status, // DB status
        uiStatus: uiStatus, // UI status (paid, pending, failed)
        amount: withdrawal.amount,
        grossAmount: withdrawal.amount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        note: withdrawal.note,
        rejectionReason: withdrawal.rejectionReason,
        errorMessage: errorMessage,
        createdAt: withdrawal.createdAt,
        updatedAt: withdrawal.updatedAt,
        processedAt: withdrawal.processedAt,
        formattedDate: formatDate(withdrawal.createdAt),
        operatorId: operatorId,
        star: star ? {
          id: star._id || star.id || withdrawal.starId,
          name: star.name || star.pseudo || null,
          pseudo: star.pseudo || star.name || null,
          baroniId: star.baroniId || null,
          profilePic: star.profilePic || null,
          country: star.country || null,
          contact: star.contact || null,
          profession: star.profession?.name || (typeof star.profession === 'object' && star.profession?.name ? star.profession.name : (typeof star.profession === 'string' ? star.profession : 'Singer')),
          professionImage: star.profession?.image || null,
          isVerified: star.isVerified || false,
          role: star.role || 'star'
        } : (withdrawal.starId ? {
          // Fallback: Return minimal star object with just the ID if user doesn't exist
          id: withdrawal.starId,
          name: null,
          pseudo: null,
          baroniId: null,
          profilePic: null,
          country: null,
          contact: null,
          profession: 'Singer',
          professionImage: null,
          isVerified: false,
          role: 'star'
        } : null),
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
        metadata: withdrawal.metadata
      };
    }));

    return res.json({ success: true, data: { items: enrichedItems, page, limit, total } });
  } catch (err) {
    console.error('Error listing withdrawals:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved withdrawals can be processed' });
    }
    
    try {
      await withdrawFromJackpot(withdrawal.starId, withdrawal.amount, { adminId: req.user._id });
      withdrawal.status = 'completed';
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      return res.json({ success: true, data: { id: withdrawal._id, status: 'completed' } });
    } catch (err) {
      withdrawal.status = 'failed';
      withdrawal.processedAt = new Date();
      withdrawal.metadata = { ...withdrawal.metadata, error: err.message };
      await withdrawal.save();
      return res.status(400).json({ success: false, message: 'Approval failed: ' + err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved withdrawals can be rejected' });
    }
    
    withdrawal.status = 'rejected';
    withdrawal.processedAt = new Date();
    if (note) withdrawal.note = (withdrawal.note ? withdrawal.note + '\n' : '') + `Rejected: ${note}`;
    await withdrawal.save();
    
    return res.json({ success: true, data: { id: withdrawal._id, status: 'rejected' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const retryWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const w = await Withdrawal.findById(id);
    if (!w) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    if (w.status !== 'failed') return res.status(400).json({ success: false, message: 'Only failed withdrawals can be retried' });
    try {
      await withdrawFromJackpot(w.starId, w.amount, { adminId: req.user._id });
      w.status = 'completed';
      w.processedAt = new Date();
      w.metadata = { ...w.metadata, retriedAt: new Date(), retriedBy: req.user._id };
      await w.save();
      return res.json({ success: true, data: { id: w._id, status: w.status } });
    } catch (err) {
      w.metadata = { ...w.metadata, retryError: err.message };
      await w.save();
      return res.status(400).json({ success: false, message: 'Retry failed: ' + err.message });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


