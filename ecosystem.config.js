module.exports = {
  apps: [{
    name: 'copytrade-pro',
    script: './backend/dist/index.js',
    cwd: './',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0'
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto-restart configuration
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'backend/data'],
    max_restarts: 10,
    min_uptime: '10s',
    
    // Memory management
    max_memory_restart: '500M',
    
    // Process management
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};