# 🚀 CopyTrade Pro - Quick Start Guide

## ⚡ Super Simple Setup & Development

### 🎯 Simple Setup
```bash
npm run install:all
npm run build
```
This will:
- ✅ Install backend and frontend dependencies
- ✅ Build both backend and frontend
- ✅ Copy frontend to backend/public

### 🔥 Start Development
```bash
npm run dev
```
This will:
- ✅ Start backend server on http://localhost:3001
- ✅ Start frontend server on http://localhost:5173
- ✅ Auto-restart on file changes

### 🏗️ Build for Production
```bash
npm run build
```
This will:
- ✅ Build backend TypeScript to JavaScript
- ✅ Build frontend React app
- ✅ Copy frontend to backend/public

### 🚀 Start Production Server
```bash
npm start
```

---

## 📋 All Available Commands

| Command | Description |
|---------|-------------|
| `npm run install:all` | 📦 Install all dependencies |
| `npm run dev` | 🔥 Start development servers |
| `npm run build` | 🏗️ Build for production |
| `npm start` | 🚀 Start production server |
| `npm run clean` | 🧹 Clean all build files |

### 🔧 Advanced Commands

| Command | Description |
|---------|-------------|
| `npm run dev:simple` | Start dev servers with basic concurrently |
| `npm run dev:backend` | Start only backend dev server |
| `npm run dev:frontend` | Start only frontend dev server |
| `npm run build:backend` | Build only backend |
| `npm run build:frontend` | Build only frontend |

---

## 🎯 Quick Development Workflow

### First Time Setup:
```bash
git clone <repository>
cd copyTradeV2
npm run install:all
npm run build
```

### Daily Development:
```bash
npm run dev
# Edit your code
# Servers auto-restart
```

### Before Deployment:
```bash
npm run build
npm start  # Test production build
```

---

## 🔧 Configuration

### Environment Variables
After running `npm run setup`, edit `backend/.env`:

```env
# Required: Update these with your broker credentials
SHOONYA_USER_ID=your_user_id
SHOONYA_PASSWORD=your_password
SHOONYA_VENDOR_CODE=your_vendor_code
SHOONYA_API_KEY=your_api_key
SHOONYA_IMEI=your_imei
SHOONYA_TOTP_SECRET=your_totp_secret

FYERS_CLIENT_ID=your_client_id
FYERS_SECRET_KEY=your_secret_key
FYERS_REDIRECT_URI=your_redirect_uri
```

---

## 🌐 Development URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

---

## 🆘 Troubleshooting

### Dependencies Issues:
```bash
npm run clean
npm run install
```

### Build Issues:
```bash
npm run clean
npm run build
```

### Port Already in Use:
- Frontend: Change port in `frontend/vite.config.ts`
- Backend: Change `PORT` in `backend/.env`

### Manual Setup (if scripts fail):
```bash
# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Build
cd backend && npm run build
cd ../frontend && npm run build
cd ..

# Copy frontend
mkdir -p backend/public
cp -r frontend/dist/* backend/public/
```

---

## 🎉 Features

- ✅ **Zero Shell Scripting** - Pure Node.js scripts
- ✅ **Smart Dependency Checking** - Auto-install missing deps
- ✅ **Colored Logging** - Easy to read dev logs
- ✅ **Graceful Shutdown** - Ctrl+C stops both servers
- ✅ **Production Ready** - Optimized build process
- ✅ **Cross Platform** - Works on Windows, Mac, Linux

---

## 📚 Next Steps

1. **Configure Brokers**: Update `.env` with your credentials
2. **Start Trading**: Use the web interface
3. **Deploy**: Follow `DEPLOYMENT_GUIDE.md`
4. **Customize**: Check plugin system in `broker-plugins/`

---

**🎯 That's it! Super simple, no complex scripting needed!**
