#!/bin/bash

# Production Start Script for CopyTrade Pro
# This script starts the application in production mode

set -e  # Exit on any error

echo "🚀 Starting CopyTrade Pro in production mode..."

# Print environment info
echo "📋 Environment Info:"
echo "Node.js version: $(node --version)"
echo "NODE_ENV: ${NODE_ENV:-development}"
echo "PORT: ${PORT:-3001}"
echo "Current directory: $(pwd)"

# Change to backend directory
cd backend

# Verify build exists
if [ ! -d "dist" ]; then
    echo "❌ Backend build not found! Please run build first."
    exit 1
fi

if [ ! -d "public" ]; then
    echo "❌ Frontend build not found! Please run build first."
    exit 1
fi

# Verify database directory exists
if [ ! -d "data" ]; then
    echo "📁 Creating database directory..."
    mkdir -p data
fi

# Start the application
echo "🎯 Starting Node.js server..."
exec node dist/index.js
