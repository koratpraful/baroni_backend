#!/usr/bin/env node

/**
 * Endpoint Discovery Script
 * Automatically scans route files and generates endpoint mapping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesDir = path.join(__dirname, 'routes', 'api');
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}🔍 Scanning API Endpoints...${colors.reset}\n`);

// Read main routes file to get base routes
const mainRoutesPath = path.join(__dirname, 'routes', 'index.js');
const mainRoutes = fs.readFileSync(mainRoutesPath, 'utf8');

// Extract base route mappings
const routePattern = /router\.use\(['"]([^'"]+)['"],\s*(\w+)\)/g;
const baseRoutes = {};
let match;

while ((match = routePattern.exec(mainRoutes)) !== null) {
  const [, route, routerName] = match;
  baseRoutes[route] = routerName;
}

console.log(`${colors.blue}📋 Base Routes Found:${colors.reset}`);
Object.entries(baseRoutes).forEach(([route, router]) => {
  console.log(`  /api${route} → ${router}`);
});
console.log('');

// Scan individual route files
const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
const endpointSummary = {};

routeFiles.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract HTTP method calls
  const methodPattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
  const endpoints = [];
  
  let methodMatch;
  while ((methodMatch = methodPattern.exec(content)) !== null) {
    const [, method, endpoint] = methodMatch;
    endpoints.push({
      method: method.toUpperCase(),
      path: endpoint,
      fullPath: `/api${getBaseRouteForFile(file)}${endpoint === '/' ? '' : endpoint}`
    });
  }
  
  if (endpoints.length > 0) {
    const baseName = file.replace('.js', '');
    endpointSummary[baseName] = {
      file: file,
      baseRoute: getBaseRouteForFile(file),
      endpoints: endpoints
    };
  }
});

function getBaseRouteForFile(fileName) {
  const baseName = fileName.replace('.js', '');
  
  // Handle special cases
  const specialCases = {
    'auth': '/auth',
    'star': '/star',
    'category': '/category',
    'dashboard': '/dashboard',
    'dedications': '/dedications',
    'dedicationRequests': '/dedication-requests',
    'dedicationSamples': '/dedication-samples',
    'services': '/services',
    'availabilities': '/availabilities',
    'appointments': '/appointments',
    'transactions': '/transactions',
    'paymentCallback': '/payment',
    'favorites': '/favorites',
    'liveShows': '/live-shows',
    'reportUsers': '/report-users',
    'messaging': '/messages',
    'agora': '/agora',
    'notifications': '/notifications',
    'ratings': '/ratings',
    'analytics': '/analytics',
    'config': '/config',
    'contactSupport': '/contact-support',
    'events': '/events',
    'ads': '/ads',
    'admin': '/admin',
    'adminDashboard': '/admin/dashboard',
    'adminManagement': '/admin/management',
    'adminRatingManagement': '/admin/rating-management',
    'supportManager': '/support-manager'
  };
  
  return specialCases[baseName] || `/${baseName}`;
}

// Display results
console.log(`${colors.green}📊 Endpoints Summary:${colors.reset}\n`);

Object.entries(endpointSummary).forEach(([name, data]) => {
  console.log(`${colors.yellow}📁 ${data.file}${colors.reset}`);
  console.log(`   Base: /api${data.baseRoute}`);
  console.log(`   Endpoints: ${data.endpoints.length}`);
  
  data.endpoints.forEach(endpoint => {
    console.log(`   ${endpoint.method.padEnd(6)} ${endpoint.fullPath}`);
  });
  console.log('');
});

// Generate summary statistics
const totalEndpoints = Object.values(endpointSummary).reduce(
  (sum, data) => sum + data.endpoints.length, 0
);

const methodCounts = {};
Object.values(endpointSummary).forEach(data => {
  data.endpoints.forEach(endpoint => {
    methodCounts[endpoint.method] = (methodCounts[endpoint.method] || 0) + 1;
  });
});

console.log(`${colors.cyan}📈 Statistics:${colors.reset}`);
console.log(`   Total Files: ${routeFiles.length}`);
console.log(`   Total Endpoints: ${totalEndpoints}`);
console.log(`   Methods:`);
Object.entries(methodCounts).forEach(([method, count]) => {
  console.log(`     ${method}: ${count}`);
});

// Export results as JSON
const outputPath = path.join(__dirname, 'endpoints-mapping.json');
fs.writeFileSync(outputPath, JSON.stringify({
  baseRoutes,
  endpoints: endpointSummary,
  statistics: {
    totalFiles: routeFiles.length,
    totalEndpoints,
    methodCounts
  }
}, null, 2));

console.log(`\n${colors.green}✅ Endpoint mapping saved to: ${outputPath}${colors.reset}`);

export { endpointSummary, baseRoutes };