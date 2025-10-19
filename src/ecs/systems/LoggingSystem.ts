/**
 * LoggingSystem.ts - Logs de debug périodiques
 * 
 * Affiche des infos sur l'état de la simulation à intervalles réguliers.
 * Priorité 80 (dernier système).
 */

import { System, SimulationContext } from '../core/System';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { Logger } from '../utils/Logging';

// Constantes de logging
const PRIORITY = 80;
const DEFAULT_LOG_INTERVAL_MS = 2000;
const MS_TO_SECONDS = 1000;
const DECIMAL_PRECISION = 2;
const TIME_PRECISION = 1;

export class LoggingSystem extends System {
  private lastLogTime = 0;
  private logInterval: number;
  private logger = Logger.getInstance();
  
  constructor(options: { logInterval?: number } = {}) {
    super('LoggingSystem', PRIORITY);
    this.logInterval = options.logInterval ?? DEFAULT_LOG_INTERVAL_MS;
  }
  
  update(context: SimulationContext): void {
    const { totalTime, entityManager } = context;
    
    // Log périodique
    if (totalTime - this.lastLogTime < this.logInterval / MS_TO_SECONDS) {
      return;
    }
    
    this.lastLogTime = totalTime;
    
    // Récupérer le kite
    const kite = entityManager.getEntity('kite');
    if (!kite) return;
    
    const transform = kite.getComponent<TransformComponent>('transform');
    const physics = kite.getComponent<PhysicsComponent>('physics');
    // kiteComp conservé pour usage futur (logging surface area, etc.)
    
    if (!transform || !physics) return;
    
    // Infos de debug
    const pos = transform.position;
    const vel = physics.velocity;
    const altitude = pos.y; // Y est l'altitude dans Three.js (axe vertical)
    const speed = vel.length();
    
    this.logger.info(
      `t=${totalTime.toFixed(TIME_PRECISION)}s | ` +
      `Pos: X=${pos.x.toFixed(DECIMAL_PRECISION)} Y=${pos.y.toFixed(DECIMAL_PRECISION)} Z=${pos.z.toFixed(DECIMAL_PRECISION)} | ` +
      `Vel: ${speed.toFixed(DECIMAL_PRECISION)} m/s | ` +
      `Alt: ${altitude.toFixed(DECIMAL_PRECISION)} m`,
      'Simulation'
    );
  }
}
