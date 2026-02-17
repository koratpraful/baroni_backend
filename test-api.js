#!/usr/bin/env node

/**
 * Baroni API Test Suite
 * Run this file to test all API endpoints directly in VS Code
 * Usage: node test-api.js
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Configuration
const BASE_URL = 'http://localhost:4000';
const API_URL = `${BASE_URL}/api`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test results storage
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
  testResults.passed++;
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
  testResults.failed++;
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logHeader(message) {
  log(`\n${'='.repeat(50)}`, colors.cyan);
  log(`🚀 ${message}`, colors.cyan);
  log(`${'='.repeat(50)}`, colors.cyan);
}

// Test function wrapper
async function testEndpoint(name, testFunction) {
  testResults.total++;
  try {
    await testFunction();
    testResults.details.push({ name, status: 'PASS' });
  } catch (error) {
    testResults.details.push({ name, status: 'FAIL', error: error.message });
    logError(`${name}: ${error.message}`);
  }
}

// API Test Functions
class BaroniAPITester {
  constructor() {
    this.authToken = null;
    this.testUserId = null;
    this.testStarId = null;
  }

  // 1. Health Check
  async testHealthCheck() {
    logInfo('Testing API health...');
    const response = await axios.get(BASE_URL);
    
    if (response.status === 200 && response.data.ok) {
      logSuccess('Health check passed');
      logInfo(`Service: ${response.data.service}`);
      logInfo(`Timestamp: ${response.data.timestamp}`);
    } else {
      throw new Error('Health check failed');
    }
  }

  // 2. User Registration
  async testUserRegistration() {
    logInfo('Testing user registration...');
    const userData = {
      contact: '+1234567890',
      email: 'test@example.com',
      password: 'testpassword123',
      fcmToken: 'test-fcm-token'
    };

    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      
      if (response.data.success) {
        logSuccess('User registration successful');
        this.testUserId = response.data.data?.user?._id;
        if (this.testUserId) {
          logInfo(`Created user ID: ${this.testUserId}`);
        }
      } else {
        logWarning(`Registration response: ${response.data.message}`);
      }
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        logWarning('User already exists - this is expected in tests');
      } else {
        throw error;
      }
    }
  }

  // 3. User Login
  async testUserLogin() {
    logInfo('Testing user login...');
    const loginData = {
      contact: '+1234567890',
      password: 'testpassword123'
    };

    try {
      const response = await axios.post(`${API_URL}/auth/login`, loginData);
      
      if (response.data.success && response.data.data?.accessToken) {
        logSuccess('User login successful');
        this.authToken = response.data.data.accessToken;
        logInfo('Auth token obtained for subsequent tests');
      } else {
        throw new Error('Login failed - no access token received');
      }
    } catch (error) {
      logWarning('Login test skipped - user may not exist yet');
    }
  }

  // 4. Get User Profile (requires auth)
  async testGetProfile() {
    if (!this.authToken) {
      logWarning('Skipping profile test - no auth token');
      return;
    }

    logInfo('Testing get user profile...');
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });

    if (response.data.success) {
      logSuccess('Profile retrieval successful');
      logInfo(`User: ${response.data.data?.name || 'N/A'} (${response.data.data?.role})`);
    } else {
      throw new Error('Profile retrieval failed');
    }
  }

  // 5. Get Categories
  async testGetCategories() {
    logInfo('Testing get categories...');
    const response = await axios.get(`${API_URL}/category`);

    if (response.data.success) {
      logSuccess('Categories retrieval successful');
      logInfo(`Found ${response.data.data?.length || 0} categories`);
    } else {
      throw new Error('Categories retrieval failed');
    }
  }

  // 6. Get Dashboard (requires auth)
  async testGetDashboard() {
    if (!this.authToken) {
      logWarning('Skipping dashboard test - no auth token');
      return;
    }

    logInfo('Testing get dashboard...');
    const response = await axios.get(`${API_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });

    if (response.data.success) {
      logSuccess('Dashboard retrieval successful');
      const data = response.data.data;
      
      if (data.featuredStars) {
        logInfo(`Featured stars: ${data.featuredStars.length}`);
      }
      if (data.availableStars) {
        logInfo(`Available stars: ${data.availableStars.length}`);
      }
      if (data.categories) {
        logInfo(`Categories: ${data.categories.length}`);
      }
    } else {
      throw new Error('Dashboard retrieval failed');
    }
  }

  // 7. Get All Stars
  async testGetAllStars() {
    logInfo('Testing get all stars...');
    const response = await axios.get(`${API_URL}/star`);

    if (response.data.success) {
      logSuccess('Stars retrieval successful');
      logInfo(`Found ${response.data.data?.stars?.length || 0} stars`);
      
      // Store a test star ID for other tests
      if (response.data.data?.stars?.length > 0) {
        this.testStarId = response.data.data.stars[0]._id;
        logInfo(`Test star ID: ${this.testStarId}`);
      }
    } else {
      throw new Error('Stars retrieval failed');
    }
  }

  // 8. Get Star Profile
  async testGetStarProfile() {
    if (!this.testStarId) {
      logWarning('Skipping star profile test - no star ID available');
      return;
    }

    logInfo('Testing get star profile...');
    const response = await axios.get(`${API_URL}/star/${this.testStarId}`);

    if (response.data.success) {
      logSuccess('Star profile retrieval successful');
      logInfo(`Star: ${response.data.data?.name || 'N/A'}`);
    } else {
      throw new Error('Star profile retrieval failed');
    }
  }

  // 9. Test Invalid Endpoint
  async testInvalidEndpoint() {
    logInfo('Testing invalid endpoint handling...');
    
    try {
      await axios.get(`${API_URL}/invalid-endpoint`);
      throw new Error('Should have returned 404');
    } catch (error) {
      if (error.response?.status === 404) {
        logSuccess('404 handling works correctly');
      } else {
        throw new Error('Unexpected error for invalid endpoint');
      }
    }
  }

  // 10. Test Unauthorized Access
  async testUnauthorizedAccess() {
    logInfo('Testing unauthorized access...');
    
    try {
      await axios.get(`${API_URL}/dashboard`);
      throw new Error('Should have returned 401');
    } catch (error) {
      if (error.response?.status === 401) {
        logSuccess('Auth protection works correctly');
      } else {
        throw new Error('Unexpected error for unauthorized access');
      }
    }
  }

  // Run all tests
  async runAllTests() {
    logHeader('BARONI API TESTING SUITE');
    logInfo(`Testing against: ${BASE_URL}`);
    logInfo(`Started at: ${new Date().toISOString()}\n`);

    // Basic connectivity tests
    await testEndpoint('Health Check', () => this.testHealthCheck());
    
    // Auth flow tests
    await testEndpoint('User Registration', () => this.testUserRegistration());
    await testEndpoint('User Login', () => this.testUserLogin());
    await testEndpoint('Get Profile', () => this.testGetProfile());
    
    // Public API tests
    await testEndpoint('Get Categories', () => this.testGetCategories());
    await testEndpoint('Get All Stars', () => this.testGetAllStars());
    await testEndpoint('Get Star Profile', () => this.testGetStarProfile());
    
    // Protected API tests
    await testEndpoint('Get Dashboard', () => this.testGetDashboard());
    
    // Error handling tests
    await testEndpoint('Invalid Endpoint (404)', () => this.testInvalidEndpoint());
    await testEndpoint('Unauthorized Access (401)', () => this.testUnauthorizedAccess());

    // Results summary
    this.printResults();
  }

  printResults() {
    logHeader('TEST RESULTS SUMMARY');
    
    log(`Total Tests: ${testResults.total}`, colors.blue);
    log(`Passed: ${testResults.passed}`, colors.green);
    log(`Failed: ${testResults.failed}`, colors.red);
    
    const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
    log(`Success Rate: ${successRate}%`, colors.cyan);
    
    if (testResults.failed > 0) {
      log('\nFailed Tests:', colors.red);
      testResults.details
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
          log(`  ❌ ${test.name}: ${test.error}`, colors.red);
        });
    }
    
    log(`\nCompleted at: ${new Date().toISOString()}`, colors.blue);
    log('='.repeat(50), colors.cyan);
  }
}

// Additional utility functions for manual testing
class APIUtils {
  static async makeRequest(method, endpoint, data = null, token = null) {
    const config = {
      method,
      url: endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await axios(config);
      console.log(`${colors.green}✅ ${method.toUpperCase()} ${endpoint}${colors.reset}`);
      console.log(`Status: ${response.status}`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.log(`${colors.red}❌ ${method.toUpperCase()} ${endpoint}${colors.reset}`);
      console.log(`Status: ${error.response?.status || 'Network Error'}`);
      console.log('Error:', error.response?.data || error.message);
      throw error;
    }
  }

  static async get(endpoint, token = null) {
    return this.makeRequest('get', endpoint, null, token);
  }

  static async post(endpoint, data, token = null) {
    return this.makeRequest('post', endpoint, data, token);
  }

  static async put(endpoint, data, token = null) {
    return this.makeRequest('put', endpoint, data, token);
  }

  static async delete(endpoint, token = null) {
    return this.makeRequest('delete', endpoint, null, token);
  }
}

// Export for use in other files
export { BaroniAPITester, APIUtils };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BaroniAPITester();
  
  tester.runAllTests().catch(error => {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}

/* 
USAGE EXAMPLES:

1. Run all tests:
   node test-api.js

2. Use in VS Code terminal or another file:
   import { APIUtils } from './test-api.js';
   
   // Make a quick GET request
   await APIUtils.get('/category');
   
   // Make a POST request with data
   await APIUtils.post('/auth/login', {
     contact: '+1234567890',
     password: 'testpassword123'
   });

3. Custom testing in VS Code:
   - Open VS Code terminal
   - Run: node test-api.js
   - Or import and use APIUtils for custom requests
*/