import { config } from './config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

function log(level: keyof typeof LEVELS, message: string, ...extra: unknown[]): void {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;
  const formatted = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (level === 'warn') console.warn(formatted, ...extra);
  else if (level === 'error') console.error(formatted, ...extra);
  else console.log(formatted, ...extra);
}

export const logger = {
  debug: (m: string, ...e: unknown[]) => log('debug', m, ...e),
  info: (m: string, ...e: unknown[]) => log('info', m, ...e),
  warn: (m: string, ...e: unknown[]) => log('warn', m, ...e),
  error: (m: string, ...e: unknown[]) => log('error', m, ...e),
};
