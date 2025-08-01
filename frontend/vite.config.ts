import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['axios'],
          
          // Feature-based chunks
          'trading-pages': [
            './src/pages/TradeSetup.tsx',
            './src/pages/Orders.tsx',
            './src/pages/Positions.tsx'
          ],
          'portfolio-pages': [
            './src/pages/Portfolio.tsx',
            './src/pages/Holdings.tsx',
            './src/pages/PortfolioAnalytics.tsx'
          ],
          'setup-pages': [
            './src/pages/AccountSetup.tsx',
            './src/pages/Settings.tsx'
          ],
          
          // Services and utilities
          'services': [
            './src/services/brokerService.ts',
            './src/services/portfolioService.ts',
            './src/services/marketDataService.ts'
          ]
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: true,
    // Optimize for modern browsers
    target: 'es2020'
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
    exclude: ['@vite/client', '@vite/env']
  }
})
