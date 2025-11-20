import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '10000'),
  requestsPerUser: parseInt(process.env.REQUESTS_PER_USER || '100'),
  testDuration: parseInt(process.env.TEST_DURATION || '300'), // 5 minutes default
  rampUpTime: parseInt(process.env.RAMP_UP_TIME || '60'), // 60 seconds ramp up
  adminToken: process.env.ADMIN_TOKEN || '',
  userToken: process.env.USER_TOKEN || '',
  batchSize: parseInt(process.env.BATCH_SIZE || '100'), // Process users in batches to avoid memory issues
};

// Test results storage
const results = {
  startTime: null,
  endTime: null,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  endpointResults: {},
  errors: [],
  responseTimes: [],
  statusCodes: {},
};

// Test endpoints configuration - Comprehensive list of all API endpoints
const testEndpoints = [
  // Public/Config endpoints
  {
    name: 'Health Check',
    method: 'GET',
    path: '/',
    auth: false,
    weight: 5,
    category: 'System',
  },
  {
    name: 'Get Global Config',
    method: 'GET',
    path: '/api/config/',
    auth: false,
    weight: 10,
    category: 'Config',
  },
  {
    name: 'Get Categories',
    method: 'GET',
    path: '/api/config/categories',
    auth: false,
    weight: 10,
    category: 'Config',
  },
  {
    name: 'Get Country Services',
    method: 'GET',
    path: '/api/config/country-services',
    auth: false,
    weight: 8,
    category: 'Config',
  },
  
  // Auth endpoints
  {
    name: 'Get User Profile (me)',
    method: 'GET',
    path: '/api/auth/me',
    auth: true,
    weight: 15,
    requiresToken: 'user',
    category: 'Auth',
  },
  {
    name: 'Check User',
    method: 'POST',
    path: '/api/auth/check-user',
    auth: false,
    weight: 8,
    category: 'Auth',
    body: { email: 'test@example.com' },
  },
  
  // Star endpoints
  {
    name: 'Get All Stars',
    method: 'GET',
    path: '/api/star',
    auth: false,
    weight: 20,
    category: 'Star',
  },
  {
    name: 'Get Star Patterns',
    method: 'GET',
    path: '/api/star/patterns',
    auth: false,
    weight: 5,
    category: 'Star',
  },
  
  // Dashboard endpoints
  {
    name: 'Get User Dashboard',
    method: 'GET',
    path: '/api/dashboard',
    auth: true,
    weight: 12,
    requiresToken: 'user',
    category: 'Dashboard',
  },
  
  // Appointment endpoints
  {
    name: 'List Appointments',
    method: 'GET',
    path: '/api/appointments',
    auth: true,
    weight: 15,
    requiresToken: 'user',
    category: 'Appointment',
  },
  
  // Services endpoints
  {
    name: 'Get Services',
    method: 'GET',
    path: '/api/services',
    auth: false,
    weight: 10,
    category: 'Service',
  },
  
  // Live Shows endpoints
  {
    name: 'Get Live Shows',
    method: 'GET',
    path: '/api/live-shows',
    auth: false,
    weight: 12,
    category: 'LiveShow',
  },
  
  // Notifications endpoints
  {
    name: 'Get Notifications',
    method: 'GET',
    path: '/api/notifications',
    auth: true,
    weight: 10,
    requiresToken: 'user',
    category: 'Notification',
  },
  
  // Favorites endpoints
  {
    name: 'Get Favorites',
    method: 'GET',
    path: '/api/favorites',
    auth: true,
    weight: 8,
    requiresToken: 'user',
    category: 'Favorite',
  },
  
  // Transactions endpoints
  {
    name: 'Get Transactions',
    method: 'GET',
    path: '/api/transactions',
    auth: true,
    weight: 8,
    requiresToken: 'user',
    category: 'Transaction',
  },
  
  // Ratings endpoints
  {
    name: 'Get Ratings',
    method: 'GET',
    path: '/api/ratings',
    auth: false,
    weight: 7,
    category: 'Rating',
  },
  
  // Analytics endpoints
  {
    name: 'Get Analytics',
    method: 'GET',
    path: '/api/analytics',
    auth: true,
    weight: 5,
    requiresToken: 'user',
    category: 'Analytics',
  },
  
  // Dedications endpoints
  {
    name: 'Get Dedications',
    method: 'GET',
    path: '/api/dedications',
    auth: false,
    weight: 8,
    category: 'Dedication',
  },
  
  // Dedication Samples endpoints
  {
    name: 'Get Dedication Samples',
    method: 'GET',
    path: '/api/dedication-samples',
    auth: false,
    weight: 6,
    category: 'Dedication',
  },
  
  // Availabilities endpoints
  {
    name: 'Get Availabilities',
    method: 'GET',
    path: '/api/availabilities',
    auth: false,
    weight: 7,
    category: 'Availability',
  },
  
  // Category endpoints
  {
    name: 'Get Categories (Category API)',
    method: 'GET',
    path: '/api/category',
    auth: false,
    weight: 8,
    category: 'Category',
  },
  
  // Admin endpoints (if admin token available)
  {
    name: 'Admin Dashboard Summary',
    method: 'GET',
    path: '/api/admin/dashboard/summary',
    auth: true,
    weight: 5,
    requiresToken: 'admin',
    category: 'Admin',
  },
  {
    name: 'Admin Dashboard Complete',
    method: 'GET',
    path: '/api/admin/dashboard/complete',
    auth: true,
    weight: 3,
    requiresToken: 'admin',
    category: 'Admin',
  },
  {
    name: 'Admin Dashboard Revenue',
    method: 'GET',
    path: '/api/admin/dashboard/revenue',
    auth: true,
    weight: 3,
    requiresToken: 'admin',
    category: 'Admin',
  },
  {
    name: 'Admin Dashboard Active Users',
    method: 'GET',
    path: '/api/admin/dashboard/active-users-by-country',
    auth: true,
    weight: 3,
    requiresToken: 'admin',
    category: 'Admin',
  },
  {
    name: 'Admin Dashboard Top Stars',
    method: 'GET',
    path: '/api/admin/dashboard/top-stars',
    auth: true,
    weight: 3,
    requiresToken: 'admin',
    category: 'Admin',
  },
  {
    name: 'Admin Profile',
    method: 'GET',
    path: '/api/admin/profile',
    auth: true,
    weight: 4,
    requiresToken: 'admin',
    category: 'Admin',
  },
];

