import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const TOTAL_USERS = 5000;
const BATCH_SIZE = 500;
const PASSWORD = 'Test@123';

const countries = ['Mali'];
const languages = ['English', 'French', 'Hindi', 'Spanish', 'German'];
const currencies = ['USD', 'EUR', 'INR', 'F', 'GBP', 'CAD'];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const buildUser = (idx, passwordHash, contactBase) => {
  const uniqueNum = contactBase + idx;
  return {
    contact: `+${uniqueNum}`,
    email: `fan${uniqueNum}@example.com`,
    password: passwordHash,
    role: 'fan',
    coinBalance: Math.floor(Math.random() * 500),
    name: `Fan ${uniqueNum}`,
    pseudo: `fan${uniqueNum}`,
    preferredLanguage: randomItem(languages),
    preferredCurrency: randomItem(currencies),
    country: randomItem(countries),
    about: 'Auto-generated fan user',
    location: 'AutoCity',
    availableForBookings: true,
    appNotification: true,
    hidden: false,
    deviceType: randomItem(['ios', 'android']),
    isDev: false,
    sessionVersion: 1,
    profileImpressions: Math.floor(Math.random() * 200),
  };
};

const run = async () => {
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    // Use current timestamp to avoid contact collisions across runs
    const contactBase = Number(`2237${Date.now().toString().slice(-7)}`); // ensures +2237XXXXXXXX pattern

    let toInsert = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
      toInsert.push(buildUser(i, passwordHash, contactBase));
      if (toInsert.length === BATCH_SIZE || i === TOTAL_USERS - 1) {
        try {
          const result = await User.insertMany(toInsert, { ordered: false });
          console.log(`Inserted ${result.length} users in batch`);
        } catch (err) {
          console.error('Batch insert error (duplicates may be skipped):', err.message);
        }
        toInsert = [];
      }
    }

    console.log('Completed generating random fans.');
    process.exit(0);
  } catch (err) {
    console.error('Script failed:', err);
    process.exit(1);
  }
};

run();

