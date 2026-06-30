const app = require('../backend/server');

module.exports = (req, res) => {
  // Normalize req.url for Vercel Serverless environment:
  // Vercel rewrites the path to /api/index.js but keeps the original path in headers
  const originalUrl = req.headers['x-matched-path'] || req.headers['x-forwarded-url'] || req.url;
  
  if (originalUrl && originalUrl !== '/api/index.js') {
    req.url = originalUrl;
  }
  
  return app(req, res);
};

