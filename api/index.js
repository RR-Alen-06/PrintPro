let app;
let initError = null;

try {
  app = require('../backend/server');
} catch (err) {
  initError = err;
  console.error('[CRITICAL] Failed to load backend server in Vercel function:', err);
}

module.exports = (req, res) => {
  if (initError) {
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(500).json({
      success: false,
      error: 'Backend initialization failed',
      message: isProd ? 'Internal server configuration error' : initError.message,
      timestamp: new Date().toISOString()
    });
  }
  return app(req, res);
};
