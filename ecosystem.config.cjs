// pm2 ecosystem config for ClaudeClaw
// Usage: pm2 start ecosystem.config.cjs
// Restart main only: pm2 restart ea-claude

module.exports = {
  apps: [
    {
      name: 'ea-claude',
      script: 'dist/index.js',
      cwd: __dirname,
      // Exponential backoff: starts at 100ms, doubles each restart, caps at 15s
      exp_backoff_restart_delay: 100,
      // Don't count as "stable" unless it ran for at least 30s
      min_uptime: '30s',
      // Stop restarting after 10 consecutive failures (within min_uptime window)
      max_restarts: 10,
      // Kill old process gracefully — wait 5s for shutdown before SIGKILL
      kill_timeout: 5000,
      // Wait for port to be released before restarting
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
