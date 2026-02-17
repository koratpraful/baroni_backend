# Project Cleanup Scripts

This directory contains scripts to clean your Baroni project and free up storage space.

## Available Cleanup Methods

### Method 1: Using npm script (Recommended)

```bash
npm run clean
# or
npm run clean:project
```

### Method 2: Using Node.js script directly

```bash
node scripts/cleanProject.js
```

### Method 3: Using bash script

```bash
./scripts/clean.sh
```

## What Gets Cleaned

The cleanup scripts remove:

### 📦 **Package Management Files**

- `node_modules/` directory (all downloaded packages)
- `package-lock.json` (dependency lock file)
- `yarn.lock` (Yarn lock file)
- `.npm/` (npm cache directory)
- `.yarn/` (Yarn directory)

### 🗃️ **Cache & Temporary Files**

- npm cache
- `.nyc_output/` (test coverage)
- `coverage/` (test coverage reports)
- `logs/` (application logs)
- `.cache/` (various caches)
- `dist/`, `build/`, `out/` (build outputs)
- `.next/`, `.nuxt/` (framework specific)

### 📝 **Log Files**

- `*.log` (all log files)
- `npm-debug.log*`
- `yarn-debug.log*`
- `yarn-error.log*`
- `lerna-debug.log*`

### 🖥️ **OS Specific Files**

- `.DS_Store` (macOS)
- `Thumbs.db` (Windows)
- `desktop.ini` (Windows)

## What Stays Safe

✅ **Your source code and configurations remain untouched:**

- All `.js`, `.json`, `.md` files
- `package.json` (your dependency definitions)
- `.env` files (environment configurations)
- `config/`, `controllers/`, `models/`, `routes/` directories
- `.git/` directory (your version control)
- All other project files

## Storage Benefits

Typically saves **100-500 MB** or more depending on your dependencies.

## To Restart After Cleanup

```bash
# Reinstall dependencies
npm install

# Start development server
npm run dev
```

## When to Use

- ✅ Before archiving/storing the project
- ✅ When switching between projects
- ✅ When running low on disk space
- ✅ Before pushing to Git (to avoid large repos)
- ✅ When project dependencies get corrupted

## Safety

These scripts are designed to be **safe** - they only remove generated/downloaded files, never your source code.
