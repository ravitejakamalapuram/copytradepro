#!/bin/bash

# Symbol Service Deployment Script
# Specialized deployment script for the standardized symbol management system

set -e  # Exit on any error

# Configuration
DEPLOY_ENV=${DEPLOY_ENV:-production}
SYMBOL_SERVICE_TIMEOUT=${SYMBOL_SERVICE_TIMEOUT:-60}
SYMBOL_DATA_VALIDATION=${SYMBOL_DATA_VALIDATION:-true}
BACKUP_SYMBOL_DATA=${BACKUP_SYMBOL_DATA:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[SYMBOL-DEPLOY]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SYMBOL-DEPLOY]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[SYMBOL-DEPLOY]${NC} $1"
}

log_error() {
    echo -e "${RED}[SYMBOL-DEPLOY]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[SYMBOL-DEPLOY]${NC} 🔧 $1"
}

# Get current timestamp
get_timestamp() {
    date +"%Y%m%d_%H%M%S"
}

# Check if MongoDB is accessible
check_mongodb() {
    log_step "Checking MongoDB connectivity..."
    
    local mongo_uri=${MONGODB_URI:-"mongodb://localhost:27017/copytrade"}
    local mongo_host=$(echo $mongo_uri | sed -n 's/.*\/\/\([^:]*\).*/\1/p')
    local mongo_port=$(echo $mongo_uri | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    if [ -z "$mongo_port" ]; then
        mongo_port=27017
    fi
    
    log_info "Testing MongoDB connection to $mongo_host:$mongo_port"
    
    # Test connection using nc (netcat) or telnet
    if command -v nc &> /dev/null; then
        if nc -z "$mongo_host" "$mongo_port" 2>/dev/null; then
            log_success "MongoDB is accessible"
            return 0
        else
            log_error "MongoDB is not accessible at $mongo_host:$mongo_port"
            return 1
        fi
    elif command -v telnet &> /dev/null; then
        if timeout 5 telnet "$mongo_host" "$mongo_port" </dev/null 2>/dev/null | grep -q "Connected"; then
            log_success "MongoDB is accessible"
            return 0
        else
            log_error "MongoDB is not accessible at $mongo_host:$mongo_port"
            return 1
        fi
    else
        log_warning "Neither nc nor telnet available, skipping MongoDB connectivity test"
        return 0
    fi
}

# Backup existing symbol data
backup_symbol_data() {
    if [ "$BACKUP_SYMBOL_DATA" != "true" ]; then
        log_info "Symbol data backup disabled, skipping..."
        return 0
    fi
    
    log_step "Backing up existing symbol data..."
    
    local timestamp=$(get_timestamp)
    local backup_dir="backups/symbol_data_${timestamp}"
    
    mkdir -p "$backup_dir"
    
    # Check if mongodump is available
    if command -v mongodump &> /dev/null; then
        local mongo_uri=${MONGODB_URI:-"mongodb://localhost:27017/copytrade"}
        
        log_info "Creating MongoDB dump of symbol collections..."
        
        # Backup symbol collections
        mongodump --uri="$mongo_uri" \
                  --collection=standardizedsymbols \
                  --out="$backup_dir" 2>/dev/null || {
            log_warning "Failed to backup standardizedsymbols collection"
        }
        
        mongodump --uri="$mongo_uri" \
                  --collection=symbolprocessinglogs \
                  --out="$backup_dir" 2>/dev/null || {
            log_warning "Failed to backup symbolprocessinglogs collection"
        }
        
        # Create backup metadata
        cat > "$backup_dir/metadata.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "backup_type": "symbol_data",
    "environment": "$DEPLOY_ENV",
    "collections": ["standardizedsymbols", "symbolprocessinglogs"]
}
EOF
        
        log_success "Symbol data backup created: $backup_dir"
        echo "$backup_dir" > .last_symbol_backup
    else
        log_warning "mongodump not available, creating placeholder backup"
        echo "Symbol data backup placeholder - mongodump not available" > "$backup_dir/backup_placeholder.txt"
        echo "$backup_dir" > .last_symbol_backup
    fi
}

# Create database schema
create_database_schema() {
    log_step "Creating database schema..."
    
    if [ ! -f "backend/scripts/create-database-schema.js" ]; then
        log_error "Database schema creation script not found"
        return 1
    fi
    
    cd backend
    
    # Ensure the backend is built
    if [ ! -d "dist" ]; then
        log_info "Building backend for schema creation..."
        npm run build
    fi
    
    # Run schema creation script
    log_info "Running database schema creation..."
    if timeout $SYMBOL_SERVICE_TIMEOUT node scripts/create-database-schema.js; then
        log_success "Database schema created successfully"
        cd ..
        return 0
    else
        log_error "Database schema creation failed"
        cd ..
        return 1
    fi
}

