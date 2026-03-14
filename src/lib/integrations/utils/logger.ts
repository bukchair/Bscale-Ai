type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const shouldLogDebug = process.env.NODE_ENV !== 'production';

const scrubSecrets = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrubSecrets);

  const output: Record<string, unknown> = {};
  for (const [key, innerValue] of Object.entries(value)) {
    if (/token|secret|password|authorization|cookie/i.test(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = scrubSecrets(innerValue);
    }
  }
  return output;
};

const writeLog = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  if (level === 'debug' && !shouldLogDebug) return;
  const line = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(meta ? { meta: scrubSecrets(meta) } : {}),
  };

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => writeLog('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog('error', message, meta),
};
