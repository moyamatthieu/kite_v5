/**
 * LoggingConfig.ts - Configuration centralisée du système de logging
 * 
 * Permet de configurer le logging selon l'environnement et les besoins de debug
 */

import { Logger, LogLevel } from '@utils/Logging';

export interface LoggingConfiguration {
  // Niveau global
  logLevel: LogLevel;
  
  // Catégories activées (vide = toutes)
  enabledCategories: string[];
  
  // Configuration du throttling
  throttling: {
    interval: number;           // ms entre logs similaires
    maxSimilarLogs: number;    // max logs avant throttling
    summaryInterval: number;   // ms entre résumés
  };
  
  // Mode développement/production
  isDevelopment: boolean;
}

/**
 * Configurations prédéfinies
 */
export class LoggingConfig {
  
  /**
   * Configuration pour développement - logs détaillés mais throttlés
   */
  static readonly DEVELOPMENT: LoggingConfiguration = {
    logLevel: LogLevel.DEBUG,  // Retour au DEBUG pour voir les problèmes
    enabledCategories: [], // Toutes les catégories
    throttling: {
      interval: 1500,      // 1.5s pour physique haute fréquence
      maxSimilarLogs: 2,   // Seulement 2 logs identiques avant throttling
      summaryInterval: 4000 // Résumé toutes les 4s
    },
    isDevelopment: true
  };

  /**
   * Configuration pour production - logs critiques uniquement
   */
  static readonly PRODUCTION: LoggingConfiguration = {
    logLevel: LogLevel.WARN,
    enabledCategories: ['SimulationApp', 'Logger', 'Error'], 
    throttling: {
      interval: 5000,      // 5s entre logs similaires
      maxSimilarLogs: 1,   // Un seul log avant throttling
      summaryInterval: 10000 // Résumé toutes les 10s
    },
    isDevelopment: false
  };

  /**
   * Configuration pour debug intense - tout visible sans throttling
   */
  static readonly DEBUG_INTENSIVE: LoggingConfiguration = {
    logLevel: LogLevel.DEBUG,
    enabledCategories: [], // Toutes les catégories
    throttling: {
      interval: 100,       // Throttling très court
      maxSimilarLogs: 10,  // Plus de logs autorisés
      summaryInterval: 2000 // Résumé rapide
    },
    isDevelopment: true
  };

  /**
   * Configuration pour performance - logs minimaux
   */
  static readonly PERFORMANCE: LoggingConfiguration = {
    logLevel: LogLevel.ERROR,
    enabledCategories: ['Error'],
    throttling: {
      interval: 10000,     // Throttling très long
      maxSimilarLogs: 1,   // Minimum de logs
      summaryInterval: 30000 // Résumé très espacé
    },
    isDevelopment: false
  };

  /**
   * Applique une configuration au Logger
   */
  static apply(config: LoggingConfiguration): void {
    const logger = Logger.getInstance();
    
    // Configurer le niveau
    logger.setLogLevel(config.logLevel);
    
    // Configurer les catégories
    if (config.enabledCategories.length > 0) {
      // Désactiver toutes d'abord
      logger.setCategoryEnabled('SimulationApp', false);
      logger.setCategoryEnabled('Logger', false);
      
      // Activer seulement celles demandées
      config.enabledCategories.forEach(category => {
        logger.setCategoryEnabled(category, true);
      });
    }
    
    // Configurer le throttling
    logger.configureThrottling(config.throttling);
    
    // Log de confirmation
    const levelName = LogLevel[config.logLevel];
    logger.info(
      `Configuration logging appliquée: ${levelName}, ` +
      `catégories=[${config.enabledCategories.join(', ') || 'toutes'}], ` +
      `throttling=${config.throttling.maxSimilarLogs}/${config.throttling.interval}ms`,
      'LoggingConfig'
    );
  }

  /**
   * Détecte automatiquement l'environnement et applique la config appropriée
   */
  static autoApply(): void {
    // Détection de l'environnement
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.search.includes('debug=true');
    
    const isPerformanceMode = window.location.search.includes('perf=true');
    const isDebugIntensive = window.location.search.includes('debug=intensive');
    
    let config: LoggingConfiguration;
    
    if (isDebugIntensive) {
      config = LoggingConfig.DEBUG_INTENSIVE;
    } else if (isPerformanceMode) {
      config = LoggingConfig.PERFORMANCE;
    } else if (isDev) {
      config = LoggingConfig.DEVELOPMENT;
    } else {
      config = LoggingConfig.PRODUCTION;
    }
    
    LoggingConfig.apply(config);
  }
}