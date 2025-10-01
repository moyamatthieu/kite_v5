/**
 * Point d'entrée principal de la simulation modulaire
 */

// Export de la classe principale
export { Simulation } from './SimulationApp';

// Re-export de tous les modules pour faciliter l'importation
export * from './config/PhysicsConstants';
export * from './config/KiteGeometry';
export * from './config/SimulationConfig';

export * from './types';

export * from './physics/WindSimulator';
export * from './physics/AerodynamicsCalculator';
export * from './physics/LineSystem';
export * from './physics/PhysicsEngine';

export * from './controllers/ControlBarManager';
export * from './controllers/KiteController';
export * from './controllers/InputHandler';

export * from './rendering/RenderManager';
export * from './rendering/DebugRenderer';

export * from './ui/UIManager';

export * from './physics/ConstraintSolver';