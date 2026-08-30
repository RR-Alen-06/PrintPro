const sanitize = (input: any): string => {
  if (input === null || input === undefined) return '';
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return str.replace(/[\r\n]+/g, ' ');
};

const logger = {
  info: (msg: string, meta?: any) => {
    const cleanMsg = sanitize(msg);
    const metaStr = meta && Object.keys(meta).length ? sanitize(meta) : '';
    console.log(`${new Date().toISOString()} [INFO ] ${cleanMsg} ${metaStr}`.trim());
  },
  warn: (msg: string, meta?: any) => {
    const cleanMsg = sanitize(msg);
    const metaStr = meta && Object.keys(meta).length ? sanitize(meta) : '';
    console.warn(`${new Date().toISOString()} [WARN ] ${cleanMsg} ${metaStr}`.trim());
  },
  error: (msg: string, meta?: any) => {
    const cleanMsg = sanitize(msg);
    const metaStr = meta && Object.keys(meta).length ? sanitize(meta) : '';
    console.error(`${new Date().toISOString()} [ERROR] ${cleanMsg} ${metaStr}`.trim());
  },
  debug: (msg: string, meta?: any) => {
    const cleanMsg = sanitize(msg);
    const metaStr = meta && Object.keys(meta).length ? sanitize(meta) : '';
    console.log(`${new Date().toISOString()} [DEBUG] ${cleanMsg} ${metaStr}`.trim());
  }
};

export default logger;
module.exports = logger;
