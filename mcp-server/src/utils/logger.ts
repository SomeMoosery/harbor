/**
 * Simple logging utility for MCP server
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'info') {
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private output(level: LogLevel, message: string, data?: unknown): void {
    const line = this.formatMessage(level, message, data);
    process.stderr.write(`${line}\n`);
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      this.output('debug', message, data);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      this.output('info', message, data);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      this.output('warn', message, data);
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      this.output('error', message, data);
    }
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);
