// Enable and configure the Elastic APM agent.
//
// Secrets are set in the environment via Ansible, just read them here.
const apm = require('elastic-apm-node').start({
  serviceName: process.env.ELASTIC_APM_SERVICE,
  secretToken: process.env.ELASTIC_APM_TOKEN,
  serverUrl:   process.env.ELASTIC_APM_SERVER_URL,
  environment: process.env.STAGE
})

module.exports = apm;
