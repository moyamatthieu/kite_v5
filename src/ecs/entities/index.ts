/**
 * index.ts - Export centralisé des gestionnaires et factories d'entités
 */

// === Entity Management ===
export { EntityManager } from './EntityManager';
export { EntityBuilder, type TransformOptions, type MeshOptions, type EntityWithMeshOptions } from './EntityBuilder';

// === Factories ===
export {
  KiteEntityFactory,
  LineEntityFactory,
  ControlBarEntityFactory,
  ControlPointEntityFactory,
  PilotEntityFactory,
} from './factories';
