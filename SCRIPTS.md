# 📋 CopyTrade Pro - Package Scripts Reference

## 🚀 Quick Start
```bash
npm install            # Automatically installs ALL dependencies (root + all packages)
npm run dev            # Start development servers
```

## 🔧 Setup Scripts
```bash
npm install            # Installs everything automatically (recommended)
npm run setup          # Alternative setup command with success message
npm run setup:fresh    # Clean everything and setup from scratch
npm run verify         # Verify all packages have dependencies installed
```

## 📦 Installation Scripts

### ⚡ Automatic Installation (Recommended)
```bash
npm install               # Automatically installs ALL dependencies via postinstall hook
```

### 🎯 Manual Installation (Advanced)
```bash
npm run install:all           # Install all packages (backend + frontend + e2e + dev-packages)
npm run install:backend       # Install backend dependencies only
npm run install:frontend      # Install frontend dependencies only  
npm run install:e2e          # Install e2e test dependencies only
npm run install:dev-packages # Install dev-packages dependencies (builds them too)
```

### 🔍 Verification Scripts
```bash
npm run verify               # Verify all packages have dependencies installed
npm run verify:backend       # Check backend dependencies
npm run verify:frontend      # Check frontend dependencies
npm run verify:e2e          # Check e2e dependencies
npm run verify:dev-packages # Check dev-packages dependencies
```

## 🏗️ Build Scripts
```bash
npm run build                    # Full production build (backend + frontend + copy)
npm run build:quick             # Quick development build (faster, less strict)
npm run build:backend           # Build backend TypeScript to dist/
npm run build:frontend          # Build frontend with Vite (production)
npm run build:frontend:quick    # Build frontend in development mode
npm run build:dev-packages      # Build all dev-packages
npm run copy:frontend           # Copy frontend dist to backend/public
```

### Dev-Packages Build Scripts
```bash
npm run build:dev-packages:shared-types    # Build shared types package
npm run build:dev-packages:unified-broker  # Build unified broker package  
npm run build:dev-packages:broker-shoonya  # Build Shoonya broker package
npm run build:dev-packages:broker-fyers    # Build Fyers broker package
```

## 🧹 Clean Scripts

### Basic Clean (removes build artifacts)
```bash
npm run clean              # Clean all build artifacts
npm run clean:backend      # Clean backend dist, coverage, logs
npm run clean:frontend     # Clean frontend dist, coverage, .vite, logs
npm run clean:e2e         # Clean e2e test results, reports, logs
```

### Deep Clean (removes node_modules too)
```bash
npm run clean:all              # Deep clean everything + root node_modules
npm run clean:all:backend      # Deep clean backend (dist + node_modules)
npm run clean:all:frontend     # Deep clean frontend (dist + node_modules)
npm run clean:all:e2e         # Deep clean e2e (results + node_modules)
npm run clean:dev-packages    # Clean all dev-packages (dist + node_modules)
```

## 🔄 Reset Scripts (clean + reinstall)
```bash
npm run reset              # Full reset: clean all + reinstall all
npm run reset:backend      # Reset backend only
npm run reset:frontend     # Reset frontend only
npm run reset:e2e         # Reset e2e only (includes browser install)
```

## 🚀 Development Scripts
```bash
npm run dev              # Start both backend and frontend in development
npm run dev:backend      # Start backend development server (nodemon)
npm run dev:frontend     # Start frontend development server (Vite)
npm start               # Start production backend server
```

## 🧪 Test Scripts
```bash
npm run test              # Run all tests (unit + e2e)
npm run test:unit         # Run unit tests (backend + frontend)
npm run test:backend      # Run backend Jest tests
npm run test:frontend     # Run frontend Vitest tests
npm run test:e2e         # Run Playwright e2e tests
npm run test:e2e:headed  # Run e2e tests with browser UI
npm run test:e2e:ui      # Run e2e tests with Playwright UI
```

## 📊 Individual Package Scripts

### Backend (`cd backend && npm run <script>`)
- `build` - Compile TypeScript
- `dev` - Start with nodemon
- `start` - Start production server
- `clean` - Remove dist, coverage, logs
- `clean:all` - Deep clean + remove node_modules
- `reset` - Clean all + reinstall
- `test` - Run Jest tests
- `test:watch` - Run Jest in watch mode
- `test:coverage` - Run tests with coverage

### Frontend (`cd frontend && npm run <script>`)
- `build` - Production build with Vite
- `build:dev` - Development build
- `dev` - Start Vite dev server
- `clean` - Remove dist, coverage, .vite, logs
- `clean:all` - Deep clean + remove node_modules
- `reset` - Clean all + reinstall
- `test` - Run Vitest tests
- `test:watch` - Run Vitest in watch mode
- `test:coverage` - Run tests with coverage
- `lint` - Run ESLint

### E2E Tests (`cd e2e-tests && npm run <script>`)
- `test` - Run Playwright tests
- `test:headed` - Run tests with browser UI
- `test:debug` - Run tests in debug mode
- `test:ui` - Run with Playwright UI
- `test:report` - Show test report
- `clean` - Remove test results, reports, logs
- `clean:all` - Deep clean + remove node_modules
- `reset` - Clean all + reinstall + install browsers
- `install-browsers` - Install Playwright browsers

## 🔧 Troubleshooting

### Common Issues & Solutions

**Build fails with TypeScript errors:**
```bash
npm run build:quick    # Use development build (less strict)
```

**Dependencies out of sync:**
```bash
npm run reset          # Full reset of all packages
```

**Dev-packages not building:**
```bash
npm run build:dev-packages    # Rebuild all dev-packages
```

**E2E tests fail:**
```bash
cd e2e-tests && npm run install-browsers    # Reinstall browsers
```

**Clean everything and start fresh:**
```bash
npm run clean:all      # Nuclear option - removes everything
npm run install:all    # Reinstall everything
npm run build:dev-packages    # Rebuild dev-packages
npm run build          # Build main packages
```

## 📁 What Gets Cleaned

### `npm run clean` removes:
- `backend/dist/` - Compiled TypeScript
- `backend/coverage/` - Test coverage reports
- `frontend/dist/` - Vite build output
- `frontend/.vite/` - Vite cache
- `e2e-tests/test-results/` - Playwright results
- `e2e-tests/playwright-report/` - Test reports
- `*.log` files - Log files

### `npm run clean:all` additionally removes:
- `node_modules/` - All dependencies
- `package-lock.json` - Lock files
- Dev-packages `dist/` and `node_modules/`

## ⚡ Performance Tips

1. **Use specific scripts** - Don't run `npm run install:all` if you only need backend
2. **Use quick build** - `npm run build:quick` for development
3. **Clean selectively** - Use `npm run clean:backend` instead of full clean
4. **Reset only when needed** - `npm run reset` is slow, use `npm run clean` first