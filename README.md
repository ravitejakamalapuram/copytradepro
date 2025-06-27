# CopyTrade Pro

A professional multi-broker trading platform for copy trading and portfolio management.

## Features

- **Multi-Broker Support**: Connect multiple broker accounts (Zerodha, Angel, Upstox, Fyers, Dhan)
- **Real-time Trading**: Execute trades across multiple accounts simultaneously
- **Secure Authentication**: JWT-based authentication with secure credential storage
- **Trade History**: Complete trade tracking and portfolio monitoring
- **Responsive Design**: Works on desktop and mobile devices
- **Production Ready**: Comprehensive error handling and validation

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development
- React Router for navigation
- Axios for API communication
- CSS3 with custom design system

### Backend
- Node.js with Express
- TypeScript for type safety
- JWT authentication
- bcryptjs for password hashing
- Comprehensive security middleware (helmet, cors, rate limiting)
- Morgan for logging

## Quick Start

### Prerequisites
- Node.js 20.15.1 or higher
- npm or yarn

### Installation

#### Option 1: Automated Setup (Recommended)

Run the setup script for your operating system:

**Linux/macOS:**
```bash
git clone <repository-url>
cd copytradepro
chmod +x setup.sh
./setup.sh
```

**Windows (Command Prompt):**
```cmd
git clone <repository-url>
cd copytradepro
setup.bat
```

**Windows (PowerShell):**
```powershell
git clone <repository-url>
cd copytradepro
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup.ps1
```

The setup script will:
- ✅ Check Node.js and npm versions
- ✅ Create environment files with default configurations
- ✅ Install all dependencies for both backend and frontend
- ✅ Build the backend
- ✅ Create startup scripts for development and production

#### Option 2: Manual Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd copytradepro
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**

   Backend (.env):
   ```bash
   cd ../backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Frontend (.env):
   ```bash
   cd ../frontend
   # .env is already configured for development
   ```

### Development

#### Quick Start (After Setup)

**Using startup scripts:**
- Linux/macOS: `./start-dev.sh`
- Windows: `start-dev.bat` or `.\start-dev.ps1`

**Manual start:**

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   Server runs on http://localhost:3001

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on http://localhost:5173

3. **Open your browser**
   Navigate to http://localhost:5173

## Project Structure

```
copyTradeV2/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── utils/           # Utility functions
│   │   └── index.ts         # Main server file
│   ├── .env                 # Environment variables
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── context/         # React context
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
│   ├── .env                 # Environment variables
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Health Check
- `GET /health` - Server health status

## Security Features

- JWT token-based authentication
- Password hashing with bcryptjs
- Rate limiting to prevent abuse
- CORS protection
- Helmet for security headers
- Input validation and sanitization
- Secure credential storage

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Account Setup**: Add your broker accounts with API credentials
3. **Trade Setup**: Configure and execute trades across multiple accounts
4. **Monitor**: Track trade history and portfolio performance

## Environment Variables

### Backend
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3001)
- `JWT_SECRET`: Secret key for JWT tokens
- `FRONTEND_URL`: Frontend URL for CORS

### Frontend
- `VITE_API_URL`: Backend API URL

## Production Deployment

#### Quick Production Start

**Using startup scripts:**
- Linux/macOS: `./start-prod.sh`
- Windows: `start-prod.bat` or `.\start-prod.ps1`

#### Manual Production Deployment

1. **Build the applications**
   ```bash
   # Backend
   cd backend
   npm run build

   # Frontend
   cd ../frontend
   npm run build
   ```

2. **Start production server**
   ```bash
   cd backend
   npm start
   ```

## Contributing

1. Follow the existing code style and patterns
2. Add proper error handling for all trading operations
3. Include comprehensive input validation
4. Write meaningful commit messages
5. Test thoroughly before submitting

## Security Notice

This is a trading application that handles sensitive financial data. Always:
- Use strong JWT secrets in production
- Implement proper API rate limiting
- Validate all inputs thoroughly
- Use HTTPS in production
- Store broker credentials securely
- Follow security best practices

## License

This project is for educational and development purposes. Use at your own risk for live trading.

## Support

For issues and questions, please check the code comments and error handling implementations.
