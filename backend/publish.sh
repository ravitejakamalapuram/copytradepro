#!/bin/bash

# Unified Broker Library Publishing Script
# This script helps you publish the unified broker library to NPM

set -e  # Exit on any error

echo "🚀 Publishing @copytrade/unified-broker to NPM"
echo "=============================================="

# Check if user is logged in to NPM
echo "📋 Checking NPM authentication..."
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ You are not logged in to NPM. Please run 'npm login' first."
    exit 1
fi

NPM_USER=$(npm whoami)
echo "✅ Logged in as: $NPM_USER"

# Check if @copytrade organization exists
echo "🏢 Checking @copytrade organization..."
if ! npm org ls copytrade > /dev/null 2>&1; then
    echo "⚠️  @copytrade organization not found."
    echo "📝 Please create the organization first:"
    echo "   1. Visit: https://www.npmjs.com/org/create"
    echo "   2. Create organization: 'copytrade'"
    echo "   3. Or run: npm org create copytrade"
    echo ""
    read -p "🤔 Have you created the @copytrade organization? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Please create the organization first and try again."
        exit 1
    fi
fi

echo "✅ @copytrade organization verified"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Copy package.json for publishing
echo "📦 Preparing package configuration..."
cp package-publish.json package.json.backup
cp package-publish.json package.json

# Copy README for publishing
cp README-PUBLISH.md README.md.backup
cp README-PUBLISH.md README.md

# Build the package
echo "🔨 Building the package..."
npm run build

# Check if dist directory was created
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build successful!"

# Show what will be published
echo "📋 Package contents:"
npm pack --dry-run

# Ask for confirmation
echo ""
read -p "🤔 Do you want to publish this package to NPM? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Publishing to NPM..."
    
    # Publish the package
    npm publish --access public
    
    if [ $? -eq 0 ]; then
        echo "🎉 Successfully published @copytrade/unified-broker!"
        echo ""
        echo "📦 Installation command:"
        echo "   npm install @copytrade/unified-broker"
        echo ""
        echo "📚 Documentation:"
        echo "   https://www.npmjs.com/package/@copytrade/unified-broker"
        echo ""
        echo "🔗 GitHub Repository:"
        echo "   https://github.com/ravitejakamalapuram/copytradepro"
    else
        echo "❌ Publishing failed!"
        exit 1
    fi
else
    echo "❌ Publishing cancelled."
fi

# Restore original files
echo "🔄 Restoring original files..."
if [ -f "package.json.backup" ]; then
    mv package.json.backup package.json
fi

if [ -f "README.md.backup" ]; then
    mv README.md.backup README.md
fi

echo "✅ Done!"
