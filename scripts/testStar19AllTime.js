import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI or MONGODB_URI not found');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

const testStar19AllTime = async () => {
  try {
    await connectDB();

    const star = await User.findOne({
      $or: [
        { name: /Star19/i },
        { pseudo: /Star19/i },
        { baroniId: '92831' }
      ],
      role: 'star'
    });

    if (!star) {
      console.log('❌ Star19 not found');
      await mongoose.connection.close();
      return;
    }

    console.log(`\n⭐ Star: ${star.name || star.pseudo} (Baroni ID: ${star.baroniId})\n`);

    // Check ALL TIME transactions (no date filter)
    const allTransactions = await Transaction.find({
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
    }).sort({ createdAt: -1 });

    const allTimeRevenue = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`💰 ALL TIME REVENUE: ${allTimeRevenue}`);
    console.log(`   Total Transactions: ${allTransactions.length}\n`);

    // Check last 30 days
    const periodDays = 30;
    const periodStartDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    
    const periodTransactions = allTransactions.filter(t => t.createdAt >= periodStartDate);
    const periodRevenue = periodTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    console.log(`📅 LAST 30 DAYS:`);
    console.log(`   Revenue: ${periodRevenue}`);
    console.log(`   Transactions: ${periodTransactions.length}`);
    console.log(`   Period Start: ${periodStartDate.toISOString()}\n`);

    // Check if revenue matches F145530 (assuming F is just a currency symbol)
    const targetRevenue = 145530;
    console.log(`🎯 TARGET REVENUE (from screenshot): F${targetRevenue}`);
    console.log(`   All Time: ${allTimeRevenue === targetRevenue ? '✅ MATCH' : '❌ NO MATCH'}`);
    console.log(`   Last 30 Days: ${periodRevenue === targetRevenue ? '✅ MATCH' : '❌ NO MATCH'}\n`);

    // Show transaction breakdown
    if (allTransactions.length > 0) {
      console.log(`📊 TRANSACTION BREAKDOWN (showing first 10):`);
      for (let i = 0; i < Math.min(10, allTransactions.length); i++) {
        const t = allTransactions[i];
        const inPeriod = t.createdAt >= periodStartDate ? '✅' : '❌';
        console.log(`   ${inPeriod} ${t.type}: ${t.amount} on ${t.createdAt.toISOString()}`);
      }
      if (allTransactions.length > 10) {
        console.log(`   ... and ${allTransactions.length - 10} more`);
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testStar19AllTime();
