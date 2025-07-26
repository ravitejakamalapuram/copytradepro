module.exports = {
  apps: [{
    name: 'copytrade-pro',
    script: './dist/index.js',
    cwd: './backend',
    instances: 1,
    exec_mode: 'fork',
    
    // Environment configurations
    env: {
      NODE_ENV: 'development',
      PORT: 3001,
      HOST: '0.0.0.0'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0'
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3002,
      HOST: '0.0.0.0'
    },
    
    // Logging configuration
    log_file: '../logs/combined.log',
    out_file: '../logs/out.log',
    error_file: '../logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto-restart configuration
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'backend/data', '*.log'],
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    
    // Memory and performance management
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512',
    
    // Process management
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Health monitoring
    health_check_http: 'http://localhost:3001/health',
    health_check_grace_period: 3000,
    
    // Advanced options
    source_map_support: true,
    instance_var: 'INSTANCE_ID',
    
    // Cron restart (optional - restart daily at 3 AM)
    // cron_restart: '0 3 * * *',
    
    // Auto-restart on file changes (development only)
    // watch: process.env.NODE_ENV !== 'production',
    
    // Graceful shutdown
    shutdown_with_message: true
  }]
};