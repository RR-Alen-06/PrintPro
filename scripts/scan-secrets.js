#!/usr/bin/env node

/**
 * PrintPro ERP / SimBilling - Zero-Dependency Secret Scanner
 * Scans staged git files or the entire repository for accidentally committed secrets,
 * private keys, database URLs, and unignored environment files.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const IS_STAGED = ARGS.includes('--staged') || ARGS.length === 0;
const IS_HISTORY = ARGS.includes('--history');
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Read allowlist (.secretignore)
const ignoreFile = path.join(ROOT_DIR, '.secretignore');
let allowlist = [];
if (fs.existsSync(ignoreFile)) {
  allowlist = fs.readFileSync(ignoreFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

function isAllowed(str) {
  return allowlist.some(allowed => str.includes(allowed));
}

// 2. Secret detection patterns
const PATTERNS = [
  {
    id: 'SUPABASE_JWT',
    name: 'Supabase Anon / Service Role Key (JWT format)',
    regex: /eyJ[A-Za-z0-9-_]{15,}\.eyJ[A-Za-z0-9-_]{15,}\.[A-Za-z0-9-_]{15,}/g
  },
  {
    id: 'POSTGRES_URL',
    name: 'Postgres Database Connection URL with Password',
    regex: /postgres(?:ql)?:\/\/[a-zA-Z0-9_\-\.]+:[^@\s"']+@[a-zA-Z0-9_\-\.]+/gi
  },
  {
    id: 'STRIPE_SECRET',
    name: 'Stripe Secret / Restricted Key',
    regex: /(?:rk|sk)_(?:live|test)_[0-9a-zA-Z]{24,99}/g
  },
  {
    id: 'STRIPE_PUB',
    name: 'Stripe Publishable Key',
    regex: /pk_(?:live|test)_[0-9a-zA-Z]{24,99}/g
  },
  {
    id: 'AWS_KEY',
    name: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g
  },
  {
    id: 'GITHUB_PAT',
    name: 'GitHub Personal Access Token',
    regex: /(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,255}/g
  },
  {
    id: 'GOOGLE_API',
    name: 'Google Cloud / Maps API Key',
    regex: /AIza[0-9A-Za-z-_]{35}/g
  },
  {
    id: 'PRIVATE_KEY',
    name: 'Private Key Block (RSA/OPENSSH/EC)',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g
  },
  {
    id: 'GENERIC_SECRET',
    name: 'Hardcoded Secret Assignment',
    regex: /(?:api_?key|apiKey|secret_?key|auth_?token|access_?token|client_?secret|db_?password|supabase_?service_?role)\s*[:=]\s*["']([^"'\s]{10,})["']/gi
  }
];

function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
  } catch (err) {
    return '';
  }
}

function scanStaged() {
  console.log('\n🔒 [Secret Scanner] Auditing git staged files for credentials & sensitive files...');
  
  // Check for staged .env files
  const stagedFiles = runGit('git diff --cached --name-only --diff-filter=ACM')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log('✅ No staged changes found to scan.\n');
    process.exit(0);
  }

  const findings = [];

  for (const file of stagedFiles) {
    // Check if filename is an environment file (exclude .example templates)
    if (/(^|\/)\.env(\.|$)/i.test(file) && !file.endsWith('.example')) {
      findings.push({
        file,
        line: 0,
        pattern: 'Accidental .env file committed in staging',
        matched: file,
        snippet: file
      });
      continue;
    }

    // Skip lockfiles and compiled binaries
    if (file.includes('package-lock.json') || file.includes('pnpm-lock.yaml') || file.endsWith('.png') || file.endsWith('.ico')) {
      continue;
    }

    // Read diff for this file
    const diff = runGit(`git diff --cached -U0 -- "${file}"`);
    const lines = diff.split('\n');
    let lineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/\+([0-9]+)/);
        if (match) lineNum = parseInt(match[1], 10);
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('+++')) {
        const content = line.substring(1).trim();
        
        for (const pat of PATTERNS) {
          const reg = new RegExp(pat.regex);
          let match;
          while ((match = reg.exec(content)) !== null) {
            const matchedText = match[0];
            if (!isAllowed(matchedText) && !isAllowed(content)) {
              findings.push({
                file,
                line: lineNum,
                pattern: pat.name,
                matched: matchedText,
                snippet: content
              });
            }
          }
        }
        lineNum++;
      }
    }
  }

  return findings;
}

function scanFullHistory() {
  console.log('\n🔍 [Secret Scanner] Auditing full Git history across all commits and branches...');
  const gitLog = runGit('git log --all -p --full-history -U0');
  const lines = gitLog.split('\n');

  let currentCommit = 'unknown';
  let currentFile = 'unknown';
  const findings = [];

  for (const line of lines) {
    if (line.startsWith('commit ')) {
      currentCommit = line.substring(7).trim();
      continue;
    }
    if (line.startsWith('diff --git a/')) {
      const match = line.match(/diff --git a\/.*? b\/(.*)/);
      if (match) currentFile = match[1].trim();
      continue;
    }

    if (currentFile.includes('package-lock.json')) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.substring(1).trim();
      for (const pat of PATTERNS) {
        const reg = new RegExp(pat.regex);
        let match;
        while ((match = reg.exec(content)) !== null) {
          const matchedText = match[0];
          if (!isAllowed(matchedText) && !isAllowed(content)) {
            findings.push({
              commit: currentCommit.substring(0, 10),
              file: currentFile,
              pattern: pat.name,
              matched: matchedText,
              snippet: content
            });
          }
        }
      }
    }
  }

  return findings;
}

const findings = IS_HISTORY ? scanFullHistory() : scanStaged();

if (findings.length > 0) {
  console.error('\n🚨 [SECURITY ALERT] Potential secret(s) or sensitive file(s) detected!\n');
  for (const f of findings) {
    if (IS_HISTORY) {
      console.error(`  [Commit ${f.commit}] ${f.file}`);
    } else {
      console.error(`  [File] ${f.file}:${f.line || '1'}`);
    }
    console.error(`  [Type] ${f.pattern}`);
    console.error(`  [Code] ${f.snippet.substring(0, 120)}`);
    console.error('  ' + '-'.repeat(70));
  }

  console.error('\n💡 Remediation:');
  console.error('  1. Remove the sensitive credential or environment file from git staging.');
  console.error('  2. Store credentials in `.env.local` (which is gitignored).');
  console.error('  3. If this is a false-positive mock placeholder, add the pattern to `.secretignore`.\n');
  process.exit(1);
} else {
  console.log('✨ [Secret Scanner] Audit passed! No secrets or sensitive files found.\n');
  process.exit(0);
}
