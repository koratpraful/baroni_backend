# Delete Test Users Script

## Overview
This script permanently deletes all test users whose email contains "example.com". It also cleans up all related data (appointments, transactions, services, etc.).

## ⚠️ WARNING
**This script PERMANENTLY deletes users and all their data. This action cannot be undone!**

## Prerequisites
- Node.js installed
- MongoDB connection configured in `.env`
- Database access permissions

## Usage

### Option 1: Using npm script (Recommended)
```bash
npm run delete:test-users
```

### Option 2: Direct execution
```bash
node scripts/deleteTestUsers.js
```

## Configuration

Edit `scripts/deleteTestUsers.js` to customize:

```javascript
// Change email pattern if needed
const EMAIL_PATTERN = 'example.com'; // Matches *@example.com

// Change batch size for processing
const BATCH_SIZE = 100; // Process 100 users at a time

// Enable dry run mode (preview without deleting)
const DRY_RUN = false; // Set to true to preview only
```

## Dry Run Mode

Before actually deleting, you can preview what will be deleted:

1. Open `scripts/deleteTestUsers.js`
2. Set `DRY_RUN = true`
3. Run the script: `npm run delete:test-users`
4. Review the output
5. Set `DRY_RUN = false` to actually delete

## What Gets Deleted

For each test user, the script deletes:

### Common Data (All Users)
- User profile
- Transactions (as payer and receiver)
- Contact support tickets
- Reports (as reporter and reported user)
- Favorites (removed from other users' favorites)

### Star-Specific Data
- Dedication requests (as star)
- Dedications
- Services
- Dedication samples
- Availabilities
- Appointments (as star)
- Live shows
- Reviews

### Fan-Specific Data
- Dedication requests (as fan)
- Appointments (as fan)
- Live show attendances

## Output Example

```
🔍 Starting test users deletion script...
📧 Email pattern: *@example.com
🔧 Dry run mode: OFF (will delete)

📊 Found 5000 test users to delete

📋 Preview of users to be deleted (first 10):
   1. fan1234567890@example.com (Fan 1234567890) - fan
   2. fan1234567891@example.com (Fan 1234567891) - fan
   ... and 4990 more

⚠️  WARNING: This will permanently delete all test users!
   Press Ctrl+C to cancel, or wait 5 seconds to continue...

🔄 Processing batch 1/50 (100 users)...
   🗑️  Deleting user: fan1234567890@example.com (fan)
      ✓ Deleted 0 dedication requests (as fan)
      ✓ Deleted 0 appointments (as fan)
      ✓ Deleted 0 live show attendances
      ✓ Deleted 0 transactions
      ✓ Deleted 0 support tickets
      ✓ Deleted reports
      ✅ User deleted successfully
   ...

============================================================
📊 DELETION SUMMARY
============================================================
Total users found: 5000
✅ Successfully deleted: 5000
❌ Errors: 0

✅ Script completed!
```

## Safety Features

1. **5-second delay**: Script waits 5 seconds before starting deletion (press Ctrl+C to cancel)
2. **Batch processing**: Processes users in batches to avoid memory issues
3. **Error handling**: Continues even if individual user deletion fails
4. **Detailed logging**: Shows progress for each user and batch

## Troubleshooting

### Script fails to connect to database
- Check `.env` file has correct MongoDB connection string
- Ensure MongoDB is running

### Some users fail to delete
- Check error messages in the summary
- Common issues: foreign key constraints, missing related data
- Script continues with other users even if some fail

### Want to delete different email pattern
- Edit `EMAIL_PATTERN` in the script
- Example: `const EMAIL_PATTERN = 'test.com';` to match *@test.com

## Notes

- The script processes users sequentially in batches
- Large deletions (5000+ users) may take several minutes
- All deletions are permanent and cannot be undone
- Related data is cleaned up automatically
