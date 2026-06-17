const { createClient } = require('@supabase/supabase-js');

// Initialize the Supabase client on backend using environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL, Publishable Key or Anon Key is missing from backend environment configuration.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Express middleware to authenticate API requests using Supabase JWT.
 * Extracts the Bearer token from the Authorization header and verifies it via supabase.auth.getUser().
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed: No authorization token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Call Supabase API to retrieve user metadata (validates JWT)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed: Invalid or expired token'
      });
    }

    // Attach user information to request context
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed: Internal verification error'
    });
  }
};

module.exports = auth;
