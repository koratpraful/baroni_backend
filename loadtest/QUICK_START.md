# Quick Start Guide - Load Testing

## Fastest Way to Run Load Test

### Step 1: Make sure your backend is running
```bash
cd baroni_backend
npm start
```

### Step 2: Run the load test

**On Windows:**
```bash
cd baroni_backend/loadtest
runLoadTest.bat
```

**On Linux/Mac:**
```bash
cd baroni_backend/loadtest
chmod +x runLoadTest.sh
./runLoadTest.sh
```

**Or directly with Node:**
```bash
cd baroni_backend/loadtest
node loadTest.js
```

### Step 3: View the report

The test will:
1. Display results in the console
2. Save a detailed report to `loadtest-report-YYYY-MM-DDTHH-MM-SS.txt`

## Custom Configuration

Set environment variables before running:

```bash
# Windows PowerShell
$env:API_BASE_URL="http://localhost:4000"
$env:CONCURRENT_USERS="20"
$env:REQUESTS_PER_USER="100"
$env:TEST_DURATION="120"
node loadTest.js

# Linux/Mac
export API_BASE_URL="http://localhost:4000"
export CONCURRENT_USERS="20"
export REQUESTS_PER_USER="100"
export TEST_DURATION="120"
node loadTest.js
```

## With Authentication (Optional)

To test protected endpoints, get tokens first:

```bash
# Get user token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Get admin token  
curl -X POST http://localhost:4000/api/admin/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@email.com","password":"adminpassword"}'
```

Then set them:
```bash
export USER_TOKEN="your_user_token_here"
export ADMIN_TOKEN="your_admin_token_here"
node loadTest.js
```

## What Gets Tested?

The load test automatically tests:
- ✅ Public endpoints (config, categories, stars, etc.)
- ✅ Protected endpoints (if user token provided)
- ✅ Admin endpoints (if admin token provided)

## Report Location

Reports are saved in the `loadtest` directory with format:
```
loadtest-report-2024-01-15T10-30-45-123Z.txt
```

## Need Help?

See `README.md` for detailed documentation.




