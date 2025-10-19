/**
 * Logging.ts - Système de logging configurable
 * 
 * Remplace les console.log par un système centralisé avec niveaux.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  
  private constructor() {}
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  debug(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, context, ...args);
    }
  }
  
  info(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, context, ...args);
    }
  }
  
  warn(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, context, ...args);
    }
  }
  
  error(message: string, context?: string, ...args: unknown[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, context, ...args);
    }
  }
  
  private log(level: string, message: string, context?: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    const fullMessage = `${timestamp} [${level}] ${contextStr} ${message}`;
    
    // eslint-disable-next-line no-console
    console.log(fullMessage, ...args);
  }
}
