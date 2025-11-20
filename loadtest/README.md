# Baroni Backend Load Testing

This directory contains load testing scripts to test the Baroni backend API performance under various load conditions.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- The Baroni backend server running

## Installation

1. Navigate to the loadtest directory:
```bash
cd baroni_backend/loadtest
```

2. Install dependencies (if needed):
```bash
npm install axios
```

## Configuration

1. Set environment variables or modify the script directly:
   - `API_BASE_URL`: Base URL of your API (default: http://localhost:4000)
   - `CONCURRENT_USERS`: Number of concurrent users (default: 10)
   - `REQUESTS_PER_USER`: Number of requests per user (default: 50)
   - `TEST_DURATION`: Test duration in seconds (default: 60)
   - `RAMP_UP_TIME`: Time to ramp up all users in seconds (default: 10)
   - `ADMIN_TOKEN`: Admin JWT token (optional, for admin endpoints)
   - `USER_TOKEN`: User JWT token (optional, for protected endpoints)

## Getting Authentication Tokens

To test protected endpoints, you need to obtain JWT tokens:

### Get User Token:
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Get Admin Token:
```bash
curl -X POST http://localhost:4000/api/admin/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

Then set the tokens as environment variables:
```bash
export USER_TOKEN="your_user_token_here"
export ADMIN_TOKEN="your_admin_token_here"
```

## Running the Load Test

### Basic Usage:
```bash
node loadTest.js
```

### With Custom Configuration:
```bash
API_BASE_URL=http://localhost:4000 \
CONCURRENT_USERS=20 \
REQUESTS_PER_USER=100 \
TEST_DURATION=120 \
node loadTest.js
```

### With Authentication:
```bash
API_BASE_URL=http://localhost:4000 \
USER_TOKEN="your_user_token" \
ADMIN_TOKEN="your_admin_token" \
node loadTest.js
```

## Test Endpoints

The load test covers the following endpoints:

### Public Endpoints:
- GET /api/config/ - Global configuration
- GET /api/config/categories - Categories list
- GET /api/config/country-services - Country services
- GET / - Health check
- GET /api/star - Stars list
- GET /api/live-shows - Live shows
- GET /api/services - Services list

### Protected Endpoints (requires user token):
- GET /api/auth/me - User profile
- GET /api/dashboard - User dashboard
- GET /api/appointments - User appointments
- GET /api/notifications - User notifications
- GET /api/favorites - User favorites

### Admin Endpoints (requires admin token):
- GET /api/admin/profile - Admin profile
- GET /api/admin/dashboard/summary - Dashboard summary
- GET /api/admin/dashboard/complete - Complete dashboard

## Report

After the test completes, a detailed report will be:
1. Displayed in the console
2. Saved to a file: `loadtest-report-YYYY-MM-DDTHH-MM-SS.txt`

The report includes:
- Test configuration
- Overall statistics (requests, success rate, throughput)
- Response time statistics (min, max, avg, median, p95, p99)
- HTTP status code distribution
- Endpoint-specific results
- Error summary
- Performance analysis and recommendations

## Understanding the Results

### Key Metrics:

1. **Requests Per Second (RPS)**: Throughput - how many requests the server can handle per second
2. **Response Time**: 
   - Average: Mean response time
   - Median (p50): 50% of requests complete within this time
   - p95: 95% of requests complete within this time
   - p99: 99% of requests complete within this time
3. **Success Rate**: Percentage of successful requests (2xx status codes)
4. **Error Rate**: Percentage of failed requests (4xx, 5xx status codes)

### Performance Thresholds:

- **Excellent**: Avg < 200ms, p95 < 500ms, Success Rate >= 99%
- **Good**: Avg < 500ms, p95 < 1s, Success Rate >= 95%
- **Acceptable**: Avg < 1s, p95 < 2s, Success Rate >= 90%
- **Needs Improvement**: Any metric above acceptable thresholds

## Example Output

```
================================================================================
BARONI BACKEND LOAD TEST REPORT
================================================================================

Test Configuration:
- Base URL: http://localhost:4000
- Concurrent Users: 10
- Requests Per User: 50
- Test Duration: 60 seconds
...

Overall Statistics:
Total Requests: 500
Successful Requests: 495 (99.00%)
Failed Requests: 5 (1.00%)
Requests Per Second: 8.33

Response Time Statistics (ms):
- Minimum: 45.23 ms
- Maximum: 1234.56 ms
- Average: 234.56 ms
- Median (p50): 189.23 ms
- 95th Percentile (p95): 567.89 ms
- 99th Percentile (p99): 890.12 ms
...
```

## Troubleshooting

### Connection Errors:
- Ensure the backend server is running
- Check the API_BASE_URL is correct
- Verify network connectivity

### Authentication Errors:
- Verify tokens are valid and not expired
- Check token format (should start with "Bearer ")
- Ensure user/admin accounts exist

### High Error Rates:
- Check server logs for errors
- Verify database connectivity
- Check server resources (CPU, memory)
- Review endpoint implementations

### Slow Response Times:
- Check database query performance
- Review server resource usage
- Consider adding caching
- Optimize slow endpoints

## Advanced Usage

### Custom Test Scenarios:

You can modify `loadTest.js` to:
- Add custom endpoints
- Change endpoint weights (traffic distribution)
- Add custom request payloads
- Implement custom test scenarios

### Running Multiple Tests:

```bash
# Light load
CONCURRENT_USERS=5 REQUESTS_PER_USER=20 node loadTest.js

# Medium load
CONCURRENT_USERS=10 REQUESTS_PER_USER=50 node loadTest.js

# Heavy load
CONCURRENT_USERS=50 REQUESTS_PER_USER=100 node loadTest.js
```

## Notes

- The test uses weighted random selection to distribute requests across endpoints
- Tests run for a fixed duration or until all requests complete
- Results are aggregated and analyzed automatically
- Reports are saved with timestamps for historical comparison



