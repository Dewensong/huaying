module.exports = {
  apps: [{
    name: 'zhibofang',
    script: './src/app.ts',
    interpreter: 'node',
    interpreter_args: '-r ts-node/register',
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    }
  }]
}
