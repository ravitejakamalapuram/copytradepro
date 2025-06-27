# CopyTrade Pro Setup Script for PowerShell
# This script automates the complete setup process for the CopyTrade Pro application

param(
    [switch]$SkipBuild = $false
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to write colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check Node.js version
function Test-NodeVersion {
    if (-not (Test-Command "node")) {
        Write-Error "Node.js is not installed. Please install Node.js 20.15.1 or higher."
        Write-Status "Visit: https://nodejs.org/en/download/"
        exit 1
    }

    $nodeVersion = (node -v).TrimStart('v')
    $requiredVersion = [version]"20.15.1"
    $currentVersion = [version]$nodeVersion
    
    if ($currentVersion -lt $requiredVersion) {
        Write-Error "Node.js version $nodeVersion is installed, but version $requiredVersion or higher is required."
        exit 1
    }
    
    Write-Success "Node.js version $nodeVersion is compatible"
}

# Function to check npm
function Test-Npm {
    if (-not (Test-Command "npm")) {
        Write-Error "npm is not installed. Please install npm."
        exit 1
    }
    
    $npmVersion = npm -v
    Write-Success "npm version $npmVersion is available"
}

# Function to create environment file
function New-EnvFile {
    param(
        [string]$Path,
        [string]$Content
    )
    
    if (Test-Path $Path) {
        Write-Warning "Environment file $Path already exists. Skipping..."
        return
    }
    
    $Content | Out-File -FilePath $Path -Encoding UTF8
    Write-Success "Created environment file: $Path"
}

# Function to install dependencies
function Install-Dependencies {
    param(
        [string]$Directory,
        [string]$Name
    )
    
    Write-Status "Installing $Name dependencies..."
    Push-Location $Directory
    
    try {
        if (Test-Path "package-lock.json") {
            Remove-Item "package-lock.json" -Force
            Write-Status "Removed existing package-lock.json"
        }
        
        npm install
        Write-Success "$Name dependencies installed successfully"
    }
    finally {
        Pop-Location
    }
}

# Main setup function
function Start-Setup {
    Write-Status "Starting CopyTrade Pro setup..."
    Write-Host ""
    
    # Check prerequisites
    Write-Status "Checking prerequisites..."
    Test-NodeVersion
    Test-Npm
    Write-Host ""
    
    # Check if we're in the right directory
    if (-not (Test-Path "README.md") -or -not (Test-Path "backend") -or -not (Test-Path "frontend")) {
        Write-Error "Please run this script from the root directory of the CopyTrade Pro project"
        exit 1
    }
    
    Write-Success "Project structure validated"
    Write-Host ""
    
    # Create backend environment file
    Write-Status "Setting up backend environment..."
    $backendEnv = @"
# Backend Environment Configuration
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
LOG_FILE=./logs/app.log
"@
    
    # Create directories
    New-Item -ItemType Directory -Path "backend/data" -Force | Out-Null
    New-Item -ItemType Directory -Path "backend/logs" -Force | Out-Null
    New-EnvFile -Path "backend/.env" -Content $backendEnv
    Write-Host ""
    
    # Create frontend environment file
    Write-Status "Setting up frontend environment..."
    $frontendEnv = @"
# Frontend Environment Configuration
VITE_API_URL=http://localhost:3001
"@
    
    New-EnvFile -Path "frontend/.env" -Content $frontendEnv
    Write-Host ""
    
    # Install backend dependencies
    Install-Dependencies -Directory "backend" -Name "backend"
    Write-Host ""
    
    # Install frontend dependencies
    Install-Dependencies -Directory "frontend" -Name "frontend"
    Write-Host ""
    
    # Build backend
    if (-not $SkipBuild) {
        Write-Status "Building backend..."
        Push-Location "backend"
        try {
            npm run build
            Write-Success "Backend built successfully"
        }
        finally {
            Pop-Location
        }
        Write-Host ""
    }
    
    # Create startup scripts
    Write-Status "Creating startup scripts..."
    
    # Create start-dev.ps1 script
    $startDevScript = @'
# Development startup script for CopyTrade Pro

Write-Host "[INFO] Starting CopyTrade Pro in development mode..." -ForegroundColor Blue

# Start backend
Write-Host "[INFO] Starting backend server..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "[INFO] Starting frontend development server..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host "[SUCCESS] Development servers started!" -ForegroundColor Green
Write-Host "[INFO] Backend: http://localhost:3001" -ForegroundColor Blue
Write-Host "[INFO] Frontend: http://localhost:5173" -ForegroundColor Blue
Write-Host "[INFO] Close the PowerShell windows to stop the servers" -ForegroundColor Blue
'@
    
    $startDevScript | Out-File -FilePath "start-dev.ps1" -Encoding UTF8
    Write-Success "Created start-dev.ps1 script"
    
    # Create start-prod.ps1 script
    $startProdScript = @'
# Production startup script for CopyTrade Pro

Write-Host "[INFO] Starting CopyTrade Pro in production mode..." -ForegroundColor Blue

# Build frontend
Write-Host "[INFO] Building frontend..." -ForegroundColor Blue
Push-Location "frontend"
npm run build
Pop-Location

# Start backend
Write-Host "[INFO] Starting backend server..." -ForegroundColor Blue
Push-Location "backend"
npm start
'@
    
    $startProdScript | Out-File -FilePath "start-prod.ps1" -Encoding UTF8
    Write-Success "Created start-prod.ps1 script"
    Write-Host ""
    
    # Final success message
    Write-Success "🎉 CopyTrade Pro setup completed successfully!"
    Write-Host ""
    Write-Status "Next steps:"
    Write-Host "  1. Review and update environment variables in backend/.env and frontend/.env"
    Write-Host "  2. Start development servers: .\start-dev.ps1"
    Write-Host "  3. Open your browser to http://localhost:5173"
    Write-Host ""
    Write-Status "For production deployment:"
    Write-Host "  1. Update environment variables for production"
    Write-Host "  2. Run: .\start-prod.ps1"
    Write-Host ""
    Write-Warning "Important: Change the JWT_SECRET in backend/.env before deploying to production!"
}

# Run main function
try {
    Start-Setup
}
catch {
    Write-Error "Setup failed: $($_.Exception.Message)"
    exit 1
}
