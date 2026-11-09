#!/usr/bin/env node

/**
 * Cross-platform Git Hook Installer
 * Automatically installs the pre-commit hook into `.git/hooks/pre-commit`
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GIT_HOOKS_DIR = path.join(ROOT_DIR, '.git', 'hooks');

if (!fs.existsSync(GIT_HOOKS_DIR)) {
  console.log('ℹ️  Not a git repository or `.git/hooks` directory missing. Skipping hook installation.');
  process.exit(0);
}

const PRE_COMMIT_HOOK = path.join(GIT_HOOKS_DIR, 'pre-commit');

const hookContent = `#!/bin/sh
# PrintPro ERP - Automated Pre-Commit Secret Scanner Hook

node scripts/scan-secrets.js --staged
RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "❌ Git commit aborted due to security policy violation."
  echo "Fix the detected secrets or add verified mocks to .secretignore."
  echo ""
  exit 1
fi

exit 0
`;

try {
  fs.writeFileSync(PRE_COMMIT_HOOK, hookContent, { mode: 0o755 });
  console.log('✅ Pre-commit secret scanning hook installed successfully at .git/hooks/pre-commit');
} catch (err) {
  console.error('⚠️  Failed to write pre-commit hook:', err.message);
}
