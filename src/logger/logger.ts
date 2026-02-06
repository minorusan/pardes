import fs from 'fs';
import path from 'path';

/**
 * Log categories for the PARDES system
 * - API: HTTP requests, responses, endpoints
 * - SYSTEM: Server lifecycle, cache management, file operations
 * - CLIENT: Client-side events (future use)
 */
export enum LogCategory {
  API = 'API',
  SYSTEM = 'SYSTEM',
  CLIENT = 'CLIENT'
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private logFilePath: string;
  private sessionStart: Date;

  constructor() {
    this.sessionStart = new Date();
    const timestamp = this.sessionStart.toISOString().replace(/[:.]/g, '-');
    const logsDir = path.join(process.cwd(), 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFilePath = path.join(logsDir, `pardes-${timestamp}.log`);

    // Write session header
    this.writeToFile(`${'='.repeat(80)}\n`);
    this.writeToFile(`PARDES API - Session started at ${this.sessionStart.toISOString()}\n`);
    this.writeToFile(`${'='.repeat(80)}\n\n`);
  }

  private writeToFile(message: string): void {
    fs.appendFileSync(this.logFilePath, message, 'utf8');
  }

  private formatMessage(
    level: LogLevel,
    category: LogCategory,
    message: string,
    meta?: any
  ): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] [${level}] [${category}] ${message}${metaStr}\n`;
  }

  public log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    meta?: any
  ): void {
    const formattedMessage = this.formatMessage(level, category, message, meta);
    this.writeToFile(formattedMessage);
  }

  // Convenience methods
  public debug(category: LogCategory, message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, category, message, meta);
  }

  public info(category: LogCategory, message: string, meta?: any): void {
    this.log(LogLevel.INFO, category, message, meta);
  }

  public warn(category: LogCategory, message: string, meta?: any): void {
    this.log(LogLevel.WARN, category, message, meta);
  }

  public error(category: LogCategory, message: string, meta?: any): void {
    this.log(LogLevel.ERROR, category, message, meta);
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public getSessionStart(): Date {
    return this.sessionStart;
  }
}

// Singleton instance
export const logger = new Logger();
