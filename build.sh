#!/bin/bash

# Render.com Build Script for CopyTrade Pro
# This script builds both frontend and backend for deployment

set -e  # Exit on any error

echo "🚀 Starting CopyTrade Pro build process..."

# Print Node.js and npm versions
echo "📋 Environment Info:"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Current directory: $(pwd)"

# Install backend dependencies (including dev dependencies for build)
echo "📦 Installing backend dependencies..."
cd backend
npm install 
echo "✅ Backend dependencies installed"

# Build backend first (requires dev dependencies)
echo "🏗️ Building backend..."
npm run build
echo "✅ Backend build completed"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install 
echo "✅ Frontend dependencies installed"

# Build frontend
echo "🏗️ Building frontend..."
npm run build
echo "✅ Frontend build completed"

# Create backend public directory and copy frontend build
echo "📁 Setting up static file serving..."
cd ../backend
mkdir -p public
cp -r ../frontend/dist/* public/
echo "✅ Frontend files copied to backend/public"

# List contents to verify
echo "📋 Frontend build contents:"
ls -la public/

# Clean up backend dev dependencies for production
echo "🧹 Cleaning up dev dependencies..."
npm prune --omit=dev 
echo "✅ Dev dependencies removed"

# Verify backend build
echo "📋 Backend build contents:"
ls -la dist/

# Create data directory for SQLite database
echo "📁 Setting up database directory..."
mkdir -p data
echo "✅ Database directory created"

# Set proper permissions
echo "🔐 Setting permissions..."
chmod -R 755 public/
chmod -R 755 data/
echo "✅ Permissions set"

echo "🎉 Build process completed successfully!"
echo "📊 Build Summary:"
echo "  - Frontend: Built and copied to backend/public"
echo "  - Backend: Compiled TypeScript to dist/"
echo "  - Database: Directory created at backend/data"
echo "  - Static files: Ready to serve from Node.js"
