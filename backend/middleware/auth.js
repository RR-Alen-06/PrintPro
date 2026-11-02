const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://latjtnhjvmbmnrhznpfx.supabase.co';
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Server Key is missing from backend environment configuration.');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

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
    const client = getSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed: Invalid or expired token'
      });
    }

    // Attach user information to request context
    req.user = user;
    next();
  } catch (_err) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed: Internal verification error'
    });
  }
};

module.exports = auth;
