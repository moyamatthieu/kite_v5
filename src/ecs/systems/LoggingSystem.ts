/**
 * LoggingSystem.ts - Système ECS pur pour le logging et monitoring
 *
 * Architecture ECS pure :
 * - Hérite de BaseSystem pour s'intégrer dans la boucle de simulation
 * - Log l'état des entités et composants à intervalles réguliers
 * - Fournit des métriques de performance et de débogage
 */

import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { EntityManager } from '@entities/EntityManager';
import { TransformComponent } from '@components/TransformComponent';
import { PhysicsComponent } from '@components/PhysicsComponent';
import { LineComponent } from '@components/LineComponent';
import { Logger } from '@utils/Logging';

export interface LoggingConfig {
  /** Intervalle de logging en millisecondes */
  logInterval: number;
  /** Niveau de détail du logging */
  detailLevel: 'minimal' | 'standard' | 'detailed';
  /** Catégories à logger */
  categories: {
    entities: boolean;
    physics: boolean;
    performance: boolean;
    errors: boolean;
  };
}

export class LoggingSystem extends BaseSimulationSystem {
  private logger: Logger;
  private config: LoggingConfig;
  private lastLogTime: number = 0;
  private frameCount: number = 0;
  private startTime: number = 0;
  private entityManager: EntityManager | null = null;

  constructor(config: Partial<LoggingConfig> = {}) {
    super('LoggingSystem', 99); // Priorité très basse (logging en dernier)

    this.logger = Logger.getInstance();
    this.config = {
      logInterval: 1000, // Log toutes les secondes
      detailLevel: 'standard',
      categories: {
        entities: true,
        physics: true,
        performance: true,
        errors: true
      },
      ...config
    };
  }

  async initialize(): Promise<void> {
    this.startTime = performance.now();
    this.logger.info('🪵 LoggingSystem initialized', 'LoggingSystem');
    this.logger.info(`📊 Logging config: ${JSON.stringify(this.config, null, 2)}`, 'LoggingSystem');
  }

  /**
   * Définit la référence à l'EntityManager
   */
  setEntityManager(entityManager: EntityManager): void {
    this.entityManager = entityManager;
  }

  update(context: SimulationContext): void {
    this.frameCount++;
    const currentTime = performance.now();

    // Log périodique selon l'intervalle configuré
    if (currentTime - this.lastLogTime >= this.config.logInterval) {
      this.performPeriodicLogging(context);
      this.lastLogTime = currentTime;
    }

    // Log des erreurs si activé
    if (this.config.categories.errors) {
      this.logErrors(context);
    }
  }

  reset(): void {
    this.frameCount = 0;
    this.lastLogTime = 0;
    this.startTime = performance.now();
    this.logger.info('🔄 LoggingSystem reset', 'LoggingSystem');
  }

  private performPeriodicLogging(context: SimulationContext): void {
    if (!this.entityManager) {
      this.logger.warn('⚠️ EntityManager not set for LoggingSystem', 'LoggingSystem');
      return;
    }

    const elapsed = performance.now() - this.startTime;
    const fps = this.frameCount / (elapsed / 1000);

    // Log de performance
    if (this.config.categories.performance) {
      this.logger.info(`📈 Performance: ${fps.toFixed(1)} FPS, ${this.frameCount} frames, ${elapsed.toFixed(0)}ms elapsed`, 'LoggingSystem');
    }

    // Obtenir toutes les entités depuis EntityManager
    const entities = this.entityManager.getAllEntities();

    // Log des entités
    if (this.config.categories.entities) {
      this.logEntitiesState(entities);
    }

    // Log de la physique
    if (this.config.categories.physics) {
      this.logPhysicsState(entities);
    }
  }

  private logEntitiesState(entities: Entity[]): void {
    if (this.config.detailLevel === 'minimal') {
      this.logger.info(`📊 ${entities.length} entities active`, 'LoggingSystem');
      return;
    }

    let kiteCount = 0;
    let lineCount = 0;
    let pilotCount = 0;
    let controlBarCount = 0;

    for (const entity of entities) {
      if (entity.getComponent('kite')) kiteCount++;
      if (entity.getComponent('line')) lineCount++;
      if (entity.getComponent('pilot')) pilotCount++;
      if (entity.getComponent('controlBar')) controlBarCount++;
    }

    this.logger.info(`📊 Entities: ${kiteCount} kites, ${lineCount} lines, ${pilotCount} pilots, ${controlBarCount} control bars`, 'LoggingSystem');

    if (this.config.detailLevel === 'detailed') {
      this.logDetailedEntityStates(entities);
    }
  }

  private logDetailedEntityStates(entities: Entity[]): void {
    for (const entity of entities) {
      const transform = entity.getComponent<TransformComponent>('transform');
      if (transform) {
        const pos = transform.position;
        const entityType = this.getEntityType(entity);
        this.logger.debug(`📍 ${entityType} at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`, 'LoggingSystem');
      }
    }
  }

  private logPhysicsState(entities: Entity[]): void {
    if (this.config.detailLevel === 'minimal') return;

    let totalVelocity = 0;
    let entityCount = 0;

    for (const entity of entities) {
      const physics = entity.getComponent<PhysicsComponent>('physics');
      if (physics) {
        const speed = physics.velocity.length();
        totalVelocity += speed;
        entityCount++;

        if (this.config.detailLevel === 'detailed') {
          const entityType = this.getEntityType(entity);
          this.logger.debug(`🏃 ${entityType} velocity: ${speed.toFixed(3)} m/s`, 'LoggingSystem');
        }
      }
    }

    if (entityCount > 0) {
      const avgVelocity = totalVelocity / entityCount;
      this.logger.info(`🌪️ Average velocity: ${avgVelocity.toFixed(3)} m/s`, 'LoggingSystem');
    }
  }

  private logErrors(context: SimulationContext): void {
    // Log des erreurs de simulation (à implémenter selon les besoins)
    // Par exemple : entités sans composants requis, valeurs NaN, etc.
  }

  private getEntityType(entity: Entity): string {
    if (entity.getComponent('kite')) return 'Kite';
    if (entity.getComponent('line')) return 'Line';
    if (entity.getComponent('pilot')) return 'Pilot';
    if (entity.getComponent('controlBar')) return 'ControlBar';
    return 'Unknown';
  }

  /**
   * Log un événement spécifique
   */
  logEvent(message: string, data?: any): void {
    this.logger.info(`📝 ${message}`, 'LoggingSystem', data);
  }

  /**
   * Log une erreur
   */
  logError(message: string, error?: any): void {
    this.logger.error(`❌ ${message}`, 'LoggingSystem', error);
  }

  /**
   * Log un avertissement
   */
  logWarning(message: string, data?: any): void {
    this.logger.warn(`⚠️ ${message}`, 'LoggingSystem', data);
  }

  /**
   * Met à jour la configuration du logging
   */
  updateConfig(newConfig: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info(`🔧 Logging config updated: ${JSON.stringify(this.config, null, 2)}`, 'LoggingSystem');
  }

  dispose(): void {
    this.logger.info('🪵 LoggingSystem disposed', 'LoggingSystem');
  }
}