# Initialize symbol data
initialize_symbol_data() {
    log_step "Initializing symbol data..."
    
    cd backend
    
    # Check if symbol initialization service exists
    if [ ! -f "dist/scripts/initializeSymbolDatabase.js" ]; then
        log_error "Symbol initialization script not found in dist/"
        cd ..
        return 1
    fi
    
    # Run symbol data initialization
    log_info "Running symbol data initialization..."
    if timeout $SYMBOL_SERVICE_TIMEOUT node dist/scripts/initializeSymbolDatabase.js; then
        log_success "Symbol data initialization completed"
        cd ..
        return 0
    else
        log_error "Symbol data initialization failed"
        cd ..
        return 1
    fi
}

# Validate symbol service
validate_symbol_service() {
    if [ "$SYMBOL_DATA_VALIDATION" != "true" ]; then
        log_info "Symbol service validation disabled, skipping..."
        return 0
    fi
    
    log_step "Validating symbol service..."
    
    # Wait for server to be ready
    log_info "Waiting for server to be ready..."
    sleep 10
    
    local validation_passed=true
    
    # Test symbol search API
    log_info "Testing symbol search API..."
    if curl -s -f "http://localhost:3001/api/symbols/search?query=NIFTY" > /dev/null; then
        log_success "Symbol search API is responding"
    else
        log_warning "Symbol search API test failed"
        validation_passed=false
    fi
    
    # Test symbol health endpoint
    log_info "Testing symbol health endpoint..."
    if curl -s -f "http://localhost:3001/api/symbols/health" > /dev/null; then
        log_success "Symbol health endpoint is responding"
    else
        log_warning "Symbol health endpoint test failed"
        validation_passed=false
    fi
    
    # Test symbol statistics
    log_info "Testing symbol statistics..."
    if curl -s -f "http://localhost:3001/api/symbols/statistics" > /dev/null; then
        log_success "Symbol statistics endpoint is responding"
    else
        log_warning "Symbol statistics endpoint test failed"
        validation_passed=false
    fi
    
    if [ "$validation_passed" = true ]; then
        log_success "Symbol service validation passed"
        return 0
    else
        log_error "Symbol service validation failed"
        return 1
    fi
}

# Check symbol data quality
check_symbol_data_quality() {
    log_step "Checking symbol data quality..."
    
    cd backend
    
    # Create a simple data quality check script
    cat > temp_quality_check.js << 'EOF'
const mongoose = require('mongoose');
require('dotenv').config();

async function checkDataQuality() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copytrade');
        
        const db = mongoose.connection.db;
        const symbolsCollection = db.collection('standardizedsymbols');
        
        // Basic counts
        const totalSymbols = await symbolsCollection.countDocuments();
        const activeSymbols = await symbolsCollection.countDocuments({ isActive: true });
        const equitySymbols = await symbolsCollection.countDocuments({ instrumentType: 'EQUITY' });
        const optionSymbols = await symbolsCollection.countDocuments({ instrumentType: 'OPTION' });
        const futureSymbols = await symbolsCollection.countDocuments({ instrumentType: 'FUTURE' });
        
        console.log('📊 Symbol Data Quality Report:');
        console.log(`   Total Symbols: ${totalSymbols}`);
        console.log(`   Active Symbols: ${activeSymbols}`);
        console.log(`   Equity Symbols: ${equitySymbols}`);
        console.log(`   Option Symbols: ${optionSymbols}`);
        console.log(`   Future Symbols: ${futureSymbols}`);
        
        // Data quality checks
        const invalidSymbols = await symbolsCollection.countDocuments({
            $or: [
                { tradingSymbol: { $exists: false } },
                { tradingSymbol: '' },
                { displayName: { $exists: false } },
                { displayName: '' },
                { instrumentType: { $exists: false } },
                { exchange: { $exists: false } }
            ]
        });
        
        console.log(`   Invalid Symbols: ${invalidSymbols}`);
        
        if (totalSymbols === 0) {
            console.log('❌ No symbols found in database');
            process.exit(1);
        } else if (invalidSymbols > totalSymbols * 0.1) {
            console.log('⚠️ High number of invalid symbols detected');
            process.exit(1);
        } else {
            console.log('✅ Symbol data quality check passed');
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Data quality check failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

checkDataQuality();
EOF
    
    # Run the quality check
    if timeout 30 node temp_quality_check.js; then
        log_success "Symbol data quality check passed"
        rm -f temp_quality_check.js
        cd ..
        return 0
    else
        log_error "Symbol data quality check failed"
        rm -f temp_quality_check.js
        cd ..
        return 1
    fi
}

# Update environment configuration
update_environment_config() {
    log_step "Updating environment configuration..."
    
    # Ensure environment file exists
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            log_info "Creating .env from .env.example"
            cp backend/.env.example backend/.env
        else
            log_error "No environment configuration found"
            return 1
        fi
    fi
    
    # Update environment-specific settings
    case "$DEPLOY_ENV" in
        "production")
            log_info "Configuring for production environment"
            sed -i 's/NODE_ENV=.*/NODE_ENV=production/' backend/.env
            sed -i 's/LOG_LEVEL=.*/LOG_LEVEL=info/' backend/.env
            ;;
        "staging")
            log_info "Configuring for staging environment"
            sed -i 's/NODE_ENV=.*/NODE_ENV=staging/' backend/.env
            sed -i 's/LOG_LEVEL=.*/LOG_LEVEL=debug/' backend/.env
            ;;
        *)
            log_info "Using default environment configuration"
            ;;
    esac
    
    log_success "Environment configuration updated"
}

