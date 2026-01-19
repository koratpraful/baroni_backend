import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI or MONGODB_URI not found in environment variables');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

const testStarProfileData = async () => {
  try {
    await connectDB();

    // Find a star with revenue > 0
    const periodDays = 30;
    const periodStartDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    console.log('\n🔍 Finding stars with revenue in last 30 days...\n');
    console.log(`Period: Last ${periodDays} days (from ${periodStartDate.toISOString()})`);

    // Get all stars with completed transactions in the period
    const starsWithRevenue = await Transaction.aggregate([
      {
        $match: {
          receiverId: { $exists: true },
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
          _id: '$receiverId',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 5
      }
    ]);

    if (starsWithRevenue.length === 0) {
      console.log('❌ No stars found with revenue in last 30 days');
      await mongoose.connection.close();
      return;
    }

    console.log(`\n📊 Found ${starsWithRevenue.length} stars with revenue\n`);

    let processedCount = 0;
    for (const starData of starsWithRevenue) {
      const starId = starData._id;
      const totalRevenue = starData.totalRevenue;
      const transactionCount = starData.transactionCount;

      const star = await User.findById(starId).select('name pseudo baroniId role');
      console.log(`\n🔍 Processing star ${starId}: role=${star?.role}, name=${star?.name || star?.pseudo}`);
      
      if (!star) {
        console.log(`   ⚠️  User not found, skipping`);
        continue;
      }
      
      if (star.role !== 'star') {
        console.log(`   ⚠️  User role is '${star.role}', not 'star', skipping`);
        continue;
      }
      
      processedCount++;

      console.log('\n' + '='.repeat(80));
      console.log(`⭐ STAR: ${star.name || star.pseudo} (ID: ${starId})`);
      console.log(`   Baroni ID: ${star.baroniId || 'N/A'}`);
      console.log(`   Total Revenue: ${totalRevenue}`);
      console.log(`   Transaction Count: ${transactionCount}`);
      console.log('='.repeat(80));

      // Get all transactions for this star in the period (no limit to see all)
      const transactions = await Transaction.find({
        receiverId: starId,
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
      }).sort({ createdAt: -1 });

      console.log(`\n📝 All Transactions (${transactions.length} total):`);
      const sampleSize = Math.min(10, transactions.length);
      for (let i = 0; i < sampleSize; i++) {
        const txn = transactions[i];
        console.log(`   - Type: ${txn.type}, Amount: ${txn.amount}, Date: ${txn.createdAt.toISOString()}, ID: ${txn._id}`);
      }
      if (transactions.length > sampleSize) {
        console.log(`   ... and ${transactions.length - sampleSize} more transactions`);
      }

      // Check appointments
      const appointmentTransactions = transactions.filter(t => t.type === 'appointment_payment');
      const appointmentTransactionIds = appointmentTransactions.map(t => t._id);

      console.log(`\n📞 APPOINTMENTS ANALYSIS:`);
      console.log(`   Transactions with type 'appointment_payment': ${appointmentTransactions.length}`);

      if (appointmentTransactionIds.length > 0) {
        // Find appointments linked to these transactions
        const linkedAppointments = await Appointment.find({
          starId: starId,
          transactionId: { $in: appointmentTransactionIds }
        });

        console.log(`   Appointments linked to these transactions: ${linkedAppointments.length}`);
        for (const apt of linkedAppointments) {
          console.log(`     - Status: ${apt.status}, Created: ${apt.createdAt.toISOString()}, Transaction ID: ${apt.transactionId}`);
        }

        // Count completed appointments in period (current logic)
        const completedInPeriod = await Appointment.countDocuments({
          starId: starId,
          status: 'completed',
          createdAt: { $gte: periodStartDate }
        });
        console.log(`   ✅ Completed appointments in period (by createdAt): ${completedInPeriod}`);

        // Count completed appointments linked to period transactions (better logic)
        const completedLinkedToPeriodTxns = await Appointment.countDocuments({
          starId: starId,
          status: 'completed',
          transactionId: { $in: appointmentTransactionIds }
        });
        console.log(`   ✅ Completed appointments linked to period transactions: ${completedLinkedToPeriodTxns}`);
      }

      // Check dedications
      const dedicationTransactions = transactions.filter(t => 
        t.type === 'dedication_request_payment' || t.type === 'dedication_payment'
      );
      const dedicationTransactionIds = dedicationTransactions.map(t => t._id);

      console.log(`\n🎁 DEDICATIONS ANALYSIS:`);
      console.log(`   Transactions with dedication types: ${dedicationTransactions.length}`);

      if (dedicationTransactionIds.length > 0) {
        const linkedDedications = await DedicationRequest.find({
          starId: starId,
          transactionId: { $in: dedicationTransactionIds }
        });

        console.log(`   Dedications linked to these transactions: ${linkedDedications.length}`);
        for (const ded of linkedDedications) {
          console.log(`     - Status: ${ded.status}, Created: ${ded.createdAt.toISOString()}, Transaction ID: ${ded.transactionId}`);
        }

        const completedInPeriod = await DedicationRequest.countDocuments({
          starId: starId,
          status: 'completed',
          createdAt: { $gte: periodStartDate }
        });
        console.log(`   ✅ Completed dedications in period (by createdAt): ${completedInPeriod}`);

        const completedLinkedToPeriodTxns = await DedicationRequest.countDocuments({
          starId: starId,
          status: 'completed',
          transactionId: { $in: dedicationTransactionIds }
        });
        console.log(`   ✅ Completed dedications linked to period transactions: ${completedLinkedToPeriodTxns}`);
      }

      // Check live shows
      const liveShowTransactions = transactions.filter(t => 
        t.type === 'live_show_attendance_payment' || t.type === 'live_show_hosting_payment'
      );
      const liveShowTransactionIds = liveShowTransactions.map(t => t._id);

      console.log(`\n📺 LIVE SHOWS ANALYSIS:`);
      console.log(`   Transactions with live show types: ${liveShowTransactions.length}`);

      if (liveShowTransactionIds.length > 0) {
        // For hosting payments, LiveShow has transactionId
        const hostingTxns = liveShowTransactions.filter(t => t.type === 'live_show_hosting_payment');
        const hostingTxnIds = hostingTxns.map(t => t._id);

        const linkedLiveShows = await LiveShow.find({
          starId: starId,
          transactionId: { $in: hostingTxnIds }
        });

        console.log(`   Live shows linked to hosting transactions: ${linkedLiveShows.length}`);
        for (const show of linkedLiveShows) {
          console.log(`     - Status: ${show.status}, Created: ${show.createdAt.toISOString()}, Transaction ID: ${show.transactionId}`);
        }

        // For attendance payments, check LiveShowAttendance
        const attendanceTxns = liveShowTransactions.filter(t => t.type === 'live_show_attendance_payment');
        const attendanceTxnIds = attendanceTxns.map(t => t._id);

        if (attendanceTxnIds.length > 0) {
          const attendanceRecords = await LiveShowAttendance.find({
            starId: starId,
            transactionId: { $in: attendanceTxnIds }
          });

          console.log(`   Attendance records linked to attendance transactions: ${attendanceRecords.length}`);
          const uniqueShowIds = [...new Set(attendanceRecords.map(a => a.liveShowId.toString()))];
          console.log(`   Unique live show IDs from attendance: ${uniqueShowIds.length}`);
        }

        const completedInPeriod = await LiveShow.countDocuments({
          starId: starId,
          status: 'completed',
          createdAt: { $gte: periodStartDate }
        });
        console.log(`   ✅ Completed live shows in period (by createdAt): ${completedInPeriod}`);

        // Count shows linked to period transactions
        const completedLinkedToPeriodTxns = await LiveShow.countDocuments({
          starId: starId,
          status: 'completed',
          transactionId: { $in: hostingTxnIds }
        });
        console.log(`   ✅ Completed live shows linked to period hosting transactions: ${completedLinkedToPeriodTxns}`);
      }

      // Engaged users
      const engagedUsers = await Transaction.distinct('payerId', {
        receiverId: starId,
        status: 'completed',
        createdAt: { $gte: periodStartDate }
      });
      console.log(`\n👥 ENGAGED USERS: ${engagedUsers.length}`);

      console.log('\n' + '-'.repeat(80));
      console.log('📊 SUMMARY:');
      console.log(`   Revenue: ${totalRevenue} (from ${transactionCount} transactions)`);
      console.log(`   Video Calls (by createdAt): ${await Appointment.countDocuments({
        starId: starId,
        status: 'completed',
        createdAt: { $gte: periodStartDate }
      })}`);
      console.log(`   Dedications (by createdAt): ${await DedicationRequest.countDocuments({
        starId: starId,
        status: 'completed',
        createdAt: { $gte: periodStartDate }
      })}`);
      console.log(`   Live Shows (by createdAt): ${await LiveShow.countDocuments({
        starId: starId,
        status: 'completed',
        createdAt: { $gte: periodStartDate }
      })}`);
      console.log(`   Engaged Users: ${engagedUsers.length}`);
      console.log('-'.repeat(80) + '\n');
    }

    console.log(`\n✅ Processed ${processedCount} stars out of ${starsWithRevenue.length} found\n`);
    await mongoose.connection.close();
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testStarProfileData();
