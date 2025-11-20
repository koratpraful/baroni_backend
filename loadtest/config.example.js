// Load Test Configuration Example
// Copy this file to config.js and update with your values

export default {
  // API Base URL
  baseUrl: 'http://localhost:4000',
  
  // Load Test Parameters
  concurrentUsers: 10,        // Number of concurrent users
  requestsPerUser: 50,        // Number of requests each user makes
  testDuration: 60,           // Test duration in seconds
  rampUpTime: 10,             // Time to ramp up all users (seconds)
  
  // Authentication Tokens (optional)
  // Get these by logging in through the API
  adminToken: '',             // Admin JWT token for admin endpoints
  userToken: '',              // User JWT token for protected endpoints
  
  // Advanced Options
  requestTimeout: 30000,      // Request timeout in milliseconds
  delayBetweenRequests: 100,  // Delay between requests in milliseconds
};


