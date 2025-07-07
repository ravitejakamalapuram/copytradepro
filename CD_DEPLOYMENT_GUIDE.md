# 🚀 Continuous Deployment (CD) Guide

## 📋 How Dependencies Work in CD Pipelines

### **🎯 The Challenge**
Most CD platforms expect a simple workflow:
1. `npm install` (install dependencies)
2. `npm run build` (build the app)
3. `npm start` (start the app)

But our monorepo has dependencies in multiple directories.

---

## **✅ Recommended Solutions**

### **Option 1: Custom Build Command (Recommended)**
```yaml
# Platform Configuration
Build Command: npm run install:all && npm run build
Start Command: cd backend && npm start
```

**How it works:**
1. CD platform runs: `npm run install:all && npm run build`
2. install:all installs backend + frontend dependencies
3. build compiles everything
4. Platform runs: `cd backend && npm start`

### **Option 2: Dockerfile**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm run install:all
RUN npm run build
CMD ["sh", "-c", "cd backend && npm start"]
```

---

## **🌐 Platform-Specific Configurations**

### **Render.com**
```yaml
# render.yaml or Dashboard settings
build:
  buildCommand: npm run install:all && npm run build
  startCommand: cd backend && npm start

# Environment Variables:
NODE_ENV=production
PORT=10000  # Render assigns this
```

### **Railway**
```yaml
# railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd backend && npm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### **Vercel (Frontend + Serverless Functions)**
```json
// vercel.json
{
  "buildCommand": "npm run build:frontend",
  "outputDirectory": "frontend/dist",
  "functions": {
    "backend/src/index.ts": {
      "runtime": "@vercel/node"
    }
  }
}
```

### **Heroku**
```json
// package.json
{
  "scripts": {
    "heroku-postbuild": "npm run build"
  },
  "engines": {
    "node": "18.x",
    "npm": "8.x"
  }
}
```

### **Netlify**
```toml
# netlify.toml
[build]
  command = "npm run build:frontend"
  publish = "frontend/dist"

[build.environment]
  NODE_VERSION = "18"
```

### **DigitalOcean App Platform**
```yaml
# .do/app.yaml
name: copytrade-pro
services:
- name: backend
  source_dir: /
  github:
    repo: your-repo
    branch: main
  run_command: cd backend && npm start
  build_command: npm run build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
```

---

## **🔧 Alternative Approaches**

### **1. Dockerfile Approach**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["sh", "-c", "cd backend && npm start"]
```

### **2. Multi-Stage Build**
```dockerfile
# Multi-stage Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/public ./backend/public
COPY --from=builder /app/backend/package*.json ./backend/
RUN cd backend && npm install --production
EXPOSE 3001
CMD ["sh", "-c", "cd backend && npm start"]
```

### **3. Separate Deployments**
```yaml
# Deploy frontend and backend separately
Frontend (Netlify/Vercel):
  - Build: npm run build:frontend
  - Deploy: frontend/dist

Backend (Railway/Render):
  - Build: npm run build:backend
  - Start: cd backend && npm start
```

---

## **⚡ Quick Setup for Popular Platforms**

### **Render.com (Recommended)**
1. Connect your GitHub repo
2. Set build command: `npm run build`
3. Set start command: `cd backend && npm start`
4. Add environment variables
5. Deploy! ✅

### **Railway**
1. Connect GitHub repo
2. Railway auto-detects Node.js
3. Set start command: `cd backend && npm start`
4. Add environment variables
5. Deploy! ✅

### **Heroku**
1. Connect GitHub repo
2. Heroku auto-runs `npm install` and `npm run build`
3. Set start command in Procfile: `web: cd backend && npm start`
4. Add environment variables
5. Deploy! ✅

---

## **🔍 Troubleshooting CD Issues**

### **Build Fails: "Cannot find module"**
```bash
# Check if postinstall ran
npm run install:all

# Verify dependencies
ls backend/node_modules
ls frontend/node_modules
```

### **Build Succeeds but Start Fails**
```bash
# Check if build output exists
ls backend/dist
ls backend/public

# Test locally
npm run build
cd backend && npm start
```

### **Environment Variables Missing**
```bash
# Check required vars in backend/.env
DATABASE_TYPE=mongodb
MONGODB_URI=your_connection_string
JWT_SECRET=your_secret
```

---

## **📊 Deployment Checklist**

### **Before Deployment:**
- [ ] `npm run build` works locally
- [ ] `cd backend && npm start` works locally
- [ ] Environment variables configured
- [ ] Database connection string set
- [ ] CORS origins configured for production domain

### **Platform Configuration:**
- [ ] Build command: `npm run build`
- [ ] Start command: `cd backend && npm start`
- [ ] Node.js version: 18.x
- [ ] Environment variables added
- [ ] Domain configured (if needed)

### **After Deployment:**
- [ ] Health check: `https://your-app.com/health`
- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] Database connection works
- [ ] Real-time features work (Socket.IO)

---

## **🎉 Success!**

With the `postinstall` hook, your app will deploy seamlessly on any CD platform that supports Node.js. The platform handles dependency installation automatically, and your build process works exactly as expected.

**Simple, reliable, and works everywhere!** 🚀
