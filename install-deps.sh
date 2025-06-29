#!/bin/bash

# CopyTrade Pro Dependencies Installation Script
# This script only installs dependencies without full setup

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_status "🚀 Installing CopyTrade Pro dependencies..."
echo

# Check Node.js and npm
if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

print_success "Node.js $(node --version) and npm $(npm --version) detected"
echo

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the root directory of the CopyTrade Pro project"
    exit 1
fi

# Install root dependencies
print_status "📦 Installing root dependencies..."
npm install --silent
print_success "Root dependencies installed"
echo

# Install backend dependencies
print_status "📦 Installing backend dependencies..."
cd backend
if [ ! -f "package.json" ]; then
    print_error "Backend package.json not found!"
    exit 1
fi
npm install --silent
print_success "Backend dependencies installed"
cd ..
echo

# Install frontend dependencies
print_status "📦 Installing frontend dependencies..."
cd frontend
if [ ! -f "package.json" ]; then
    print_error "Frontend package.json not found!"
    exit 1
fi
npm install --silent
print_success "Frontend dependencies installed"
cd ..
echo

# Create basic directories if they don't exist
print_status "📁 Ensuring necessary directories exist..."
mkdir -p backend/data
mkdir -p backend/public
mkdir -p backend/logs
print_success "Directories verified"
echo

print_success "🎉 All dependencies installed successfully!"
echo
print_status "You can now run:"
echo "  npm run dev    - Start development servers"
echo "  npm run build  - Build for production"
echo "  npm run setup  - Full setup with environment files"
echo
