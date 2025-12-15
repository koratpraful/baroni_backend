import dotenv from 'dotenv';
import '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const LIMIT = 5000;

// Generate a starting 10-digit Indian mobile number (starts with 6-9)
const generateStartMsisdn = () => {
  const base = 6000000000; // lowest 10-digit starting with 6
  const span = 3000000000; // up to 8999999999
  return base + Math.floor(Math.random() * span);
};

const run = async () => {
  try {
    // Pick candidates: most recent fans with Mali contact/country
    const candidates = await User.find({
      role: 'fan',
      $or: [
        { country: 'Mali' },
        { contact: { $regex: '^\\+223' } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(LIMIT)
      .select('_id contact country preferredCurrency preferredLanguage');

    if (!candidates.length) {
      console.log('No matching users found.');
      process.exit(0);
    }

    const startMsisdn = generateStartMsisdn();
    const bulkOps = [];
    let idx = 0;

    for (const user of candidates) {
      const msisdn = startMsisdn + idx;
      const newContact = `+91${msisdn}`;
      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              contact: newContact,
              country: 'India',
              preferredCurrency: 'INR'
            }
          }
        }
      });
      idx += 1;
    }

    if (bulkOps.length === 0) {
      console.log('No users to update.');
      process.exit(0);
    }

    const result = await User.bulkWrite(bulkOps, { ordered: false });
    console.log(`Requested updates: ${bulkOps.length}, matched: ${result.matchedCount}, modified: ${result.modifiedCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

run();

