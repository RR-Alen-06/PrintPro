#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

const stagedFiles = getStagedFiles();
if (stagedFiles.length === 0) {
  process.exit(0);
}

// 1. Check for committed live environment files
const blockedEnvFiles = stagedFiles.filter(f => {
  const base = f.split('/').pop().toLowerCase();
  return base.startsWith('.env') && !base.endsWith('.example');
});

if (blockedEnvFiles.length > 0) {
  console.error('\n❌ [PRE-COMMIT SECURITY ERROR]: Attempting to commit live environment files:');
  blockedEnvFiles.forEach(f => console.error(`   - ${f}`));
  console.error('\nEnvironment files containing credentials must NEVER be committed to Git.');
  console.error('Use `.env.example` templates and keep actual `.env` files git-ignored.\n');
  process.exit(1);
}

// 2. Scan staged content diff for known secret patterns
let diffContent = '';
try {
  diffContent = execSync('git diff --cached -U0', { encoding: 'utf8' });
} catch (e) {
  diffContent = '';
}

const patterns = [
  { name: 'Supabase Secret Key', regex: /sb_secret_[A-Za-z0-9_-]+/g },
  { name: 'Private Key Block', regex: /BEGIN\s+(?:RSA|OPENSSH|EC|PGP)?\s*PRIVATE\s+KEY/g },
  { name: 'Hardcoded Legacy Password (cek@123)', regex: /cek@123/g },
  { name: 'Hardcoded Fallback JWT Secret', regex: /defaultSecretChangeThisInProduction/g }
];

let hasError = false;
let currentFile = '';

const lines = diffContent.split('\n');
for (const line of lines) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.substring(6).trim();
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const content = line.substring(1);

  // Skip comment placeholders and examples
  if (content.includes('your-') || content.includes('placeholder') || content.includes('dummy')) continue;
  if (currentFile.endsWith('.example') || currentFile.endsWith('pre-commit-check.js')) continue;

  for (const { name, regex } of patterns) {
    regex.lastIndex = 0;
    if (regex.test(content)) {
      console.error(`\n❌ [PRE-COMMIT SECURITY ERROR]: Detected possible secret pattern: "${name}"`);
      console.error(`   File: ${currentFile}`);
      console.error(`   Line: ${content.trim().slice(0, 80)}`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('\nCommit aborted. Please remove sensitive credentials before committing.\n');
  process.exit(1);
}

console.log('✅ [pre-commit]: Secret check passed.');
process.exit(0);
