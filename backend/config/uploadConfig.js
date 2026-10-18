const path = require('path');
const os = require('os');
const fs = require('fs');

// In serverless environments (like AWS Lambda / Vercel), the filesystem outside /tmp is read-only.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

const UPLOAD_ROOT = isServerless
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(__dirname, '../uploads');

/**
 * Ensures a subfolder within UPLOAD_ROOT exists safely without throwing unhandled exceptions.
 * @param {string} subFolder
 * @returns {string} full directory path
 */
function ensureUploadSubdir(subFolder) {
  const target = subFolder ? path.join(UPLOAD_ROOT, subFolder) : UPLOAD_ROOT;
  try {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
  } catch (err) {
    // Ignore error if directory already exists or cannot be created immediately
    if (err.code !== 'EEXIST') {
      console.warn(`[uploads] Could not create upload directory ${target}:`, err.message);
    }
  }
  return target;
}

module.exports = {
  isServerless,
  UPLOAD_ROOT,
  ensureUploadSubdir
};
