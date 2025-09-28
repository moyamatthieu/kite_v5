/**
 * 🪵 Logger.ts - Système de logging optimisé pour la simulation
 *
 * 🎯 Objectifs :
 * - Éviter le flood de logs répétitifs
 * - Logging intelligent avec niveaux et throttling
 * - Performance optimale (pas de calculs inutiles)
 * - Formatage propre et lisible
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

interface LogEntry {
  timestamp: number;
  count: number;
}

/**
 * 🚀 Logger ultra-optimisé pour simulations temps réel
 */
export class Logger {
  private static instance: Logger;
  private logHistory = new Map<string, LogEntry>();
  private level: LogLevel = LogLevel.INFO;
  private enabled: boolean = true;

  // 🎛️ Configuration du throttling (TRÈS RESTRICTIF)
  private readonly THROTTLE_INTERVALS = {
    [LogLevel.DEBUG]: 10000, // Debug: 1 fois/10 secondes max
    [LogLevel.INFO]: 5000, // Info: 1 fois/5 secondes max
    [LogLevel.WARN]: 5000, // Warning: 1 fois/5 secondes max
    [LogLevel.ERROR]: 1000, // Error: 1 fois/seconde max
    [LogLevel.CRITICAL]: 0, // Critical: Jamais throttlé
  };

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 🎯 Configuration globale du logger
   */
  configure(level: LogLevel, enabled: boolean = true): void {
    this.level = level;
    this.enabled = enabled;
  }

  /**
   * 🔍 Log debug (très fréquent, fortement throttlé)
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, "🔍", message, data);
  }

  /**
   * ℹ️ Log info (modérément throttlé)
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, "ℹ️", message, data);
  }

  /**
   * ⚠️ Log warning (légèrement throttlé)
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, "⚠️", message, data);
  }

  /**
   * 🚨 Log error (jamais throttlé)
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, "🚨", message, data);
  }

  /**
   * 💥 Log critical (jamais throttlé)
   */
  critical(message: string, data?: any): void {
    this.log(LogLevel.CRITICAL, "💥", message, data);
  }

  /**
   * 📊 Log de performance DÉSACTIVÉ temporairement pour stopper le flood
   */
  performance(operation: string, timeMs: number, threshold: number = 16): void {
    // 🚫 COMPLÈTEMENT DÉSACTIVÉ - Aucun log de performance
    // Seuls les cas ultra-critiques (>500ms) passent
    if (timeMs > 500) {
      this.log(
        LogLevel.ERROR,
        "�",
        `ULTRA-CRITIQUE ${operation}: ${timeMs.toFixed(1)}ms`
      );
    }
  }

  /**
   * 🎯 Log principal avec système de throttling
   */
  private log(
    level: LogLevel,
    emoji: string,
    message: string,
    data?: any
  ): void {
    if (!this.enabled || level < this.level) return;

    const now = performance.now();
    const key = `${level}-${message}`;
    const throttleInterval = this.THROTTLE_INTERVALS[level];

    // Vérification du throttling
    if (throttleInterval > 0) {
      const lastLog = this.logHistory.get(key);
      if (lastLog && now - lastLog.timestamp < throttleInterval) {
        lastLog.count++;
        return; // Message throttlé
      }
    }

    // Mise à jour de l'historique
    this.logHistory.set(key, { timestamp: now, count: 1 });

    // Construction du message final
    const timestamp = new Date().toISOString().substr(11, 12); // HH:mm:ss.sss
    const prefix = `[${timestamp}] ${emoji}`;

    if (data !== undefined) {
      this.logToConsole(level, `${prefix} ${message}`, data);
    } else {
      this.logToConsole(level, `${prefix} ${message}`);
    }

    // Nettoyage périodique de l'historique (évite fuite mémoire)
    if (this.logHistory.size > 1000) {
      this.cleanupHistory();
    }
  }

  /**
   * 🧹 Nettoyage périodique de l'historique des logs
   */
  private cleanupHistory(): void {
    const now = performance.now();
    const cutoff = now - 60000; // Garder 60 secondes d'historique

    for (const [key, entry] of this.logHistory.entries()) {
      if (entry.timestamp < cutoff) {
        this.logHistory.delete(key);
      }
    }
  }

  /**
   * 🖨️ Sortie console selon le niveau de log
   */
  private logToConsole(level: LogLevel, message: string, data?: any): void {
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message, data);
        break;
      case LogLevel.INFO:
        console.info(message, data);
        break;
      case LogLevel.WARN:
        console.warn(message, data);
        break;
      case LogLevel.ERROR:
        console.error(message, data);
        break;
      case LogLevel.CRITICAL:
        console.error(message, data);
        break;
    }
  }

  /**
   * � Log périodique pour les stats (très fortement throttlé)
   */
  periodic(message: string, data?: any, intervalMs: number = 5000): void {
    const key = `periodic-${message}`;
    const now = performance.now();
    const lastLog = this.logHistory.get(key);

    if (!lastLog || now - lastLog.timestamp >= intervalMs) {
      this.logHistory.set(key, { timestamp: now, count: 1 });
      this.info(message, data);
    }
  }

  /**
   * �📈 Stats du système de logging
   */
  getStats(): { totalLogs: number; throttledMessages: number } {
    let totalLogs = 0;
    let throttledMessages = 0;

    for (const entry of this.logHistory.values()) {
      totalLogs++;
      if (entry.count > 1) {
        throttledMessages += entry.count - 1;
      }
    }

    return { totalLogs, throttledMessages };
  }
}

// 🌟 Instance globale pour faciliter l'utilisation
export const logger = Logger.getInstance();
