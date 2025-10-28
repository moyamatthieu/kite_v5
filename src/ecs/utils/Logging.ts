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
  data?: unknown;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private categories: Set<string> = new Set();
  
  // Système de throttling pour éviter le flood
  private throttleCache: Map<string, { count: number; lastTime: number; lastMessage: string }> = new Map();
  private throttleInterval: number = 2000; // 2 secondes pour physics
  private maxSimilarLogs: number = 3; // Max 3 logs identiques par intervalle (réduit)
  private summaryInterval: number = 5000; // Rapport de résumé toutes les 5 secondes
  private lastSummaryTime: number = 0;

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
  debug(message: string, category?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, category, data);
  }

  /**
   * Log d'information
   */
  info(message: string, category?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, category, data);
  }

  /**
   * Log d'avertissement
   */
  warn(message: string, category?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, category, data);
  }

  /**
   * Log d'erreur
   */
  error(message: string, category?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, category, data);
  }

  /**
   * Log debug avec throttling - évite le flood des logs répétitifs
   */
  debugThrottled(message: string, category?: string, data?: unknown): void {
    this.logThrottled(LogLevel.DEBUG, message, category, data);
  }

  /**
   * Log info avec throttling - évite le flood des logs répétitifs
   */
  infoThrottled(message: string, category?: string, data?: unknown): void {
    this.logThrottled(LogLevel.INFO, message, category, data);
  }

  /**
   * Log warn avec throttling - évite le flood des logs répétitifs
   */
  warnThrottled(message: string, category?: string, data?: unknown): void {
    this.logThrottled(LogLevel.WARN, message, category, data);
  }

  /**
   * Log error avec throttling - évite le flood des logs répétitifs
   */
  errorThrottled(message: string, category?: string, data?: unknown): void {
    this.logThrottled(LogLevel.ERROR, message, category, data);
  }

  /**
   * Log avec throttling pour éviter le spam
   */
  private logThrottled(
    level: LogLevel,
    message: string,
    category?: string,
    data?: unknown
  ): void {
    const now = Date.now();
    
    // Créer une clé plus précise pour grouper les messages similaires
    const messageType = message.replace(/[\d.-]+/g, '#'); // Remplace nombres par # pour grouper
    const key = `${category || 'global'}-${level}-${messageType}`;
    
    const cached = this.throttleCache.get(key);
    
    if (!cached) {
      // Premier log de ce type
      this.throttleCache.set(key, { count: 1, lastTime: now, lastMessage: message });
      this.log(level, message, category, data);
      return;
    }
    
    // Incrémenter le compteur
    cached.count++;
    cached.lastMessage = message;
    
    // Si dans l'intervalle de throttling
    if (now - cached.lastTime < this.throttleInterval) {
      // Log seulement les premiers messages
      if (cached.count <= this.maxSimilarLogs) {
        this.log(level, message, category, data);
      } else if (cached.count === this.maxSimilarLogs + 1) {
        // Premier message de suppression
        this.log(level, `[THROTTLED] Future similar messages will be grouped...`, category);
      }
      return;
    }
    
    // Intervalle dépassé - logger un résumé si nécessaire
    if (cached.count > this.maxSimilarLogs) {
      const suppressedCount = cached.count - this.maxSimilarLogs;
      this.log(level, `[SUMMARY] ${suppressedCount}x similar: "${messageType}" (last: ${cached.lastMessage})`, category);
    }
    
    // Redémarrer le compteur pour cette clé
    cached.count = 1;
    cached.lastTime = now;
    cached.lastMessage = message;
    this.log(level, message, category, data);
    
    // Nettoyage périodique du cache pour éviter la fuite mémoire
    this.cleanupThrottleCache(now);
  }

  /**
   * Nettoie le cache de throttling des entrées anciennes
   */
  private cleanupThrottleCache(now: number): void {
    if (now - this.lastSummaryTime > this.summaryInterval) {
      this.lastSummaryTime = now;
      
      // Supprimer les entrées anciennes (plus de 10 secondes)
      const oldKeys: string[] = [];
      for (const [key, cached] of this.throttleCache.entries()) {
        if (now - cached.lastTime > 10000) {
          oldKeys.push(key);
        }
      }
      
      for (const key of oldKeys) {
        this.throttleCache.delete(key);
      }
      
      // Log du nettoyage si nécessaire
      if (oldKeys.length > 0) {
        this.debug(`Throttle cache cleanup: removed ${oldKeys.length} old entries`, 'Logger');
      }
    }
  }

  /**
   * Configure le système de throttling
   */
  configureThrottling(options: {
    interval?: number;
    maxSimilarLogs?: number;
    summaryInterval?: number;
  }): void {
    if (options.interval) this.throttleInterval = options.interval;
    if (options.maxSimilarLogs) this.maxSimilarLogs = options.maxSimilarLogs;
    if (options.summaryInterval) this.summaryInterval = options.summaryInterval;
    
    this.info(`Throttling configuré: interval=${this.throttleInterval}ms, max=${this.maxSimilarLogs}, summary=${this.summaryInterval}ms`, 'Logger');
  }

  /**
   * Obtient les statistiques de throttling
   */
  getThrottleStats(): { activeKeys: number; totalSuppressed: number } {
    let totalSuppressed = 0;
    for (const cached of this.throttleCache.values()) {
      if (cached.count > this.maxSimilarLogs) {
        totalSuppressed += cached.count - this.maxSimilarLogs;
      }
    }
    
    return {
      activeKeys: this.throttleCache.size,
      totalSuppressed
    };
  }

  /**
   * Remet à zéro le cache de throttling
   */
  resetThrottleCache(): void {
    this.throttleCache.clear();
    this.debug('Throttle cache reset', 'Logger');
  }
  private log(
    level: LogLevel,
    message: string,
    category?: string,
    data?: unknown
  ): void {
    // Vérifier le niveau
    if (level < this.logLevel) return;

    // Vérifier la catégorie si des catégories sont configurées
    // Si aucune catégorie n'est configurée, on affiche tout
    if (this.categories.size > 0 && category && !this.categories.has(category)) return;

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
        // eslint-disable-next-line no-console
        console.debug(`🐛 ${formattedMessage}`, data || '');
        break;
      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        console.info(`ℹ️ ${formattedMessage}`, data || '');
        break;
      case LogLevel.WARN:
        // eslint-disable-next-line no-console
        console.warn(`⚠️ ${formattedMessage}`, data || '');
        break;
      case LogLevel.ERROR:
        // eslint-disable-next-line no-console
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