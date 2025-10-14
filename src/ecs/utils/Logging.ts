/**
 * Logging.ts - Système de logging configurable pour la simulation
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  category?: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private categories: Set<string> = new Set();

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure le niveau de log minimum
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Active/désactive une catégorie de logs
   */
  setCategoryEnabled(category: string, enabled: boolean): void {
    if (enabled) {
      this.categories.add(category);
    } else {
      this.categories.delete(category);
    }
  }

  /**
   * Log de debug
   */
  debug(message: string, category?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, category, data);
  }

  /**
   * Log d'information
   */
  info(message: string, category?: string, data?: any): void {
    this.log(LogLevel.INFO, message, category, data);
  }

  /**
   * Log d'avertissement
   */
  warn(message: string, category?: string, data?: any): void {
    this.log(LogLevel.WARN, message, category, data);
  }

  /**
   * Log d'erreur
   */
  error(message: string, category?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, category, data);
  }

  /**
   * Log générique
   */
  private log(level: LogLevel, message: string, category?: string, data?: any): void {
    // Vérifier le niveau
    if (level < this.logLevel) return;

    // Vérifier la catégorie si spécifiée
    if (category && !this.categories.has(category)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      category,
      data
    };

    // Ajouter aux logs internes
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Supprimer le plus ancien
    }

    // Afficher dans la console selon le niveau
    const prefix = category ? `[${category}]` : '';
    const formattedMessage = `${prefix} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`🐛 ${formattedMessage}`, data || '');
        break;
      case LogLevel.INFO:
        console.info(`ℹ️ ${formattedMessage}`, data || '');
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${formattedMessage}`, data || '');
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${formattedMessage}`, data || '');
        break;
    }
  }

  /**
   * Obtient tous les logs
   */
  getLogs(level?: LogLevel, category?: string): LogEntry[] {
    return this.logs.filter(entry => {
      if (level !== undefined && entry.level < level) return false;
      if (category && entry.category !== category) return false;
      return true;
    });
  }

  /**
   * Obtient les derniers logs
   */
  getRecentLogs(count: number = 10): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Efface tous les logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Exporte les logs au format JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Importe des logs depuis JSON
   */
  importLogs(json: string): void {
    try {
      const imported = JSON.parse(json) as LogEntry[];
      this.logs.push(...imported);
      // Garder seulement les maxLogs plus récents
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }
    } catch (error) {
      this.error('Erreur lors de l\'import des logs', 'Logger', error);
    }
  }

  /**
   * Statistiques des logs
   */
  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byCategory: Record<string, number>;
  } {
    const byLevel = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.NONE]: 0
    };

    const byCategory: Record<string, number> = {};

    for (const entry of this.logs) {
      byLevel[entry.level]++;

      if (entry.category) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      }
    }

    return {
      total: this.logs.length,
      byLevel,
      byCategory
    };
  }
}

// Instance globale pour utilisation facile
export const log = Logger.getInstance();