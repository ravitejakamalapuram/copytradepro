#!/bin/bash

# CopyTrade Pro Deployment Script
# Handles controlled deployment with health checks and rollback capability

set -e  # Exit on any error

# Configuration
DEPLOY_ENV=${DEPLOY_ENV:-production}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current timestamp
get_timestamp() {
    date +"%Y%m%d_%H%M%S"
}

# Get current git commit hash
get_commit_hash() {
    git rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# Check if required tools are available
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup of current deployment
create_backup() {
    local timestamp=$(get_timestamp)
    local backup_dir="backups/backup_${timestamp}"
    
    log_info "Creating backup: $backup_dir"
    
    mkdir -p "$backup_dir"
    
    # Backup current application files
    if [ -d "backend/dist" ]; then
        cp -r backend/dist "$backup_dir/backend_dist"
    fi
    
    if [ -d "frontend/dist" ]; then
        cp -r frontend/dist "$backup_dir/frontend_dist"
    fi
    
    # Backup database (MongoDB backup would be handled separately)
    echo "📊 Database backup: MongoDB backups should be handled via mongodump"
    
    # Save deployment metadata
    cat > "$backup_dir/metadata.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "commit_hash": "$(get_commit_hash)",
    "environment": "$DEPLOY_ENV",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)"
}
EOF
    
    log_success "Backup created: $backup_dir"
    echo "$backup_dir" > .last_backup
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (older than $BACKUP_RETENTION_DAYS days)..."
    
    if [ -d "backups" ]; then
        find backups -type d -name "backup_*" -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
        log_success "Old backups cleaned up"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Install root dependencies
    npm ci --only=production
    
    # Install backend dependencies
    cd backend
    npm ci --only=production
    cd ..
    
    # Install frontend dependencies
    cd frontend
    npm ci --only=production
    cd ..
    
    # Install dev-packages dependencies
    for package in dev-packages/*/; do
        if [ -f "$package/package.json" ]; then
            log_info "Installing dependencies for $(basename "$package")"
            cd "$package"
            npm ci --only=production
            cd - > /dev/null
        fi
    done
    
    log_success "Dependencies installed"
}

# Build application
build_application() {
    log_info "Building application..."
    
    # Build dev packages first
    for package in dev-packages/*/; do
        if [ -f "$package/package.json" ]; then
            log_info "Building $(basename "$package")"
            cd "$package"
            npm run build
            cd - > /dev/null
        fi
    done
    
    # Build backend
    log_info "Building backend..."
    cd backend
    npm run build
    cd ..
    
    # Build frontend
    log_info "Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    # Copy frontend build to backend public directory
    if [ -d "frontend/dist" ] && [ -d "backend" ]; then
        log_info "Copying frontend build to backend..."
        rm -rf backend/public
        cp -r frontend/dist backend/public
    fi
    
    log_success "Application built successfully"
}

# Run health check
run_health_check() {
    log_info "Running health check..."
    
    if [ -f "backend/scripts/health-check.js" ]; then
        cd backend
        timeout $HEALTH_CHECK_TIMEOUT node scripts/health-check.js
        local health_status=$?
        cd ..
        
        if [ $health_status -eq 0 ]; then
            log_success "Health check passed"
            return 0
        else
            log_error "Health check failed"
            return 1
        fi
    else
        log_warning "Health check script not found, skipping..."
        return 0
    fi
}

# Start application
start_application() {
    log_info "Starting application..."
    
    # Stop existing processes
    pkill -f "node.*index" || true
    pkill -f "ts-node.*index" || true
    pkill -f "nodemon" || true
    
    # Wait for processes to stop
    sleep 3
    
    # Start application in background
    cd backend
    nohup npm start > ../logs/app.log 2>&1 &
    local app_pid=$!
    cd ..
    
    # Save PID for later use
    echo $app_pid > .app_pid
    
    # Wait for application to start
    log_info "Waiting for application to start..."
    sleep 10
    
    # Check if process is still running
    if kill -0 $app_pid 2>/dev/null; then
        log_success "Application started (PID: $app_pid)"
        return 0
    else
        log_error "Application failed to start"
        return 1
    fi
}

