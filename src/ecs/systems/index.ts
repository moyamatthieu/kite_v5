/**
 * index.ts - Export centralisé de tous les systèmes ECS
 * 
 * Convention : toujours importer depuis ce fichier, jamais directement depuis les fichiers
 * pour faciliter les refactorings et maintenir une dépendance unique.
 */

// === CORE SYSTEMS (Orchestration & Infrastructure) ===
export { SystemManager } from './SystemManager';

// === INPUT & INTERACTION ===
export { InputSystem, type InputConfig } from './InputSystem';
export { ControlBarSystem } from './ControlBarSystem';
export { ControlPointSystem } from './ControlPointSystem';
export { PilotSystem } from './PilotSystem';

// === PHYSICS & DYNAMICS ===
export { KitePhysicsSystem } from './KitePhysicsSystem';
export { PureConstraintSolver } from './ConstraintSolver';
export { PureLineSystem } from './LineSystem';
export { PureBridleSystem } from './BridleSystem';
export { PureKiteController } from './KiteController';
export { AerodynamicsCalculator } from './AerodynamicsCalculator';
export { LinePhysics } from './LinePhysics';
export { VelocityCalculator } from './VelocityCalculator';
export { WindSimulator } from './WindSimulator';

// === FEEDBACK & HMI ===
export { PilotFeedbackSystem } from './PilotFeedbackSystem';

// === RENDERING ===
export { RenderSystem, type RenderConfig } from './RenderSystem';
export { RenderManager } from './RenderManager';
export { GeometryRenderSystem } from './GeometryRenderSystem';
export { LinesRenderSystem } from './LinesRenderSystem';
export { ControlPointDebugRenderer } from './ControlPointDebugRenderer';
export { AeroVectorsDebugSystem } from './AeroVectorsDebugSystem';

// === LOGGING & DEBUG ===
export { LoggingSystem } from './LoggingSystem';

// === LEGACY ALIASES (for backward compatibility) ===
export { KitePhysicsSystem as PureKitePhysicsSystem } from './KitePhysicsSystem';