// Initialize endpoint results
testEndpoints.forEach(endpoint => {
  results.endpointResults[endpoint.name] = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    errors: [],
    statusCodes: {},
  };
});

// Helper function to make HTTP request
async function makeRequest(endpoint) {
  const startTime = Date.now();
  let responseTime = 0;
  let statusCode = 0;
  let success = false;
  let error = null;

  try {
    const config = {
      method: endpoint.method,
      url: `${CONFIG.baseUrl}${endpoint.path}`,
      timeout: 0, // No timeout - requests will wait indefinitely
      validateStatus: () => true, // Don't throw on any status
    };

    // Add auth header if needed
    if (endpoint.auth) {
      if (endpoint.requiresToken === 'admin' && CONFIG.adminToken) {
        config.headers = { Authorization: `Bearer ${CONFIG.adminToken}` };
      } else if (endpoint.requiresToken === 'user' && CONFIG.userToken) {
        config.headers = { Authorization: `Bearer ${CONFIG.userToken}` };
      } else {
        // Skip if token required but not available
        return { skipped: true };
      }
    }

    // Add request body for POST/PUT/PATCH requests
    if ((endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH') && endpoint.body) {
      config.data = endpoint.body;
      if (!config.headers) config.headers = {};
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    responseTime = Date.now() - startTime;
    statusCode = response.status;
    success = statusCode >= 200 && statusCode < 300;

    return {
      success,
      responseTime,
      statusCode,
      error: null,
    };
  } catch (err) {
    responseTime = Date.now() - startTime;
    error = err.message || err.code || 'Unknown error';
    success = false;
    statusCode = err.response?.status || 0;

    return {
      success,
      responseTime,
      statusCode,
      error: error,
    };
  }
}

// Select endpoint based on weight
function selectEndpoint() {
  const availableEndpoints = testEndpoints.filter(endpoint => {
    if (endpoint.auth && endpoint.requiresToken === 'admin' && !CONFIG.adminToken) {
      return false;
    }
    if (endpoint.auth && endpoint.requiresToken === 'user' && !CONFIG.userToken) {
      return false;
    }
    return true;
  });

  if (availableEndpoints.length === 0) {
    console.warn('Warning: No endpoints available for testing. Please provide tokens or check endpoint configuration.');
    return null;
  }

  const totalWeight = availableEndpoints.reduce((sum, ep) => sum + ep.weight, 0);
  if (totalWeight === 0) {
    return availableEndpoints[0];
  }
  
  let random = Math.random() * totalWeight;

  for (const endpoint of availableEndpoints) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }

  return availableEndpoints[0];
}

// Record result
function recordResult(endpoint, result) {
  if (result.skipped) {
    return;
  }

  results.totalRequests++;
  if (result.success) {
    results.successfulRequests++;
  } else {
    results.failedRequests++;
  }

  const endpointResult = results.endpointResults[endpoint.name];
  endpointResult.totalRequests++;
  if (result.success) {
    endpointResult.successfulRequests++;
  } else {
    endpointResult.failedRequests++;
    if (result.error) {
      endpointResult.errors.push({
        time: new Date().toISOString(),
        error: result.error,
        statusCode: result.statusCode,
      });
    }
  }

  endpointResult.responseTimes.push(result.responseTime);
  results.responseTimes.push(result.responseTime);

  // Record status code
  const statusKey = result.statusCode.toString();
  if (!results.statusCodes[statusKey]) {
    results.statusCodes[statusKey] = 0;
  }
  results.statusCodes[statusKey]++;

  if (!endpointResult.statusCodes[statusKey]) {
    endpointResult.statusCodes[statusKey] = 0;
  }
  endpointResult.statusCodes[statusKey]++;

  if (result.error) {
    results.errors.push({
      endpoint: endpoint.name,
      time: new Date().toISOString(),
      error: result.error,
      statusCode: result.statusCode,
    });
  }
}

// Get HTTP status code name
function getStatusName(code) {
  const statusNames = {
    200: '(OK)',
    201: '(Created)',
    204: '(No Content)',
    400: '(Bad Request)',
    401: '(Unauthorized)',
    403: '(Forbidden)',
    404: '(Not Found)',
    409: '(Conflict)',
    422: '(Unprocessable Entity)',
    500: '(Internal Server Error)',
    502: '(Bad Gateway)',
    503: '(Service Unavailable)',
    504: '(Gateway Timeout)',
  };
  return statusNames[code] || '';
}

// Calculate statistics
function calculateStats(responseTimes) {
  if (responseTimes.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...responseTimes].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);
  const p95 = sorted[p95Index] || sorted[sorted.length - 1];
  const p99 = sorted[p99Index] || sorted[sorted.length - 1];

  return { min, max, avg, median, p95, p99 };
}

