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

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher

### ⚡ Super Simple Setup

```bash
git clone https://github.com/ravitejakamalapuram/copytradepro.git
cd copyTradeV2
npm run setup
```

That's it! This single command will:
- ✅ Install backend and frontend dependencies
- ✅ Build both backend and frontend
- ✅ Copy frontend to backend/public

### 🔥 Start Development

```bash
npm run dev
```

This will start both servers:
- 🌐 Frontend: http://localhost:5173
- 🌐 Backend: http://localhost:3001

### 🏗️ Build for Production

```bash
npm run build
```

### 🚀 Start Production

```bash
npm start
```

### 📋 All Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | 🎯 Complete setup (install + build + config) |
| `npm run dev` | 🔥 Start development servers with smart logging |
| `npm run build` | 🏗️ Build for production |
| `npm start` | 🚀 Start production server |
| `npm run install` | 📦 Install all dependencies |
| `npm run clean` | 🧹 Clean all build files |

### 🔧 Configuration

After running `npm run setup`, edit `backend/.env` with your broker credentials:

```env
# Shoonya Broker
SHOONYA_USER_ID=your_user_id
SHOONYA_PASSWORD=your_password
SHOONYA_VENDOR_CODE=your_vendor_code
SHOONYA_API_KEY=your_api_key
SHOONYA_IMEI=your_imei
SHOONYA_TOTP_SECRET=your_totp_secret

# Fyers Broker
FYERS_CLIENT_ID=your_client_id
FYERS_SECRET_KEY=your_secret_key
FYERS_REDIRECT_URI=your_redirect_uri
```

### 🆘 Troubleshooting

**Dependencies Issues:**
```bash
npm run clean
npm run install
```

**Build Issues:**
```bash
npm run clean
npm run build
```

**Manual Setup (if scripts fail):**
```bash
npm install
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
cd .. && mkdir -p backend/public && cp -r frontend/dist/* backend/public/
```

### 🎯 Development Workflow

1. **First time:** `npm run setup`
2. **Daily dev:** `npm run dev`
3. **Before deploy:** `npm run build`

**Development URLs:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

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
