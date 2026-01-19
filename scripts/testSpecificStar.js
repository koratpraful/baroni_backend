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

const testSpecificStar = async () => {
  try {
    await connectDB();

    // Find Star19 or star with baroniId 92831
    const star = await User.findOne({
      $or: [
        { name: /Star19/i },
        { pseudo: /Star19/i },
        { baroniId: '92831' }
      ],
      role: 'star'
    });

    if (!star) {
      console.log('❌ Star19 or star with baroniId 92831 not found');
      console.log('🔍 Searching for stars with similar names...');
      const similarStars = await User.find({
        $or: [
          { name: /star/i },
          { pseudo: /star/i }
        ],
        role: 'star'
      }).limit(10).select('name pseudo baroniId _id');
      
      console.log('Found stars:');
      for (const s of similarStars) {
        console.log(`  - ${s.name || s.pseudo} (Baroni ID: ${s.baroniId}, ID: ${s._id})`);
      }
      
      await mongoose.connection.close();
      return;
    }

    console.log(`\n⭐ Found Star: ${star.name || star.pseudo}`);
    console.log(`   Baroni ID: ${star.baroniId}`);
    console.log(`   ID: ${star._id}\n`);

    const periodDays = 30;
    const periodStartDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    console.log(`📅 Period: Last ${periodDays} days (from ${periodStartDate.toISOString()})\n`);

    // Get all transactions
    const transactions = await Transaction.find({
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
    }).sort({ createdAt: -1 });

    console.log(`💰 REVENUE ANALYSIS:`);
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`   Total Revenue: ${totalRevenue}`);
    console.log(`   Transaction Count: ${transactions.length}`);
    console.log(`   By Type:`);
    const byType = {};
    for (const t of transactions) {
      byType[t.type] = (byType[t.type] || 0) + t.amount;
    }
    for (const [type, amount] of Object.entries(byType)) {
      console.log(`     - ${type}: ${amount}`);
    }

    // Get transaction IDs
    const transactionIds = transactions.map(t => t._id);
    const appointmentTxnIds = transactions.filter(t => t.type === 'appointment_payment').map(t => t._id);
    const dedicationTxnIds = transactions.filter(t => 
      t.type === 'dedication_request_payment' || t.type === 'dedication_payment'
    ).map(t => t._id);
    const liveShowTxnIds = transactions.filter(t => 
      t.type === 'live_show_attendance_payment' || t.type === 'live_show_hosting_payment'
    ).map(t => t._id);

    console.log(`\n📞 VIDEO CALLS ANALYSIS:`);
    console.log(`   Appointment transactions: ${appointmentTxnIds.length}`);
    
    if (appointmentTxnIds.length > 0) {
      const linkedAppointments = await Appointment.find({
        starId: star._id,
        transactionId: { $in: appointmentTxnIds }
      });
      
      console.log(`   Total appointments linked: ${linkedAppointments.length}`);
      const byStatus = {};
      for (const apt of linkedAppointments) {
        byStatus[apt.status] = (byStatus[apt.status] || 0) + 1;
      }
      console.log(`   By Status:`);
      for (const [status, count] of Object.entries(byStatus)) {
        console.log(`     - ${status}: ${count}`);
      }
      
      const completedCount = await Appointment.countDocuments({
        starId: star._id,
        status: 'completed',
        transactionId: { $in: appointmentTxnIds }
      });
      console.log(`   ✅ Completed (linked to period transactions): ${completedCount}`);
      
      const completedByCreatedAt = await Appointment.countDocuments({
        starId: star._id,
        status: 'completed',
        createdAt: { $gte: periodStartDate }
      });
      console.log(`   ✅ Completed (by createdAt in period): ${completedByCreatedAt}`);
    }

    console.log(`\n🎁 DEDICATIONS ANALYSIS:`);
    console.log(`   Dedication transactions: ${dedicationTxnIds.length}`);
    
    if (dedicationTxnIds.length > 0) {
      const linkedDedications = await DedicationRequest.find({
        starId: star._id,
        transactionId: { $in: dedicationTxnIds }
      });
      
      console.log(`   Total dedications linked: ${linkedDedications.length}`);
      const byStatus = {};
      for (const ded of linkedDedications) {
        byStatus[ded.status] = (byStatus[ded.status] || 0) + 1;
      }
      console.log(`   By Status:`);
      for (const [status, count] of Object.entries(byStatus)) {
        console.log(`     - ${status}: ${count}`);
      }
      
      const completedCount = await DedicationRequest.countDocuments({
        starId: star._id,
        status: 'completed',
        transactionId: { $in: dedicationTxnIds }
      });
      console.log(`   ✅ Completed (linked to period transactions): ${completedCount}`);
    }

    console.log(`\n📺 LIVE SHOWS ANALYSIS:`);
    console.log(`   Live show transactions: ${liveShowTxnIds.length}`);
    
    if (liveShowTxnIds.length > 0) {
      const hostingTxns = transactions.filter(t => t.type === 'live_show_hosting_payment').map(t => t._id);
      const attendanceTxns = transactions.filter(t => t.type === 'live_show_attendance_payment').map(t => t._id);
      
      if (hostingTxns.length > 0) {
        const hostingShows = await LiveShow.find({
          starId: star._id,
          transactionId: { $in: hostingTxns }
        });
        console.log(`   Shows from hosting transactions: ${hostingShows.length}`);
        for (const show of hostingShows) {
          console.log(`     - Status: ${show.status}, Created: ${show.createdAt.toISOString()}`);
        }
      }
      
      if (attendanceTxns.length > 0) {
        const attendanceRecords = await LiveShowAttendance.find({
          starId: star._id,
          transactionId: { $in: attendanceTxns }
        });
        console.log(`   Attendance records: ${attendanceRecords.length}`);
        const uniqueShowIds = [...new Set(attendanceRecords.map(a => a.liveShowId.toString()))];
        console.log(`   Unique show IDs: ${uniqueShowIds.length}`);
      }
    }

    console.log(`\n👥 ENGAGED USERS: ${await Transaction.distinct('payerId', {
      receiverId: star._id,
      status: 'completed',
      createdAt: { $gte: periodStartDate }
    }).then(users => users.length)}`);

    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`   Revenue: ${totalRevenue}`);
    console.log(`   Video Calls (new logic): ${appointmentTxnIds.length > 0 ? await Appointment.countDocuments({
      starId: star._id,
      status: 'completed',
      transactionId: { $in: appointmentTxnIds }
    }) : 0}`);
    console.log(`   Dedications (new logic): ${dedicationTxnIds.length > 0 ? await DedicationRequest.countDocuments({
      starId: star._id,
      status: 'completed',
      transactionId: { $in: dedicationTxnIds }
    }) : 0}`);
    console.log(`   Live Shows (new logic): ${liveShowTxnIds.length > 0 ? (async () => {
      const hostingTxns = transactions.filter(t => t.type === 'live_show_hosting_payment').map(t => t._id);
      const attendanceTxns = transactions.filter(t => t.type === 'live_show_attendance_payment').map(t => t._id);
      const hostingShowIds = hostingTxns.length > 0 ? await LiveShow.find({
        starId: star._id,
        status: 'completed',
        transactionId: { $in: hostingTxns }
      }).distinct('_id') : [];
      const attendanceShowIds = attendanceTxns.length > 0 ? await LiveShowAttendance.find({
        starId: star._id,
        status: 'completed',
        transactionId: { $in: attendanceTxns }
      }).distinct('liveShowId') : [];
      const allShowIds = [...new Set([...hostingShowIds.map(id => id.toString()), ...attendanceShowIds.map(id => id.toString())])];
      return allShowIds.length > 0 ? await LiveShow.countDocuments({
        starId: star._id,
        status: 'completed',
        _id: { $in: allShowIds }
      }) : 0;
    })() : 0}`);

    await mongoose.connection.close();
    console.log('\n✅ Test completed');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testSpecificStar();
