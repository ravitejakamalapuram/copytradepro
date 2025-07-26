#!/bin/bash

# CopyTrade Pro EC2 Deployment Script

set -e

echo "🚀 Starting CopyTrade Pro deployment on EC2..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on EC2
if [ ! -f /sys/hypervisor/uuid ] || [ "$(head -c 3 /sys/hypervisor/uuid)" != "ec2" ]; then
    print_warning "This script is designed for EC2 instances"
fi

# Get EC2 public IP
EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
print_status "Detected EC2 Public IP: $EC2_PUBLIC_IP"

# Stop any existing processes
print_status "Stopping existing processes..."
pkill -f "node.*index" || true
pkill -f "npm.*start" || true
sleep 2

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Build the application
print_status "Building application..."
npm run build

# Update environment file with EC2 IP
print_status "Configuring environment for EC2..."
if [ -f "backend/.env.production" ]; then
    sed -i "s/YOUR_EC2_PUBLIC_IP/$EC2_PUBLIC_IP/g" backend/.env.production
    cp backend/.env.production backend/.env
else
    print_warning "No .env.production file found, using default .env"
fi

# Create data directory
mkdir -p backend/data

# Set proper permissions
chmod +x backend/dist/index.js 2>/dev/null || true

# Start the application
print_status "Starting CopyTrade Pro..."
cd backend && NODE_ENV=production npm start &

# Wait for server to start
sleep 5

# Check if server is running
if curl -s http://localhost:3001/health > /dev/null; then
    print_status "✅ Server started successfully!"
    print_status "🌐 Application URL: http://$EC2_PUBLIC_IP:3001"
    print_status "🏥 Health Check: http://$EC2_PUBLIC_IP:3001/health"
    print_status ""
    print_status "📋 Next Steps:"
    print_status "1. Configure EC2 Security Group to allow inbound traffic on port 3001"
    print_status "2. Update your broker API credentials in backend/.env"
    print_status "3. Access your application at: http://$EC2_PUBLIC_IP:3001"
else
    print_error "❌ Server failed to start. Check logs with: tail -f backend/*.log"
    exit 1
fi

print_status "🎉 Deployment completed!"