/**
 * Request body allowlist middleware.
 * Restricts req.body to an explicit whitelist of permitted keys.
 * Silently drops any unpermitted keys, and specifically ensures no user can set:
 * role, permissions, price, credits, status, or IDs unless explicitly permitted for that domain.
 */

const FORBIDDEN_UNIVERSAL_KEYS = [
  'role',
  'roles',
  'permission',
  'permissions',
  'admin',
  'isAdmin',
  'user_id',
  'userId',
  'created_at',
  'updated_at',
  'deleted_at'
];

function allowlist(allowedFields = []) {
  const allowedSet = new Set(allowedFields);

  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    if (Array.isArray(req.body)) {
      return next();
    }

    const sanitized = {};
    for (const key of Object.keys(req.body)) {
      if (allowedSet.has(key) && !FORBIDDEN_UNIVERSAL_KEYS.includes(key)) {
        sanitized[key] = req.body[key];
      }
    }

    req.body = sanitized;
    next();
  };
}

module.exports = {
  allowlist
};