// Simulate user load - runs continuously until stopped
let shouldStop = false;

async function simulateUser(userId) {
  let completed = 0;
  const maxRequests = CONFIG.requestsPerUser * 10; // Allow more requests for longer tests

  while (!shouldStop && completed < maxRequests) {
    const endpoint = selectEndpoint();
    if (!endpoint) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    const result = await makeRequest(endpoint);
    recordResult(endpoint, result);

    completed++;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Ramp up users gradually - optimized for large user counts
async function rampUpUsers() {
  const usersPerSecond = CONFIG.concurrentUsers / CONFIG.rampUpTime;
  const totalUsers = CONFIG.concurrentUsers;
  const batchSize = CONFIG.batchSize;
  
  console.log(`Starting ${totalUsers} users in batches of ${batchSize}...`);
  
  // Process users in batches to avoid memory issues with 10,000+ users
  for (let batchStart = 0; batchStart < totalUsers; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalUsers);
    const batchPromises = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const delay = Math.min((i / usersPerSecond) * 1000, CONFIG.rampUpTime * 1000);
      const promise = new Promise(resolve => {
        setTimeout(async () => {
          await simulateUser(i);
          resolve();
        }, delay);
      });
      batchPromises.push(promise);
    }

    // Don't wait for batch to complete, just start them
    Promise.all(batchPromises).catch(err => {
      console.error(`Error in batch ${batchStart}-${batchEnd}:`, err.message);
    });

    // Small delay between batches to avoid overwhelming the system
    if (batchEnd < totalUsers) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  // Wait for test duration - users will continue running
  await new Promise(resolve => setTimeout(resolve, CONFIG.testDuration * 1000));
}

// Generate detailed report
function generateReport() {
  const overallStats = calculateStats(results.responseTimes);
  const duration = Math.max((results.endTime - results.startTime) / 1000, 0.01); // seconds (min 0.01 to avoid division by zero)
  const requestsPerSecond = results.totalRequests / duration;
  const successRate = results.totalRequests > 0 ? (results.successfulRequests / results.totalRequests) * 100 : 0;

  let report = '';
  report += '='.repeat(80) + '\n';
  report += 'BARONI BACKEND LOAD TEST REPORT\n';
  report += '='.repeat(80) + '\n\n';

  report += `Test Configuration:\n`;
  report += `- Base URL: ${CONFIG.baseUrl}\n`;
  report += `- Concurrent Users: ${CONFIG.concurrentUsers}\n`;
  report += `- Requests Per User: ${CONFIG.requestsPerUser}\n`;
  report += `- Test Duration: ${CONFIG.testDuration} seconds\n`;
  report += `- Ramp Up Time: ${CONFIG.rampUpTime} seconds\n`;
  report += `- Admin Token: ${CONFIG.adminToken ? 'Provided' : 'Not Provided'}\n`;
  report += `- User Token: ${CONFIG.userToken ? 'Provided' : 'Not Provided'}\n\n`;

  report += `Test Execution:\n`;
  report += `- Start Time: ${new Date(results.startTime).toISOString()}\n`;
  report += `- End Time: ${new Date(results.endTime).toISOString()}\n`;
  report += `- Total Duration: ${duration.toFixed(2)} seconds\n\n`;

  report += '='.repeat(80) + '\n';
  report += 'OVERALL STATISTICS\n';
  report += '='.repeat(80) + '\n\n';

  report += `Total Requests: ${results.totalRequests.toLocaleString()}\n`;
  report += `Successful Requests: ${results.successfulRequests.toLocaleString()} (${successRate.toFixed(2)}%)\n`;
  report += `Failed Requests: ${results.failedRequests.toLocaleString()} (${(100 - successRate).toFixed(2)}%)\n`;
  report += `Requests Per Second: ${requestsPerSecond.toFixed(2)}\n`;
  report += `Total Endpoints Tested: ${Object.keys(results.endpointResults).filter(name => results.endpointResults[name].totalRequests > 0).length}\n`;
  report += `Total Endpoints Available: ${testEndpoints.length}\n\n`;

  report += `Response Time Statistics (ms):\n`;
  report += `- Minimum: ${overallStats.min.toFixed(2)} ms\n`;
  report += `- Maximum: ${overallStats.max.toFixed(2)} ms\n`;
  report += `- Average: ${overallStats.avg.toFixed(2)} ms\n`;
  report += `- Median (p50): ${overallStats.median.toFixed(2)} ms\n`;
  report += `- 95th Percentile (p95): ${overallStats.p95.toFixed(2)} ms\n`;
  report += `- 99th Percentile (p99): ${overallStats.p99.toFixed(2)} ms\n\n`;

  report += `HTTP Status Code Distribution:\n`;
  Object.keys(results.statusCodes)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(code => {
      const count = results.statusCodes[code];
      const percentage = (count / results.totalRequests) * 100;
      const statusName = getStatusName(code);
      report += `- ${code} ${statusName}: ${count.toLocaleString()} (${percentage.toFixed(2)}%)\n`;
    });
  report += '\n';

  // Test coverage summary
  const testedEndpoints = Object.keys(results.endpointResults).filter(name => results.endpointResults[name].totalRequests > 0);
  const untestedEndpoints = testEndpoints.filter(ep => !testedEndpoints.includes(ep.name));
  report += `Test Coverage:\n`;
  report += `- Endpoints Tested: ${testedEndpoints.length} / ${testEndpoints.length} (${((testedEndpoints.length / testEndpoints.length) * 100).toFixed(1)}%)\n`;
  if (untestedEndpoints.length > 0) {
    report += `- Untested Endpoints: ${untestedEndpoints.length}\n`;
    if (untestedEndpoints.length <= 10) {
      untestedEndpoints.forEach(ep => {
        const reason = ep.auth && ep.requiresToken && !CONFIG[`${ep.requiresToken}Token`] 
          ? ` (Missing ${ep.requiresToken} token)` 
          : '';
        report += `  * ${ep.name} - ${ep.method} ${ep.path}${reason}\n`;
      });
    }
  }
  report += '\n';

  // Group endpoints by category
  const endpointsByCategory = {};
  testEndpoints.forEach(endpoint => {
    const category = endpoint.category || 'Other';
    if (!endpointsByCategory[category]) {
      endpointsByCategory[category] = [];
    }
    endpointsByCategory[category].push(endpoint);
  });

  report += '='.repeat(80) + '\n';
  report += 'ENDPOINT-SPECIFIC RESULTS (GROUPED BY CATEGORY)\n';
  report += '='.repeat(80) + '\n\n';

  // Category summary
  report += 'Category Summary:\n';
  Object.keys(endpointsByCategory).sort().forEach(category => {
    const categoryEndpoints = endpointsByCategory[category];
    let categoryTotal = 0;
    let categorySuccess = 0;
    let categoryFailed = 0;
    
    categoryEndpoints.forEach(endpoint => {
      const result = results.endpointResults[endpoint.name];
      if (result) {
        categoryTotal += result.totalRequests;
        categorySuccess += result.successfulRequests;
        categoryFailed += result.failedRequests;
      }
    });
    
    const categorySuccessRate = categoryTotal > 0 ? (categorySuccess / categoryTotal) * 100 : 0;
    report += `- ${category}: ${categoryTotal} requests, ${categorySuccessRate.toFixed(2)}% success rate\n`;
  });
  report += '\n';

  // Detailed endpoint results by category
  Object.keys(endpointsByCategory).sort().forEach(category => {
    report += `\n${'─'.repeat(80)}\n`;
    report += `CATEGORY: ${category}\n`;
    report += `${'─'.repeat(80)}\n\n`;

    endpointsByCategory[category].forEach(endpoint => {
      const endpointResult = results.endpointResults[endpoint.name];
      
      if (!endpointResult || endpointResult.totalRequests === 0) {
        report += `Endpoint: ${endpoint.name}\n`;
        report += `  Path: ${endpoint.method} ${endpoint.path}\n`;
        report += `  Status: NOT TESTED (${endpoint.auth ? 'Requires Auth' : 'Public'})\n`;
        if (endpoint.requiresToken && !CONFIG[`${endpoint.requiresToken}Token`]) {
          report += `  Reason: ${endpoint.requiresToken} token not provided\n`;
        }
        report += '\n';
        return;
      }

      const endpointStats = calculateStats(endpointResult.responseTimes);
      const endpointSuccessRate = (endpointResult.successfulRequests / endpointResult.totalRequests) * 100;
      const requestsPerSecond = endpointResult.totalRequests / duration;

      report += `Endpoint: ${endpoint.name}\n`;
      report += `  Path: ${endpoint.method} ${endpoint.path}\n`;
      report += `  Category: ${category}\n`;
      report += `  Authentication: ${endpoint.auth ? (endpoint.requiresToken || 'Required') : 'Public'}\n`;
      report += `  Total Requests: ${endpointResult.totalRequests.toLocaleString()}\n`;
      report += `  Requests Per Second: ${requestsPerSecond.toFixed(2)}\n`;
      report += `  Successful: ${endpointResult.successfulRequests.toLocaleString()} (${endpointSuccessRate.toFixed(2)}%)\n`;
      report += `  Failed: ${endpointResult.failedRequests.toLocaleString()} (${(100 - endpointSuccessRate).toFixed(2)}%)\n`;
      report += `  Response Times (ms):\n`;
      report += `    * Minimum: ${endpointStats.min.toFixed(2)} ms\n`;
      report += `    * Maximum: ${endpointStats.max.toFixed(2)} ms\n`;
      report += `    * Average: ${endpointStats.avg.toFixed(2)} ms\n`;
      report += `    * Median (p50): ${endpointStats.median.toFixed(2)} ms\n`;
      report += `    * 95th Percentile (p95): ${endpointStats.p95.toFixed(2)} ms\n`;
      report += `    * 99th Percentile (p99): ${endpointStats.p99.toFixed(2)} ms\n`;

      // Performance rating
      let performanceRating = 'UNKNOWN';
      if (endpointStats.avg < 200) performanceRating = 'EXCELLENT';
      else if (endpointStats.avg < 500) performanceRating = 'GOOD';
      else if (endpointStats.avg < 1000) performanceRating = 'ACCEPTABLE';
      else performanceRating = 'NEEDS IMPROVEMENT';
      report += `  Performance Rating: ${performanceRating}\n`;

      if (Object.keys(endpointResult.statusCodes).length > 0) {
        report += `  Status Code Distribution:\n`;
        Object.keys(endpointResult.statusCodes)
          .sort((a, b) => parseInt(a) - parseInt(b))
          .forEach(code => {
            const count = endpointResult.statusCodes[code];
            const percentage = (count / endpointResult.totalRequests) * 100;
            const statusName = getStatusName(code);
            report += `    * ${code} ${statusName}: ${count.toLocaleString()} (${percentage.toFixed(2)}%)\n`;
          });
      }

      if (endpointResult.errors.length > 0) {
        report += `  Errors (showing first 20):\n`;
        endpointResult.errors.slice(0, 20).forEach(err => {
          report += `    * [${err.time}] Status ${err.statusCode}: ${err.error}\n`;
        });
        if (endpointResult.errors.length > 20) {
          report += `    * ... and ${endpointResult.errors.length - 20} more errors\n`;
        }
      }

      report += '\n';
    });
  });

  report += '='.repeat(80) + '\n';
  report += 'ERROR SUMMARY\n';
  report += '='.repeat(80) + '\n\n';

  if (results.errors.length === 0) {
    report += 'No errors encountered during the test.\n\n';
  } else {
    report += `Total Errors: ${results.errors.length}\n\n`;
    
    // Group errors by type
    const errorGroups = {};
    results.errors.forEach(err => {
      const key = `${err.statusCode || 'NO_STATUS'}_${err.error}`;
      if (!errorGroups[key]) {
        errorGroups[key] = {
          count: 0,
          statusCode: err.statusCode,
          error: err.error,
          endpoints: new Set(),
        };
      }
      errorGroups[key].count++;
      errorGroups[key].endpoints.add(err.endpoint);
    });

    Object.values(errorGroups)
      .sort((a, b) => b.count - a.count)
      .forEach(group => {
        report += `Error: ${group.error}\n`;
        report += `- Status Code: ${group.statusCode || 'N/A'}\n`;
        report += `- Occurrences: ${group.count}\n`;
        report += `- Affected Endpoints: ${Array.from(group.endpoints).join(', ')}\n\n`;
      });
  }

  report += '='.repeat(80) + '\n';
  report += 'PERFORMANCE ANALYSIS\n';
  report += '='.repeat(80) + '\n\n';

  // Performance thresholds
  const avgResponseTime = overallStats.avg;
  const p95ResponseTime = overallStats.p95;

  report += `Performance Assessment:\n`;
  if (avgResponseTime < 200) {
    report += `- Average Response Time: EXCELLENT (< 200ms)\n`;
  } else if (avgResponseTime < 500) {
    report += `- Average Response Time: GOOD (< 500ms)\n`;
  } else if (avgResponseTime < 1000) {
    report += `- Average Response Time: ACCEPTABLE (< 1s)\n`;
  } else {
    report += `- Average Response Time: NEEDS IMPROVEMENT (> 1s)\n`;
  }

  if (p95ResponseTime < 500) {
    report += `- 95th Percentile: EXCELLENT (< 500ms)\n`;
  } else if (p95ResponseTime < 1000) {
    report += `- 95th Percentile: GOOD (< 1s)\n`;
  } else if (p95ResponseTime < 2000) {
    report += `- 95th Percentile: ACCEPTABLE (< 2s)\n`;
  } else {
    report += `- 95th Percentile: NEEDS IMPROVEMENT (> 2s)\n`;
  }

  if (successRate >= 99) {
    report += `- Success Rate: EXCELLENT (>= 99%)\n`;
  } else if (successRate >= 95) {
    report += `- Success Rate: GOOD (>= 95%)\n`;
  } else if (successRate >= 90) {
    report += `- Success Rate: ACCEPTABLE (>= 90%)\n`;
  } else {
    report += `- Success Rate: NEEDS IMPROVEMENT (< 90%)\n`;
  }

  report += '\n';

  report += `Recommendations:\n`;
  if (avgResponseTime > 1000) {
    report += `- Consider optimizing slow endpoints to reduce average response time\n`;
  }
  if (p95ResponseTime > 2000) {
    report += `- Some requests are taking too long (p95 > 2s), investigate slow endpoints\n`;
  }
  if (successRate < 95) {
    report += `- High error rate detected, investigate and fix failing endpoints\n`;
  }
  if (requestsPerSecond < 10) {
    report += `- Low throughput detected, consider optimizing database queries or adding caching\n`;
  }
  if (results.errors.length > 0) {
    report += `- Review error logs above to identify and fix issues\n`;
  }

  report += '\n';
  report += '='.repeat(80) + '\n';
  report += 'EXECUTIVE SUMMARY\n';
  report += '='.repeat(80) + '\n\n';

  report += `Load Test Summary for ${CONFIG.concurrentUsers.toLocaleString()} Concurrent Users:\n\n`;
  report += `✓ Total Requests Processed: ${results.totalRequests.toLocaleString()}\n`;
  report += `✓ Average Throughput: ${requestsPerSecond.toFixed(2)} requests/second\n`;
  report += `✓ Success Rate: ${successRate.toFixed(2)}%\n`;
  report += `✓ Average Response Time: ${overallStats.avg.toFixed(2)} ms\n`;
  report += `✓ 95th Percentile Response Time: ${overallStats.p95.toFixed(2)} ms\n`;
  report += `✓ 99th Percentile Response Time: ${overallStats.p99.toFixed(2)} ms\n\n`;

  // Overall performance rating
  let overallRating = 'UNKNOWN';
  if (successRate >= 99 && overallStats.avg < 200 && overallStats.p95 < 500) {
    overallRating = 'EXCELLENT - System is performing exceptionally well under load';
  } else if (successRate >= 95 && overallStats.avg < 500 && overallStats.p95 < 1000) {
    overallRating = 'GOOD - System is handling load well with minor issues';
  } else if (successRate >= 90 && overallStats.avg < 1000 && overallStats.p95 < 2000) {
    overallRating = 'ACCEPTABLE - System is functional but needs optimization';
  } else {
    overallRating = 'NEEDS IMPROVEMENT - System is struggling under load';
  }

  report += `Overall Performance Rating: ${overallRating}\n\n`;

  // Key findings
  report += `Key Findings:\n`;
  if (successRate < 95) {
    report += `⚠ High error rate detected (${(100 - successRate).toFixed(2)}% failures)\n`;
  }
  if (overallStats.avg > 1000) {
    report += `⚠ Slow average response time (${overallStats.avg.toFixed(2)} ms)\n`;
  }
  if (overallStats.p95 > 2000) {
    report += `⚠ High p95 response time (${overallStats.p95.toFixed(2)} ms) - some requests are very slow\n`;
  }
  if (requestsPerSecond < 50 && CONFIG.concurrentUsers >= 1000) {
    report += `⚠ Low throughput for high concurrent user count\n`;
  }
  if (results.errors.length > 0) {
    report += `⚠ ${results.errors.length.toLocaleString()} errors encountered during testing\n`;
  }
  if (overallRating.includes('EXCELLENT') || overallRating.includes('GOOD')) {
    report += `✓ System is handling the load well\n`;
  }

  report += '\n';
  report += '='.repeat(80) + '\n';
  report += `Report Generated: ${new Date().toISOString()}\n`;
  report += `Test Duration: ${duration.toFixed(2)} seconds\n`;
  report += `Concurrent Users: ${CONFIG.concurrentUsers.toLocaleString()}\n`;
  report += '='.repeat(80) + '\n';

  return report;
}

// Save report to file
function saveReport(report) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `loadtest-report-${timestamp}.txt`;
  const filepath = path.join(__dirname, filename);
  
  fs.writeFileSync(filepath, report, 'utf8');
  console.log(`\nReport saved to: ${filepath}`);
  return filepath;
}

