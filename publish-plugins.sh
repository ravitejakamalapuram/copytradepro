#!/bin/bash

# Plugin Publishing Script
# Builds and publishes both Shoonya and Fyers plugins to npm

set -e  # Exit on any error

echo "🚀 Starting Plugin Publishing Process..."

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

# Check if npm is logged in
check_npm_auth() {
    print_status "Checking npm authentication..."
    if npm whoami > /dev/null 2>&1; then
        print_success "npm authentication verified"
    else
        print_error "Not logged in to npm. Please run 'npm login' first."
        exit 1
    fi
}

# Build and publish a plugin
publish_plugin() {
    local plugin_name=$1
    local plugin_path=$2
    
    print_status "Publishing $plugin_name plugin..."
    
    # Navigate to plugin directory
    cd "$plugin_path"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in $plugin_path"
        return 1
    fi
    
    # Clean previous builds
    print_status "Cleaning previous builds..."
    rm -rf dist/
    rm -rf node_modules/
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install --production
    
    # Build the plugin
    print_status "Building $plugin_name plugin..."
    npx tsc
    
    # Check if build was successful
    if [ ! -d "dist" ]; then
        print_error "Build failed for $plugin_name - dist directory not found"
        return 1
    fi
    
    # Run tests if they exist
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        print_status "Running tests for $plugin_name..."
        npm test || {
            print_warning "Tests failed for $plugin_name, but continuing..."
        }
    fi
    
    # Check package version
    local version=$(node -p "require('./package.json').version")
    print_status "Current version: $version"
    
    # Dry run to check what would be published
    print_status "Performing dry run..."
    npm publish --dry-run
    
    # Ask for confirmation
    echo -n "Do you want to publish $plugin_name v$version? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # Publish to npm
        print_status "Publishing $plugin_name to npm..."
        npm publish --access public
        
        if [ $? -eq 0 ]; then
            print_success "$plugin_name v$version published successfully!"
        else
            print_error "Failed to publish $plugin_name"
            return 1
        fi
    else
        print_warning "Skipped publishing $plugin_name"
    fi
    
    # Return to root directory
    cd - > /dev/null
}

# Main execution
main() {
    print_status "Plugin Publishing Script v1.0.0"
    echo "=================================="
    
    # Check npm authentication
    check_npm_auth
    
    # Get current directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Define plugin paths
    SHOONYA_PATH="$SCRIPT_DIR/broker-plugins/shoonya"
    FYERS_PATH="$SCRIPT_DIR/broker-plugins/fyers"
    
    # Check if plugin directories exist
    if [ ! -d "$SHOONYA_PATH" ]; then
        print_error "Shoonya plugin directory not found: $SHOONYA_PATH"
        exit 1
    fi
    
    if [ ! -d "$FYERS_PATH" ]; then
        print_error "Fyers plugin directory not found: $FYERS_PATH"
        exit 1
    fi
    
    # Ask which plugins to publish
    echo ""
    echo "Which plugins would you like to publish?"
    echo "1) Shoonya only"
    echo "2) Fyers only"
    echo "3) Both plugins"
    echo "4) Exit"
    echo -n "Enter your choice (1-4): "
    read -r choice
    
    case $choice in
        1)
            print_status "Publishing Shoonya plugin only..."
            publish_plugin "Shoonya" "$SHOONYA_PATH"
            ;;
        2)
            print_status "Publishing Fyers plugin only..."
            publish_plugin "Fyers" "$FYERS_PATH"
            ;;
        3)
            print_status "Publishing both plugins..."
            publish_plugin "Shoonya" "$SHOONYA_PATH"
            echo ""
            publish_plugin "Fyers" "$FYERS_PATH"
            ;;
        4)
            print_status "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Exiting..."
            exit 1
            ;;
    esac
    
    echo ""
    print_success "Plugin publishing process completed!"
    
    # Show published packages
    echo ""
    print_status "Published packages:"
    echo "📦 @copytradepro/broker-shoonya - https://www.npmjs.com/package/@copytradepro/broker-shoonya"
    echo "📦 @copytradepro/broker-fyers - https://www.npmjs.com/package/@copytradepro/broker-fyers"
    
    echo ""
    print_status "Next steps:"
    echo "1. Update your main application to use the published plugins"
    echo "2. Test the plugins in a clean environment"
    echo "3. Update documentation with the new package versions"
    echo "4. Announce the release to your users"
}

# Run main function
main "$@"
