var bunyan = require('bunyan'),
  config = require('./config'),
  log = bunyan.createLogger({
    name: config.name,
    streams: [
      {
        level: 'info',
        stream: process.stdout
      },
      {
        level: 'info',
        path: '/var/log/app.log'
      }
    ]
  });

module.exports = log;