// Test server connection
async function testConnection() {
  try {
    const response = await axios.get(`${CONFIG.baseUrl}/`, { 
      timeout: 5000,
      validateStatus: () => true // Accept any status code
    });
    console.log('✓ Server connection successful');
    console.log(`  Status: ${response.status}\n`);
    return true;
  } catch (error) {
    console.error('✗ Server connection failed!');
    
    if (error.code === 'ECONNREFUSED') {
      console.error(`  Connection refused - Server is not running or not accessible`);
    } else if (error.code === 'ETIMEDOUT') {
      console.error(`  Connection timeout - Server took too long to respond`);
    } else if (error.code === 'ENOTFOUND') {
      console.error(`  Host not found - Check the base URL`);
    } else if (error.message) {
      console.error(`  Error: ${error.message}`);
    } else if (error.code) {
      console.error(`  Error Code: ${error.code}`);
    } else {
      console.error(`  Unknown error: ${JSON.stringify(error)}`);
    }
    
    console.error(`  Please ensure the server is running at ${CONFIG.baseUrl}`);
    console.error(`  You can start it with: cd baroni_backend && npm start\n`);
    return false;
  }
}

// Main test execution
async function runLoadTest() {
  console.log('Starting Load Test...');
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Concurrent Users: ${CONFIG.concurrentUsers}`);
  console.log(`Requests Per User: ${CONFIG.requestsPerUser}`);
  console.log(`Test Duration: ${CONFIG.testDuration} seconds\n`);

  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot proceed with load test. Server is not accessible.');
    process.exit(1);
  }

  results.startTime = Date.now();
  shouldStop = false;

  // Start the load test (users will run continuously)
  const testPromise = rampUpUsers();
  
  // Set a timeout to stop the test after the specified duration
  const durationPromise = new Promise(resolve => {
    setTimeout(() => {
      console.log('\nTest duration reached. Stopping test...');
      shouldStop = true;
      resolve();
    }, CONFIG.testDuration * 1000);
  });

  // Wait for either the test to complete or the duration to expire
  await Promise.race([testPromise, durationPromise]);
  
  // Give a moment for any in-flight requests to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.endTime = Date.now();

  console.log('\nTest completed. Generating report...');

  const report = generateReport();
  console.log('\n' + report);
  
  const reportPath = saveReport(report);
  console.log(`\nFull report saved to: ${reportPath}`);

  return reportPath;
}

// Run the test
runLoadTest().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});

