/**
 * ConstraintUtilities.ts - Utilities for constraint calculations
 *
 * Centralized utilities for all constraint-related calculations:
 * • Tension calculations (common pattern for bridles and lines)
 * • Distance calculations
 * • Strain calculations
 *
 * This module eliminates duplication between:
 * • BridleSystem.pure.ts
 * • LineSystem.pure.ts
 * • ConstraintSolver.pure.ts
 */

import * as THREE from 'three';

import { PhysicsConstants } from '../config/PhysicsConstants';

/**
 * Result of constraint tension calculation
 */
export interface ConstraintTensionResult {
  /** Current distance between points (meters) */
  currentLength: number;
  /** Target/rest distance (meters) */
  targetLength: number;
  /** Strain = (current - target) / target */
  strain: number;
  /** Tension force (Newtons) */
  tension: number;
  /** Whether constraint is satisfied (within epsilon) */
  isSatisfied: boolean;
}

/**
 * ConstraintUtilities - Centralized constraint calculation utilities
 */
export class ConstraintUtilities {
  /**
   * Calculates tension for any constraint (bridle, line, etc)
   *
   * Physics model:
   * - strain = (currentLength - targetLength) / targetLength
   * - tension = max(0, strain * stiffness)
   * - constraint satisfied if |strain| < epsilon
   *
   * @param currentLength - Measured distance between constraint points (meters)
   * @param targetLength - Rest/target distance (meters)
   * @param stiffness - Constraint stiffness coefficient (N/m)
   * @returns Detailed tension result
   *
   * @example
   * const result = ConstraintUtilities.calculateTension(
   *   1.005,           // Current: 5mm stretched
   *   1.0,             // Target: 1.0 meter
   *   1000             // Stiffness: 1000 N/m
   * );
   * // Returns: { tension: 5, strain: 0.005, isSatisfied: false }
   */
  static calculateTension(
    currentLength: number,
    targetLength: number,
    stiffness: number
  ): ConstraintTensionResult {
    // Guard against zero/invalid values
    if (targetLength <= PhysicsConstants.EPSILON) {
      return {
        currentLength,
        targetLength,
        strain: 0,
        tension: 0,
        isSatisfied: true
      };
    }

    if (currentLength < PhysicsConstants.EPSILON) {
      currentLength = 0;
    }

    // Calculate strain
    const strain = (currentLength - targetLength) / targetLength;

    // Calculate tension (always non-negative for physical constraints)
    const tension = Math.max(0, strain * stiffness);

    // Check if constraint is satisfied (within epsilon threshold)
    const isSatisfied = Math.abs(strain) < PhysicsConstants.EPSILON;

    return {
      currentLength,
      targetLength,
      strain,
      tension,
      isSatisfied
    };
  }

  /**
   * Calculates tension for display purposes (simplified, for UI/debug)
   *
   * Used by:
   * • BridleSystem for tension visualization
   * • LineSystem for tension display
   *
   * Simplified model (no stiffness parameter):
   * - Returns normalized tension for color coding (0-1 range)
   *
   * @param currentLength - Measured distance
   * @param targetLength - Rest distance
   * @returns Normalized tension (0-1 for display, >1 for over-tension)
   *
   * @example
   * const displayTension = ConstraintUtilities.calculateDisplayTension(
   *   1.1,   // 10% stretched
   *   1.0
   * );
   * // Returns: 0.1 (10% of max)
   */
  static calculateDisplayTension(
    currentLength: number,
    targetLength: number
  ): number {
    if (targetLength <= PhysicsConstants.EPSILON) {
      return 0;
    }

    const strain = (currentLength - targetLength) / targetLength;
    return Math.max(0, strain);
  }

  /**
   * Calculates direction vector for a constraint
   *
   * Used to apply constraint forces in correct direction
   *
   * @param from - Starting point (world coordinates)
   * @param to - Ending point (world coordinates)
   * @returns Normalized direction vector (or zero vector if invalid)
   */
  static calculateConstraintDirection(
    from: THREE.Vector3,
    to: THREE.Vector3
  ): THREE.Vector3 {
    const direction = to.clone().sub(from);
    const length = direction.length();

    if (length < PhysicsConstants.EPSILON) {
      return new THREE.Vector3(0, 0, 0);
    }

    return direction.divideScalar(length);
  }

  /**
   * Calculates constraint force vector
   *
   * F = tension * direction
   *
   * @param currentLength - Measured distance
   * @param targetLength - Rest distance
   * @param stiffness - Constraint stiffness (N/m)
   * @param from - Starting point (world coordinates)
   * @param to - Ending point (world coordinates)
   * @returns Force vector (Newton, 3D)
   */
  static calculateConstraintForce(
    currentLength: number,
    targetLength: number,
    stiffness: number,
    from: THREE.Vector3,
    to: THREE.Vector3
  ): THREE.Vector3 {
    const result = this.calculateTension(currentLength, targetLength, stiffness);
    const direction = this.calculateConstraintDirection(from, to);

    return direction.multiplyScalar(result.tension);
  }

  /**
   * Validates that a constraint is satisfied
   *
   * Used in position-based dynamics convergence check
   *
   * @param currentLength - Measured distance
   * @param targetLength - Rest distance
   * @param tolerance - Maximum allowed strain (default: EPSILON)
   * @returns true if |strain| <= tolerance
   */
  static isConstraintSatisfied(
    currentLength: number,
    targetLength: number,
    tolerance: number = PhysicsConstants.EPSILON
  ): boolean {
    if (targetLength <= PhysicsConstants.EPSILON) {
      return true;
    }

    const strain = Math.abs((currentLength - targetLength) / targetLength);
    return strain <= tolerance;
  }

  /**
   * Batch validates multiple constraints
   *
   * Useful for PBD convergence check with multiple constraints
   *
   * @param constraints - Array of {current, target} measurements
   * @param tolerance - Maximum allowed strain
   * @returns true if ALL constraints are satisfied
   */
  static areConstraintsSatisfied(
    constraints: Array<{ current: number; target: number }>,
    tolerance: number = PhysicsConstants.EPSILON
  ): boolean {
    return constraints.every(c =>
      this.isConstraintSatisfied(c.current, c.target, tolerance)
    );
  }

  /**
   * Calculates strain percentage for display
   *
   * @param currentLength - Measured distance
   * @param targetLength - Rest distance
   * @returns Strain as percentage (-100 to 100+)
   *
   * @example
   * const strain = ConstraintUtilities.calculateStrainPercent(1.1, 1.0);
   * // Returns: 10 (10% strain)
   */
  static calculateStrainPercent(
    currentLength: number,
    targetLength: number
  ): number {
    if (targetLength <= PhysicsConstants.EPSILON) {
      return 0;
    }

    return ((currentLength - targetLength) / targetLength) * 100;
  }
}
