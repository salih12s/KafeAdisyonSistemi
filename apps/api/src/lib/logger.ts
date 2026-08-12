export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function formatLine(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const base = `${timestamp} [${level.toUpperCase()}] ${message}`;

  if (meta === undefined || Object.keys(meta).length === 0) {
    return `${base}\n`;
  }

  return `${base} ${safeStringify(meta)}\n`;
}

function safeStringify(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return '[serileştirilemeyen ek bilgi]';
  }
}

/**
 * Bağımlılık eklemeden çalışan basit seviye tabanlı kayıt tutucu.
 * console kullanılmaz; çıktı doğrudan stdout/stderr akışına yazılır.
 */
export function createLogger(level: LogLevel = 'info'): Logger {
  const threshold = LEVEL_WEIGHT[level];

  const write = (target: LogLevel, message: string, meta?: Record<string, unknown>): void => {
    if (LEVEL_WEIGHT[target] < threshold) {
      return;
    }

    const line = formatLine(target, message, meta);

    if (target === 'error' || target === 'warn') {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  };

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}

/** Testlerde çıktı kirliliği olmaması için hiçbir şey yazmayan kayıt tutucu. */
export function createSilentLogger(): Logger {
  const noop = (): void => undefined;
  return { debug: noop, info: noop, warn: noop, error: noop };
}
