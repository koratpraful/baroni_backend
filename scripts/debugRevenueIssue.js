import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { getOrCreateStarWallet } from '../services/starWalletService.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

const debugRevenueIssue = async () => {
  try {
    await connectDB();

    // Find all stars
    const stars = await User.find({ role: 'star' }).select('name pseudo baroniId _id').limit(10);
    
    console.log(`🔍 Testing Revenue Calculation for ${stars.length} stars...\n`);

    for (const star of stars) {
      const periodDays = 30;
      const periodStartDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      
      console.log('='.repeat(80));
      console.log(`⭐ ${star.name || star.pseudo} (Baroni ID: ${star.baroniId}, ID: ${star._id})`);
      console.log(`📅 Period: Last ${periodDays} days (from ${periodStartDate.toISOString()})`);
      console.log(`📅 Today: ${new Date().toISOString()}\n`);

      // Method 1: Current API logic (period-based)
      const periodRevenue = await Transaction.aggregate([
        {
          $match: {
            receiverId: star._id,
            status: 'completed',
            type: {
              $in: [
                'appointment_payment',
                'dedication_request_payment',
                'dedication_payment',
                'live_show_attendance_payment',
                'live_show_hosting_payment'
              ]
            },
            createdAt: { $gte: periodStartDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const periodTotal = periodRevenue[0]?.total || 0;

      // Method 2: All-time revenue
      const allTimeRevenue = await Transaction.aggregate([
        {
          $match: {
            receiverId: star._id,
            status: 'completed',
            type: {
              $in: [
                'appointment_payment',
                'dedication_request_payment',
                'dedication_payment',
                'live_show_attendance_payment',
                'live_show_hosting_payment'
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const allTimeTotal = allTimeRevenue[0]?.total || 0;

      // Method 3: Check escrow
      const starWallet = await getOrCreateStarWallet(star._id);
      const escrow = starWallet?.escrow || 0;

      // Method 4: Check if escrow is being added incorrectly
      const revenueWithEscrow = periodTotal + escrow;
      const allTimeWithEscrow = allTimeTotal + escrow;

      // Method 5: Check ALL transaction types (including non-revenue)
      const allTransactions = await Transaction.aggregate([
        {
          $match: {
            receiverId: star._id,
            status: 'completed',
            createdAt: { $gte: periodStartDate }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { total: -1 }
        }
      ]);

      console.log(`💰 REVENUE BREAKDOWN:`);
      console.log(`   Period-based (Last ${periodDays} days): ${periodTotal}`);
      console.log(`   All-time: ${allTimeTotal}`);
      console.log(`   Escrow: ${escrow}`);
      console.log(`   Period + Escrow: ${revenueWithEscrow}`);
      console.log(`   All-time + Escrow: ${allTimeWithEscrow}\n`);

      console.log(`📊 ALL TRANSACTION TYPES IN PERIOD:`);
      if (allTransactions.length === 0) {
        console.log(`   No transactions found`);
      } else {
        for (const txn of allTransactions) {
          const isRevenueType = [
            'appointment_payment',
            'dedication_request_payment',
            'dedication_payment',
            'live_show_attendance_payment',
            'live_show_hosting_payment'
          ].includes(txn._id);
          const marker = isRevenueType ? '✅' : '⚠️';
          console.log(`   ${marker} ${txn._id}: ${txn.total} (${txn.count} transactions)`);
        }
      }

      // Check if there are transactions outside the period that might be counted
      const recentTransactions = await Transaction.find({
        receiverId: star._id,
        status: 'completed',
        type: {
          $in: [
            'appointment_payment',
            'dedication_request_payment',
            'dedication_payment',
            'live_show_attendance_payment',
            'live_show_hosting_payment'
          ]
        }
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('type amount createdAt')
      .lean();

      if (recentTransactions.length > 0) {
        console.log(`\n📝 RECENT TRANSACTIONS (showing 5 most recent):`);
        for (const txn of recentTransactions) {
          const inPeriod = txn.createdAt >= periodStartDate ? '✅ IN PERIOD' : '❌ OUT OF PERIOD';
          console.log(`   ${inPeriod} ${txn.type}: ${txn.amount} on ${txn.createdAt.toISOString()}`);
        }
      }

      // Check for potential issues
      console.log(`\n🔍 POTENTIAL ISSUES:`);
      if (allTimeTotal > periodTotal * 10) {
        console.log(`   ⚠️  All-time revenue (${allTimeTotal}) is much higher than period revenue (${periodTotal})`);
        console.log(`   💡 Frontend might be showing all-time instead of period-based`);
      }
      if (revenueWithEscrow > periodTotal * 2) {
        console.log(`   ⚠️  Revenue + Escrow (${revenueWithEscrow}) is much higher than period revenue (${periodTotal})`);
        console.log(`   💡 Escrow might be incorrectly added to revenue`);
      }
      if (allTimeWithEscrow > 100000) {
        console.log(`   ⚠️  All-time + Escrow (${allTimeWithEscrow}) is very high`);
        console.log(`   💡 This might match the F145530 shown in screenshot`);
      }

      console.log('\n');
    }

    await mongoose.connection.close();
    console.log('✅ Debug completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

debugRevenueIssue();
