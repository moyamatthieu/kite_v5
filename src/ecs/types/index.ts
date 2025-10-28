/**
 * index.ts - Export centralisé de tous les types
 *
 * Centre unique pour tous les types du système ECS:
 * - PhysicsTypes: État physique, forces, vent
 * - BridleTypes: Bridage, tensions, configuration
 * - WindTypes: Paramètres et état du vent
 */

// Physics types
export type { KiteState, WindState, HandlePositions, SurfaceForce } from "./PhysicsTypes";

// Bridle types
export type {
  BridleLengths,
  BridleTensions,
  BridleAttachment,
  BridleConfig,
  BridleSide,
  BridlePosition,
} from "./BridleTypes";

// Wind types (WindParams already re-exported from PhysicsTypes)
export type { WindParams } from "./PhysicsTypes";

