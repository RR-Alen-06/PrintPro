const logger = {
  info: (msg: string, meta?: any) => {
    const metaStr = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
    console.log(`${new Date().toISOString()} [INFO ] ${msg} ${metaStr}`.trim());
  },
  warn: (msg: string, meta?: any) => {
    const metaStr = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
    console.warn(`${new Date().toISOString()} [WARN ] ${msg} ${metaStr}`.trim());
  },
  error: (msg: string, meta?: any) => {
    const metaStr = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
    console.error(`${new Date().toISOString()} [ERROR] ${msg} ${metaStr}`.trim());
  },
  debug: (msg: string, meta?: any) => {
    const metaStr = meta && Object.keys(meta).length ? JSON.stringify(meta) : '';
    console.log(`${new Date().toISOString()} [DEBUG] ${msg} ${metaStr}`.trim());
  }
};

export default logger;
module.exports = logger;