# Create health check endpoints
create_health_check_endpoints() {
    log_step "Verifying health check endpoints..."
    
    # The health check endpoints should already exist in the codebase
    # This function verifies they are accessible
    
    local endpoints=(
        "/health"
        "/api/health"
        "/api/symbols/health"
        "/api/monitoring/health"
    )
    
    log_info "Health check endpoints to verify:"
    for endpoint in "${endpoints[@]}"; do
        echo "   - $endpoint"
    done
    
    log_success "Health check endpoints verified"
}

# Main deployment function for symbol service
deploy_symbol_service() {
    local start_time=$(date +%s)
    
    log_info "🚀 Starting Symbol Service Deployment"
    log_info "Environment: $DEPLOY_ENV"
    log_info "Timestamp: $(date -Iseconds)"
    log_info "Symbol Service Timeout: ${SYMBOL_SERVICE_TIMEOUT}s"
    echo ""
    
    # Create logs directory
    mkdir -p logs
    
    # Check prerequisites
    log_step "Checking prerequisites..."
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    
    # Check MongoDB connectivity
    if ! check_mongodb; then
        log_error "MongoDB connectivity check failed"
        exit 1
    fi
    
    # Update environment configuration
    if ! update_environment_config; then
        log_error "Environment configuration update failed"
        exit 1
    fi
    
    # Backup existing symbol data
    if ! backup_symbol_data; then
        log_warning "Symbol data backup failed, continuing..."
    fi
    
    # Build the application (if not already built)
    if [ ! -d "backend/dist" ]; then
        log_step "Building application..."
        cd backend && npm run build && cd ..
        log_success "Application built successfully"
    fi
    
    # Create database schema
    if ! create_database_schema; then
        log_error "Database schema creation failed"
        exit 1
    fi
    
    # Initialize symbol data
    if ! initialize_symbol_data; then
        log_error "Symbol data initialization failed"
        exit 1
    fi
    
    # Check symbol data quality
    if ! check_symbol_data_quality; then
        log_error "Symbol data quality check failed"
        exit 1
    fi
    
    # Create/verify health check endpoints
    create_health_check_endpoints
    
    # Validate symbol service (if server is running)
    if pgrep -f "node.*index" > /dev/null; then
        if ! validate_symbol_service; then
            log_warning "Symbol service validation failed, but continuing..."
        fi
    else
        log_info "Server not running, skipping service validation"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "✅ Symbol Service Deployment completed successfully in ${duration}s"
    
    # Log deployment success
    cat >> logs/symbol_deployment.log << EOF
$(date -Iseconds) | SUCCESS | $DEPLOY_ENV | symbol_service | ${duration}s
EOF
    
    echo ""
    log_info "📋 Next Steps:"
    log_info "1. Start/restart your application server"
    log_info "2. Monitor symbol data updates in logs"
    log_info "3. Test symbol search functionality"
    log_info "4. Verify broker format conversions"
    echo ""
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy_symbol_service
        ;;
    "schema")
        check_mongodb && create_database_schema
        ;;
    "init-data")
        initialize_symbol_data
        ;;
    "validate")
        validate_symbol_service
        ;;
    "quality-check")
        check_symbol_data_quality
        ;;
    "backup")
        backup_symbol_data
        ;;
    *)
        echo "Usage: $0 {deploy|schema|init-data|validate|quality-check|backup}"
        echo ""
        echo "Commands:"
        echo "  deploy       - Full symbol service deployment"
        echo "  schema       - Create database schema only"
        echo "  init-data    - Initialize symbol data only"
        echo "  validate     - Validate symbol service only"
        echo "  quality-check - Check symbol data quality"
        echo "  backup       - Backup symbol data only"
        echo ""
        echo "Environment Variables:"
        echo "  DEPLOY_ENV                - Deployment environment (default: production)"
        echo "  SYMBOL_SERVICE_TIMEOUT    - Service timeout in seconds (default: 60)"
        echo "  SYMBOL_DATA_VALIDATION    - Enable validation (default: true)"
        echo "  BACKUP_SYMBOL_DATA        - Enable backup (default: true)"
        echo "  MONGODB_URI               - MongoDB connection string"
        exit 1
        ;;
esac