# Stop application
stop_application() {
    log_info "Stopping application..."
    
    if [ -f ".app_pid" ]; then
        local app_pid=$(cat .app_pid)
        if kill -0 $app_pid 2>/dev/null; then
            kill $app_pid
            sleep 5
            
            # Force kill if still running
            if kill -0 $app_pid 2>/dev/null; then
                kill -9 $app_pid
            fi
        fi
        rm -f .app_pid
    fi
    
    # Kill any remaining processes
    pkill -f "node.*index" || true
    pkill -f "ts-node.*index" || true
    pkill -f "nodemon" || true
    
    log_success "Application stopped"
}

# Rollback to previous version
rollback() {
    log_warning "Initiating rollback..."
    
    if [ ! -f ".last_backup" ]; then
        log_error "No backup found for rollback"
        exit 1
    fi
    
    local backup_dir=$(cat .last_backup)
    
    if [ ! -d "$backup_dir" ]; then
        log_error "Backup directory not found: $backup_dir"
        exit 1
    fi
    
    log_info "Rolling back to: $backup_dir"
    
    # Stop current application
    stop_application
    
    # Restore files
    if [ -d "$backup_dir/backend_dist" ]; then
        rm -rf backend/dist
        cp -r "$backup_dir/backend_dist" backend/dist
    fi
    
    if [ -d "$backup_dir/frontend_dist" ]; then
        rm -rf frontend/dist
        cp -r "$backup_dir/frontend_dist" frontend/dist
        rm -rf backend/public
        cp -r "$backup_dir/frontend_dist" backend/public
    fi
    
    # Database restore (MongoDB restore would be handled separately)
    echo "📊 Database restore: MongoDB restores should be handled via mongorestore"
    
    # Start application
    if start_application; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback failed - manual intervention required"
        exit 1
    fi
}

# Main deployment function
deploy() {
    local start_time=$(date +%s)
    
    log_info "Starting deployment to $DEPLOY_ENV environment"
    log_info "Commit: $(get_commit_hash)"
    log_info "Timestamp: $(date -Iseconds)"
    
    # Create logs directory
    mkdir -p logs
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    create_backup
    
    # Clean old backups
    cleanup_old_backups
    
    # Install dependencies
    install_dependencies
    
    # Build application
    build_application
    
    # Stop current application
    stop_application
    
    # Start new application
    if ! start_application; then
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            log_error "Application start failed, rolling back..."
            rollback
            exit 1
        else
            log_error "Application start failed"
            exit 1
        fi
    fi
    
    # Run health check
    if ! run_health_check; then
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            log_error "Health check failed, rolling back..."
            rollback
            exit 1
        else
            log_error "Health check failed"
            exit 1
        fi
    fi
    
    # Run deployment validation
    log_info "Running deployment validation..."
    if [ -f "backend/scripts/validate-deployment.js" ]; then
        cd backend
        if ! timeout $HEALTH_CHECK_TIMEOUT node scripts/validate-deployment.js; then
            cd ..
            if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                log_error "Deployment validation failed, rolling back..."
                rollback
                exit 1
            else
                log_error "Deployment validation failed"
                exit 1
            fi
        fi
        cd ..
        log_success "Deployment validation passed"
    else
        log_warning "Deployment validation script not found, skipping..."
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Deployment completed successfully in ${duration}s"
    
    # Log deployment success
    cat >> logs/deployment.log << EOF
$(date -Iseconds) | SUCCESS | $DEPLOY_ENV | $(get_commit_hash) | ${duration}s
EOF
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "rollback")
        rollback
        ;;
    "health-check")
        run_health_check
        ;;
    "stop")
        stop_application
        ;;
    "start")
        start_application
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health-check|start|stop}"
        echo ""
        echo "Commands:"
        echo "  deploy      - Full deployment with health checks"
        echo "  rollback    - Rollback to previous version"
        echo "  health-check - Run health check only"
        echo "  start       - Start application"
        echo "  stop        - Stop application"
        echo ""
        echo "Environment Variables:"
        echo "  DEPLOY_ENV              - Deployment environment (default: production)"
        echo "  HEALTH_CHECK_TIMEOUT    - Health check timeout in seconds (default: 30)"
        echo "  ROLLBACK_ON_FAILURE     - Auto rollback on failure (default: true)"
        echo "  BACKUP_RETENTION_DAYS   - Days to keep backups (default: 7)"
        exit 1
        ;;
esac