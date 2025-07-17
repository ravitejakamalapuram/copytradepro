# Tech Stack & Build System

## Architecture
- **Monorepo Structure**: Root package with backend, frontend, and dev-packages
- **Plugin Architecture**: Unified broker system with pluggable broker adapters
- **Real-time Communication**: WebSocket-based live data streaming

## Backend Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcryptjs password hashing
- **Real-time**: Socket.IO for WebSocket communication
- **Security**: Helmet, CORS, rate limiting, input validation

## Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and building
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **Styling**: CSS3 with custom design system

## Dev Packages (Monorepo)
- **@copytrade/shared-types**: Common TypeScript interfaces
- **@copytrade/unified-broker**: Core broker abstraction layer
- **@copytrade/broker-fyers**: Fyers broker plugin
- **@copytrade/broker-shoonya**: Shoonya broker plugin

## Common Commands

### Development
```bash
# Install all dependencies
npm run install

# Start development servers (both backend and frontend)
npm run dev

# Start backend only
cd backend && npm run dev

# Start frontend only  
cd frontend && npm run dev
```

### Building
```bash
# Build everything (backend + frontend)
npm run build

# Build backend only
cd backend && npm run build

# Build frontend only
cd frontend && npm run build
```

### Production
```bash
# Start production server
npm start

# Clean build artifacts
npm run clean
```

### Dev Packages
```bash
# Build a dev package
cd dev-packages/[package-name] && npm run build

# Test local changes temporarily
cd backend && npm install file:../dev-packages/[package-name]
```

## Environment Requirements
- Node.js >= 18.0.0
- npm >= 8.0.0
- TypeScript 5.x
- Modern browser with ES2020 support