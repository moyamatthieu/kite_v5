/**
 * index.ts - Export centralisé des systèmes ECS
 */

export { InputSystem, type InputConfig } from './InputSystem';
export { RenderSystem, type RenderConfig } from './RenderSystem';
export { KitePhysicsSystem } from './KitePhysicsSystem';
export { KitePhysicsSystem as PureKitePhysicsSystem } from './KitePhysicsSystem';

// === SYSTÈMES ECS PURS (nouvelle architecture) ===
export { PureConstraintSolver, type FlightSphere } from './ConstraintSolver.pure';
export { PureLineSystem } from './LineSystem.pure';
export { PureBridleSystem } from './BridleSystem.pure';