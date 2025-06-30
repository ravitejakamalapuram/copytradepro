#!/bin/bash

# Super fast dependency check - only checks if node_modules exist
# If they exist, assume dependencies are installed and skip

# Simple check - just verify node_modules directories exist
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "🔄 Installing missing dependencies..."

    # Install only what's missing
    [ ! -d "node_modules" ] && npm install --silent
    [ ! -d "backend/node_modules" ] && cd backend && npm install --silent && cd ..
    [ ! -d "frontend/node_modules" ] && cd frontend && npm install --silent && cd ..

    echo "✅ Dependencies installed"
else
    echo "✅ All dependencies are ready"
fi
