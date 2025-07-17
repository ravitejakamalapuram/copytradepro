# Project Structure & Organization

## Root Level
```
copytrade-pro/
├── backend/           # Express.js API server
├── frontend/          # React application
├── dev-packages/      # Monorepo broker packages
├── package.json       # Root package with workspace scripts
└── README.md          # Main documentation
```

## Backend Structure (`backend/`)
```
backend/
├── src/
│   ├── controllers/   # Request handlers (authController, brokerController)
│   ├── middleware/    # Express middleware (auth, errorHandler)
│   ├── routes/        # API route definitions
│   ├── services/      # Business logic and external integrations
│   ├── models/        # Database models and schemas
│   ├── utils/         # Utility functions (logger, validateEnv)
│   ├── types/         # TypeScript type definitions
│   ├── migrations/    # Database migration scripts
│   ├── tests/         # Test files
│   └── index.ts       # Main server entry point
├── data/              # SQLite databases and CSV files
├── public/            # Static files (production frontend build)
├── dist/              # Compiled TypeScript output
└── package.json       # Backend dependencies
```

## Frontend Structure (`frontend/`)
```
frontend/
├── src/
│   ├── components/    # Reusable React components
│   │   └── ui/        # Base UI components (Button, Card, etc.)
│   ├── pages/         # Page-level components
│   ├── context/       # React Context providers
│   ├── hooks/         # Custom React hooks
│   ├── services/      # API service functions
│   ├── types/         # TypeScript interfaces
│   ├── styles/        # CSS files and design system
│   └── utils/         # Frontend utility functions
├── public/            # Static assets
├── dist/              # Vite build output
└── package.json       # Frontend dependencies
```

## Dev Packages Structure (`dev-packages/`)
```
dev-packages/
├── shared-types/      # Common TypeScript interfaces
├── unified-broker/    # Core broker abstraction layer
├── broker-fyers/      # Fyers broker implementation
└── broker-shoonya/    # Shoonya broker implementation
```

## Key Conventions

### File Naming
- **TypeScript files**: camelCase (e.g., `authController.ts`)
- **React components**: PascalCase (e.g., `LoginForm.tsx`)
- **CSS files**: kebab-case (e.g., `app-theme.css`)
- **Service files**: camelCase with Service suffix (e.g., `brokerService.ts`)

### Import Organization
1. External libraries first
2. Internal modules by path depth
3. Relative imports last
4. Type-only imports separated

### Directory Patterns
- **Controllers**: Handle HTTP requests, minimal business logic
- **Services**: Business logic, external API calls, data processing
- **Models**: Database schemas and data structures
- **Utils**: Pure functions, helpers, constants
- **Types**: TypeScript interfaces and type definitions

### API Route Structure
- `/api/auth/*` - Authentication endpoints
- `/api/broker/*` - Broker management and trading
- `/api/portfolio/*` - Portfolio and holdings data
- `/api/market-data/*` - Real-time market information
- `/api/advanced-orders/*` - Complex order management

### Component Organization
- **Pages**: Top-level route components
- **Components**: Reusable business components
- **UI Components**: Generic, reusable UI elements
- **Hooks**: Custom React hooks for shared logic
- **Context**: Global state management