import dotenv from 'dotenv';
import '../config/db.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import Dedication from '../models/Dedication.js';
import Service from '../models/Service.js';
import DedicationSample from '../models/DedicationSample.js';
import Availability from '../models/Availability.js';
import Transaction from '../models/Transaction.js';
import LiveShow from '../models/LiveShow.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';
import ContactSupport from '../models/ContactSupport.js';
import Review from '../models/Review.js';
import ReportUser from '../models/ReportUser.js';
import mongoose from 'mongoose';

dotenv.config();

// Configuration
const EMAIL_PATTERN = 'example.com'; // Email pattern to match test users
const BATCH_SIZE = 100; // Process users in batches
const DRY_RUN = false; // Set to true to preview without deleting

/**
 * Delete test users based on email pattern
 */
const deleteTestUsers = async () => {
  try {
    console.log('🔍 Starting test users deletion script...');
    console.log(`📧 Email pattern: *@${EMAIL_PATTERN}`);
    console.log(`🔧 Dry run mode: ${DRY_RUN ? 'ON (no deletion)' : 'OFF (will delete)'}`);
    console.log('');

    // Find all users with email containing the pattern
    const testUsers = await User.find({
      email: { $regex: EMAIL_PATTERN, $options: 'i' }
    }).select('_id email name pseudo role');

    const totalUsers = testUsers.length;
    console.log(`📊 Found ${totalUsers} test users to delete`);
    console.log('');

    if (totalUsers === 0) {
      console.log('✅ No test users found. Exiting...');
      process.exit(0);
    }

    // Show first 10 users as preview
    console.log('📋 Preview of users to be deleted (first 10):');
    testUsers.slice(0, 10).forEach((user, idx) => {
      console.log(`   ${idx + 1}. ${user.email} (${user.name || user.pseudo}) - ${user.role}`);
    });
    if (totalUsers > 10) {
      console.log(`   ... and ${totalUsers - 10} more`);
    }
    console.log('');

    if (DRY_RUN) {
      console.log('⚠️  DRY RUN MODE: No users will be deleted');
      console.log(`   Would delete ${totalUsers} users`);
      process.exit(0);
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete all test users!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');

    let deletedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process users in batches
    for (let i = 0; i < testUsers.length; i += BATCH_SIZE) {
      const batch = testUsers.slice(i, i + BATCH_SIZE);
      console.log(`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(totalUsers / BATCH_SIZE)} (${batch.length} users)...`);

      for (const user of batch) {
        try {
          const userId = user._id;
          const userRole = user.role;

          // Clean up related data
          console.log(`   🗑️  Deleting user: ${user.email} (${userRole})`);

          // Remove user from other users' favorites
          await User.updateMany(
            { favorites: userId },
            { $pull: { favorites: userId } }
          );

          // If user is a star, clean up star-related data
          if (userRole === 'star') {
            // Delete dedication requests where user is the star
            const dedicationRequests = await DedicationRequest.find({ starId: userId });
            await DedicationRequest.deleteMany({ starId: userId });
            console.log(`      ✓ Deleted ${dedicationRequests.length} dedication requests`);

            // Delete dedications
            const dedications = await Dedication.find({ userId });
            await Dedication.deleteMany({ userId });
            console.log(`      ✓ Deleted ${dedications.length} dedications`);

            // Delete services
            const services = await Service.find({ userId });
            await Service.deleteMany({ userId });
            console.log(`      ✓ Deleted ${services.length} services`);

            // Delete dedication samples
            const samples = await DedicationSample.find({ userId });
            await DedicationSample.deleteMany({ userId });
            console.log(`      ✓ Deleted ${samples.length} dedication samples`);

            // Delete availabilities
            const availabilities = await Availability.find({ userId });
            await Availability.deleteMany({ userId });
            console.log(`      ✓ Deleted ${availabilities.length} availabilities`);

            // Cancel appointments where user is the star
            const starAppointments = await Appointment.find({ starId: userId });
            await Appointment.deleteMany({ starId: userId });
            console.log(`      ✓ Deleted ${starAppointments.length} appointments (as star)`);

            // Delete live shows
            const liveShows = await LiveShow.find({ starId: userId });
            await LiveShow.deleteMany({ starId: userId });
            console.log(`      ✓ Deleted ${liveShows.length} live shows`);

            // Delete reviews
            const reviews = await Review.find({ starId: userId });
            await Review.deleteMany({ starId: userId });
            console.log(`      ✓ Deleted ${reviews.length} reviews`);
          }

          // If user is a fan, clean up fan-related data
          if (userRole === 'fan') {
            // Delete dedication requests where user is the fan
            const fanDedicationRequests = await DedicationRequest.find({ fanId: userId });
            await DedicationRequest.deleteMany({ fanId: userId });
            console.log(`      ✓ Deleted ${fanDedicationRequests.length} dedication requests (as fan)`);

            // Delete appointments where user is the fan
            const fanAppointments = await Appointment.find({ fanId: userId });
            await Appointment.deleteMany({ fanId: userId });
            console.log(`      ✓ Deleted ${fanAppointments.length} appointments (as fan)`);

            // Delete live show attendances
            const attendances = await LiveShowAttendance.find({ fanId: userId });
            await LiveShowAttendance.deleteMany({ fanId: userId });
            console.log(`      ✓ Deleted ${attendances.length} live show attendances`);
          }

          // Delete transactions (both as payer and receiver)
          const transactionsAsPayer = await Transaction.find({ payerId: userId });
          const transactionsAsReceiver = await Transaction.find({ receiverId: userId });
          await Transaction.deleteMany({ 
            $or: [{ payerId: userId }, { receiverId: userId }] 
          });
          console.log(`      ✓ Deleted ${transactionsAsPayer.length + transactionsAsReceiver.length} transactions`);

          // Delete contact support tickets
          const supportTickets = await ContactSupport.find({ userId });
          await ContactSupport.deleteMany({ userId });
          console.log(`      ✓ Deleted ${supportTickets.length} support tickets`);

          // Delete reports (as reporter and as reported user)
          await ReportUser.deleteMany({ 
            $or: [{ reporterId: userId }, { reportedUserId: userId }] 
          });
          console.log(`      ✓ Deleted reports`);

          // Permanently delete the user
          await User.findByIdAndDelete(userId);
          deletedCount++;
          console.log(`      ✅ User deleted successfully`);

        } catch (error) {
          errorCount++;
          errors.push({
            email: user.email,
            error: error.message
          });
          console.error(`      ❌ Error deleting user ${user.email}:`, error.message);
        }
      }

      console.log(`   ✅ Batch completed: ${deletedCount} deleted, ${errorCount} errors`);
      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 DELETION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users found: ${totalUsers}`);
    console.log(`✅ Successfully deleted: ${deletedCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log('');
      console.log('❌ Errors encountered:');
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.email}: ${err.error}`);
      });
    }

    console.log('');
    console.log('✅ Script completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

// Run the script
deleteTestUsers();
