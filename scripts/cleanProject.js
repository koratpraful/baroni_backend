#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🧹 Starting project cleanup...\n');

// Function to run shell commands safely
function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    console.log(`✅ ${description} completed\n`);
  } catch (error) {
    console.log(`⚠️  ${description} - No files to clean or already clean\n`);
  }
}

// Function to remove files/directories safely
function removeIfExists(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  try {
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      console.log(`✅ Removed ${description}`);
    } else {
      console.log(`ℹ️  ${description} - Already clean`);
    }
  } catch (error) {
    console.log(`⚠️  Could not remove ${description}: ${error.message}`);
  }
}

// Function to get directory size in MB
function getDirectorySize(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    
    let totalSize = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    return 0;
  }
}

// Calculate initial size
const initialNodeModulesPath = path.join(projectRoot, 'node_modules');
const initialSize = getDirectorySize(initialNodeModulesPath);
const initialSizeMB = (initialSize / (1024 * 1024)).toFixed(2);

console.log(`📊 Current node_modules size: ${initialSizeMB} MB\n`);

// Stop any running processes
console.log('🛑 Stopping running Node.js processes...');
try {
  execSync('pkill -f "node\\|nodemon" 2>/dev/null || true', { stdio: 'inherit' });
  console.log('✅ Processes stopped\n');
} catch (error) {
  console.log('ℹ️  No running processes found\n');
}

// Clean npm/yarn files and directories
console.log('🗂️  Cleaning package management files...');
removeIfExists('node_modules', 'node_modules directory');
removeIfExists('package-lock.json', 'package-lock.json');
removeIfExists('yarn.lock', 'yarn.lock');
removeIfExists('.npm', '.npm cache directory');
removeIfExists('.yarn', '.yarn directory');
console.log('');

// Clean cache and temporary files
console.log('🗃️  Cleaning cache and temporary files...');
runCommand('npm cache clean --force 2>/dev/null || true', 'Clearing npm cache');

// Clean various temporary and log files
const tempFiles = [
  '.nyc_output',
  'coverage', 
  'logs',
  '.cache',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'out'
];

tempFiles.forEach(file => {
  removeIfExists(file, file);
});

// Clean log files with patterns
console.log('📝 Cleaning log files...');
try {
  const logPatterns = [
    'npm-debug.log*',
    'yarn-debug.log*', 
    'yarn-error.log*',
    'lerna-debug.log*',
    '*.log'
  ];
  
  logPatterns.forEach(pattern => {
    try {
      execSync(`find . -name "${pattern}" -type f -delete 2>/dev/null || true`, { cwd: projectRoot });
    } catch (error) {
      // Ignore errors for missing files
    }
  });
  console.log('✅ Log files cleaned\n');
} catch (error) {
  console.log('ℹ️  No log files to clean\n');
}

// Clean OS specific files (optional)
console.log('🖥️  Cleaning OS specific files...');
const osFiles = [
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini'
];

try {
  execSync(`find . -name ".DS_Store" -type f -delete 2>/dev/null || true`, { cwd: projectRoot });
  execSync(`find . -name "Thumbs.db" -type f -delete 2>/dev/null || true`, { cwd: projectRoot });
  execSync(`find . -name "desktop.ini" -type f -delete 2>/dev/null || true`, { cwd: projectRoot });
  console.log('✅ OS files cleaned\n');
} catch (error) {
  console.log('ℹ️  No OS files to clean\n');
}

// Calculate space saved
const finalSize = getDirectorySize(initialNodeModulesPath);
const spaceSaved = ((initialSize - finalSize) / (1024 * 1024)).toFixed(2);

console.log('📊 Cleanup Summary:');
console.log(`   • Space freed: ${spaceSaved} MB`);
console.log(`   • Project is now clean and ready for storage`);
console.log('');

console.log('🎯 To restart the project later:');
console.log('   1. npm install');
console.log('   2. npm run dev');
console.log('');

console.log('✨ Cleanup completed successfully!');