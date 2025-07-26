# 🚀 CopyTrade Pro - Installation Guide

## Quick Installation

### ⚡ One-Command Setup (Recommended)
```bash
git clone <repository-url>
cd copytrade-pro
npm install
```

That's it! The `npm install` command automatically:
1. Installs root dependencies
2. Installs and builds all dev-packages in correct order
3. Installs backend dependencies
4. Installs frontend dependencies  
5. Installs e2e test dependencies

### 🏃‍♂️ Start Development
```bash
npm run dev
```

## Alternative Installation Methods

### 🧹 Fresh Installation
If you want to start completely fresh:
```bash
npm run setup:fresh
```

### 🎯 Manual Step-by-Step
If you prefer manual control:
```bash
npm run install:dev-packages    # Install and build dev-packages first
npm run install:backend         # Install backend dependencies
npm run install:frontend        # Install frontend dependencies
npm run install:e2e            # Install e2e test dependencies
```

## Verification

### ✅ Verify Installation
```bash
npm run verify                  # Check all packages
npm run verify:backend          # Check backend only
npm run verify:frontend         # Check frontend only
npm run verify:e2e             # Check e2e only
```

### 🔍 Check What's Installed
```bash
npm ls                          # Root dependencies
cd backend && npm ls            # Backend dependencies
cd frontend && npm ls           # Frontend dependencies
cd e2e-tests && npm ls          # E2E dependencies
```

## Troubleshooting

### 🚨 Installation Issues

**Problem: Dev-packages not found**
```bash
npm run build:dev-packages     # Rebuild dev-packages
```

**Problem: Dependencies out of sync**
```bash
npm run reset                   # Nuclear option - clean and reinstall everything
```

**Problem: Specific package issues**
```bash
npm run reset:backend          # Reset backend only
npm run reset:frontend         # Reset frontend only
npm run reset:e2e             # Reset e2e only
```

**Problem: Build failures**
```bash
npm run clean                   # Clean build artifacts
npm run build:dev-packages     # Rebuild dev-packages
npm run build                   # Build everything
```

### 🔧 Manual Fixes

**Clear everything and start over:**
```bash
npm run clean:all              # Remove all node_modules and build artifacts
npm install                    # Reinstall everything
```

**Dev-packages dependency issues:**
```bash
npm run clean:dev-packages     # Clean dev-packages
npm run install:dev-packages   # Reinstall and rebuild dev-packages
```

## What Gets Installed

### 📦 Package Structure
```
copytrade-pro/
├── node_modules/              # Root dependencies (concurrently, etc.)
├── backend/node_modules/      # Backend dependencies (express, mongoose, etc.)
├── frontend/node_modules/     # Frontend dependencies (react, vite, etc.)
├── e2e-tests/node_modules/    # E2E dependencies (playwright, etc.)
└── dev-packages/
    ├── shared-types/node_modules/     # TypeScript compiler
    ├── unified-broker/node_modules/   # TypeScript + dependencies
    ├── broker-shoonya/node_modules/   # TypeScript + broker deps
    └── broker-fyers/node_modules/     # TypeScript + broker deps
```

### 🔗 Dev-Packages Dependencies
The dev-packages are installed and built in this order:
1. `shared-types` - Common TypeScript interfaces
2. `unified-broker` - Core broker abstraction (depends on shared-types)
3. `broker-shoonya` - Shoonya implementation (depends on unified-broker)
4. `broker-fyers` - Fyers implementation (depends on unified-broker)

### 📋 Installation Order
When you run `npm install`, this happens automatically:
1. **preinstall**: Shows installation message
2. **install**: Installs root dependencies
3. **postinstall**: Runs `install:all` which:
   - Installs dev-packages (with builds)
   - Installs backend dependencies
   - Installs frontend dependencies
   - Installs e2e dependencies

## Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Operating System**: macOS, Linux, or Windows
- **Memory**: At least 4GB RAM recommended
- **Disk Space**: ~2GB for all dependencies

## Success Indicators

After successful installation, you should see:
- ✅ All `node_modules` directories created
- ✅ Dev-packages built (dist/ folders exist)
- ✅ No error messages in installation output
- ✅ `npm run verify` passes for all packages
- ✅ `npm run dev` starts both servers successfully