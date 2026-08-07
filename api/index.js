const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  try {
    const serverPath = path.join(__dirname, '../backend/dist/server.js');
    if (!fs.existsSync(serverPath)) {
      return res.status(500).json({ error: 'Backend server build file missing at ' + serverPath });
    }
    const app = require('../backend/dist/server');
    return app(req, res);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to invoke backend serverless app: ' + err.message, stack: err.stack });
  }
};
