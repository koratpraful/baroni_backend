#!/usr/bin/env node

/**
 * Quick API Tester for Baroni Backend
 * Simple script for quick API testing in VS Code
 * Usage: node quick-test.js
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:4000';
const API_URL = `${BASE_URL}/api`;

// Colors
const green = '\x1b[32m';
const red = '\x1b[31m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';

console.log(`${blue}🚀 Quick API Test - Baroni Backend${reset}`);
console.log(`${blue}Testing: ${BASE_URL}${reset}\n`);

// Quick test functions
async function quickTest() {
  try {
    // 1. Health Check
    console.log('1️⃣  Testing health endpoint...');
    const health = await axios.get(BASE_URL);
    console.log(`${green}✅ Health: ${health.data.service}${reset}\n`);

    // 2. Categories
    console.log('2️⃣  Testing categories endpoint...');
    const categories = await axios.get(`${API_URL}/category`);
    console.log(`${green}✅ Categories: ${categories.data.data?.length || 0} found${reset}\n`);

    // 3. Stars
    console.log('3️⃣  Testing stars endpoint...');
    const stars = await axios.get(`${API_URL}/star`);
    console.log(`${green}✅ Stars: ${stars.data.data?.stars?.length || 0} found${reset}\n`);

    // 4. Test authentication endpoint (should fail without token)
    console.log('4️⃣  Testing auth protection...');
    try {
      await axios.get(`${API_URL}/dashboard`);
      console.log(`${red}❌ Auth protection not working${reset}\n`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`${green}✅ Auth protection working (401)${reset}\n`);
      }
    }

    console.log(`${green}🎉 Quick test completed successfully!${reset}`);

  } catch (error) {
    console.log(`${red}❌ Error: ${error.message}${reset}`);
    console.log(`${red}Make sure your server is running on ${BASE_URL}${reset}`);
  }
}

// Manual testing helpers
const testAPI = {
  async get(endpoint) {
    try {
      const response = await axios.get(`${API_URL}${endpoint}`);
      console.log(`${green}✅ GET ${endpoint}${reset}`);
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.log(`${red}❌ GET ${endpoint} - ${error.message}${reset}`);
      if (error.response) {
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    }
  },

  async post(endpoint, data) {
    try {
      const response = await axios.post(`${API_URL}${endpoint}`, data);
      console.log(`${green}✅ POST ${endpoint}${reset}`);
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.log(`${red}❌ POST ${endpoint} - ${error.message}${reset}`);
      if (error.response) {
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    }
  },

  async authGet(endpoint, token) {
    try {
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`${green}✅ AUTH GET ${endpoint}${reset}`);
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.log(`${red}❌ AUTH GET ${endpoint} - ${error.message}${reset}`);
      if (error.response) {
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    }
  }
};

// Export for manual use
global.testAPI = testAPI;
global.API_URL = API_URL;
global.BASE_URL = BASE_URL;

// Common test data
global.testData = {
  user: {
    contact: '+1234567890',
    email: 'test@example.com',
    password: 'testpassword123'
  },
  star: {
    contact: '+9876543210',
    email: 'star@example.com',
    password: 'starpassword123',
    role: 'star'
  }
};

console.log(`${blue}Available commands:${reset}`);
console.log('• testAPI.get("/endpoint")');
console.log('• testAPI.post("/endpoint", data)');
console.log('• testAPI.authGet("/endpoint", token)');
console.log('• testData.user, testData.star\n');

// Run quick test by default
quickTest();