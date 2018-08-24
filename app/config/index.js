var nodeEnv = process.env.NODE_ENV || 'dockerdev';
var config = {
  dockerdev: require('./dockerdev'),
};

module.exports = config[nodeEnv];
