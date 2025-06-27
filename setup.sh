#!/bin/bash

# CopyTrade Pro Setup Script
# This script automates the complete setup process for the CopyTrade Pro application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check Node.js version
check_node_version() {
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 20.15.1 or higher."
        print_status "Visit: https://nodejs.org/en/download/"
        exit 1
    fi

    local node_version=$(node -v | sed 's/v//')
    local required_version="20.15.1"
    
    if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
        print_error "Node.js version $node_version is installed, but version $required_version or higher is required."
        exit 1
    fi
    
    print_success "Node.js version $node_version is compatible"
}

# Function to check npm
check_npm() {
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    local npm_version=$(npm -v)
    print_success "npm version $npm_version is available"
}

# Function to create environment file
create_env_file() {
    local env_path="$1"
    local env_content="$2"
    
    if [ -f "$env_path" ]; then
        print_warning "Environment file $env_path already exists. Skipping..."
        return
    fi
    
    echo "$env_content" > "$env_path"
    print_success "Created environment file: $env_path"
}

# Function to install dependencies
install_dependencies() {
    local dir="$1"
    local name="$2"
    
    print_status "Installing $name dependencies..."
    cd "$dir"
    
    if [ -f "package-lock.json" ]; then
        rm package-lock.json
        print_status "Removed existing package-lock.json"
    fi
    
    npm install
    print_success "$name dependencies installed successfully"
    cd ..
}

# Main setup function
main() {
    print_status "Starting CopyTrade Pro setup..."
    echo
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    check_node_version
    check_npm
    echo
    
    # Check if we're in the right directory
    if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
        print_error "Please run this script from the root directory of the CopyTrade Pro project"
        exit 1
    fi
    
    print_success "Project structure validated"
    echo
    
    # Create backend environment file
    print_status "Setting up backend environment..."
    backend_env="# Backend Environment Configuration
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=http://localhost:5173

# Database Configuration
DB_PATH=./data/trading.db

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log"
    
    mkdir -p backend/data backend/logs
    create_env_file "backend/.env" "$backend_env"
    echo
    
    # Create frontend environment file
    print_status "Setting up frontend environment..."
    frontend_env="# Frontend Environment Configuration
VITE_API_URL=http://localhost:3001"
    
    create_env_file "frontend/.env" "$frontend_env"
    echo
    
    # Install backend dependencies
    install_dependencies "backend" "backend"
    echo
    
    # Install frontend dependencies
    install_dependencies "frontend" "frontend"
    echo
    
    # Build backend
    print_status "Building backend..."
    cd backend
    npm run build
    print_success "Backend built successfully"
    cd ..
    echo
    
    # Create startup scripts
    print_status "Creating startup scripts..."
    
    # Create start-dev.sh script
    cat > start-dev.sh << 'EOF'
#!/bin/bash

# Development startup script for CopyTrade Pro

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_status "Starting CopyTrade Pro in development mode..."

# Function to cleanup background processes
cleanup() {
    print_status "Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start backend
print_status "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
print_status "Starting frontend development server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

print_success "Development servers started!"
print_status "Backend: http://localhost:3001"
print_status "Frontend: http://localhost:5173"
print_status "Press Ctrl+C to stop both servers"

# Wait for background processes
wait
EOF
    
    chmod +x start-dev.sh
    print_success "Created start-dev.sh script"
    
    # Create start-prod.sh script
    cat > start-prod.sh << 'EOF'
#!/bin/bash

# Production startup script for CopyTrade Pro

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_status "Starting CopyTrade Pro in production mode..."

# Build frontend
print_status "Building frontend..."
cd frontend
npm run build
cd ..

# Start backend
print_status "Starting backend server..."
cd backend
npm start
EOF
    
    chmod +x start-prod.sh
    print_success "Created start-prod.sh script"
    echo
    
    # Final success message
    print_success "🎉 CopyTrade Pro setup completed successfully!"
    echo
    print_status "Next steps:"
    echo "  1. Review and update environment variables in backend/.env and frontend/.env"
    echo "  2. Start development servers: ./start-dev.sh"
    echo "  3. Open your browser to http://localhost:5173"
    echo
    print_status "For production deployment:"
    echo "  1. Update environment variables for production"
    echo "  2. Run: ./start-prod.sh"
    echo
    print_warning "Important: Change the JWT_SECRET in backend/.env before deploying to production!"
}

# Run main function
main "$@"
