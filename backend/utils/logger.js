/**
 * PrintPro Logger
 * Lightweight structured logger — no external dependencies.
 * Outputs colorized, timestamped, leveled lines to stdout/stderr.
 *
 * Levels: DEBUG < INFO < WARN < ERROR
 * Controlled by LOG_LEVEL env var (default: "info")
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// ANSI color codes
const COLOR = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  white:  '\x1b[37m',
  gray:   '\x1b[90m',
};

const LEVEL_STYLE = {
  debug: { color: COLOR.gray,   label: 'DEBUG' },
  info:  { color: COLOR.cyan,   label: 'INFO ' },
  warn:  { color: COLOR.yellow, label: 'WARN ' },
  error: { color: COLOR.red,    label: 'ERROR' },
};

// Disable colors when not a TTY (e.g. piped to a file)
const useColor = process.stdout.isTTY !== false;
const c = (code, str) => (useColor ? `${code}${str}${COLOR.reset}` : str);

const activeLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function format(level, message, meta) {
  const { color, label } = LEVEL_STYLE[level];
  const ts   = c(COLOR.dim, timestamp());
  const lvl  = c(color + COLOR.bold, `[${label}]`);
  const msg  = c(level === 'error' ? COLOR.red : COLOR.white, message);
  const metaStr = meta ? ' ' + c(COLOR.gray, JSON.stringify(meta)) : '';
  return `${ts} ${lvl} ${msg}${metaStr}`;
}

function write(level, message, meta) {
  if (LEVELS[level] < activeLevel) return;
  const line = format(level, message, meta);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  debug: (msg, meta) => write('debug', msg, meta),
  info:  (msg, meta) => write('info',  msg, meta),
  warn:  (msg, meta) => write('warn',  msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};

module.exports = logger;
