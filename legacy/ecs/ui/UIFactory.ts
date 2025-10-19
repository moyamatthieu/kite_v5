/**
 * UIFactory.ts - Factory pour création des contrôles simulation UI
 *
 * Encapsule la création et configuration de SimulationControls
 * pour l'interface utilisateur
 */

import * as THREE from "three";
import { SimulationControls } from "@ui/UIManager";
import { CONFIG } from "@config/SimulationConfig";
import { Entity } from "@base/Entity";
import { BridleComponent } from "@components/BridleComponent";
import { LineComponent } from "@components/LineComponent";
import { KitePhysicsSystem } from "@systems/KitePhysicsSystem";
import { AeroVectorsDebugSystem } from "@systems/AeroVectorsDebugSystem";
import { ControlPointDebugRenderer } from "@systems/ControlPointDebugRenderer";

/**
 * Interface pour dépendances du factory
 * 
 * ✅ NOUVEAU: controlPointDebugRenderer optionnel
 * Les CTRL sont maintenant des points locaux du kite
 */
export interface UIFactoryDependencies {
  kiteEntity: Entity | null;
  leftLineEntity: Entity | null;
  kitePhysicsSystem: KitePhysicsSystem | null;
  aeroVectorsDebugSystem: AeroVectorsDebugSystem | null;
  controlPointDebugRenderer?: ControlPointDebugRenderer | null;
}

/**
 * Factory pour créer les contrôles simulation UI
 */
export class UIFactory {
  /**
   * Crée l'objet SimulationControls avec toutes les méthodes de contrôle
   *
   * @param deps - Dépendances (kite, lines, systèmes)
   * @returns Objet SimulationControls complet
   */
  static createSimulationControls(deps: UIFactoryDependencies): SimulationControls {
    return {
      /**
       * Getters pour les longueurs de bridle
       */
      getBridleLengths: () => UIFactory.getBridleLengths(deps.kiteEntity),

      /**
       * Setters pour les longueurs de bridle
       */
      setBridleLength: (type: "nez" | "inter" | "centre", length: number) =>
        UIFactory.setBridleLength(deps.kitePhysicsSystem, type, length),

      /**
       * Contrôle longueur des lignes
       */
      setLineLength: (length: number) => UIFactory.setLineLength(deps.kitePhysicsSystem, length),

      /**
       * Contrôles du vent
       */
      setWindParams: (params: { speed?: number; direction?: number; turbulence?: number }) =>
        UIFactory.setWindParams(deps.kitePhysicsSystem, params),

      /**
       * Force smoothing
       */
      getForceSmoothing: () => UIFactory.getForceSmoothing(deps.kitePhysicsSystem),
      setForceSmoothing: (value: number) => UIFactory.setForceSmoothing(deps.kitePhysicsSystem, value),

      /**
       * État du kite
       */
      getKiteState: () => UIFactory.getKiteState(deps.kitePhysicsSystem),

      /**
       * État du vent
       */
      getWindState: () => UIFactory.getWindState(deps.kitePhysicsSystem),

      /**
       * Getters pour longueur des lignes
       */
      getLineLength: () => UIFactory.getLineLength(deps.leftLineEntity),

      /**
       * Diagnostiques des lignes de contrôle
       */
      getControlLineDiagnostics: () => UIFactory.getControlLineDiagnostics(deps.kitePhysicsSystem),

      /**
       * Forces aérodynamiques
       */
      getAerodynamicForces: () => UIFactory.getAerodynamicForces(deps.kitePhysicsSystem),

      /**
       * Vecteurs aérodynamiques debug
       */
      setAeroVectorsEnabled: (enabled: boolean) =>
        UIFactory.setAeroVectorsEnabled(deps.aeroVectorsDebugSystem, enabled),

      setVectorTypeEnabled: (type: "lift" | "drag" | "apparentWind", enabled: boolean) =>
        UIFactory.setVectorTypeEnabled(deps.aeroVectorsDebugSystem, type, enabled),

      setVectorScale: (type: "lift" | "drag" | "apparentWind", scale: number) =>
        UIFactory.setVectorScale(deps.aeroVectorsDebugSystem, type, scale),

      /**
       * Debug points de contrôle (désactivé si CTRL locaux)
       */
      setControlPointDebugEnabled: (enabled: boolean) =>
        UIFactory.setControlPointDebugEnabled(deps.controlPointDebugRenderer ?? null, enabled),
    };
  }

  // ============================================================================
  // Bridle Length Methods
  // ============================================================================

  private static getBridleLengths(kiteEntity: Entity | null) {
    if (kiteEntity) {
      const bridleComponent = kiteEntity.getComponent<BridleComponent>("bridle");
      if (bridleComponent) {
        return { ...bridleComponent.lengths };
      }
    }

    return {
      nez: 0.65,
      inter: 0.65,
      centre: 0.65,
    };
  }

  private static setBridleLength(
    system: KitePhysicsSystem | null,
    type: "nez" | "inter" | "centre",
    length: number
  ) {
    if (system) {
      const currentLengths = system.getBridleLengths();
      system.setBridleLengths({
        ...currentLengths,
        [type]: length,
      });
    }
  }

  // ============================================================================
  // Line Methods
  // ============================================================================

  private static setLineLength(system: KitePhysicsSystem | null, length: number) {
    if (system) {
      system.setLineLength(length);
    }
  }

  private static getLineLength(leftLineEntity: Entity | null): number {
    if (leftLineEntity) {
      const lineComponent = leftLineEntity.getComponent<LineComponent>("line");
      if (lineComponent) {
        return lineComponent.config.length;
      }
    }

    return CONFIG.lines.defaultLength;
  }

  // ============================================================================
  // Wind Methods
  // ============================================================================

  private static setWindParams(
    system: KitePhysicsSystem | null,
    params: { speed?: number; direction?: number; turbulence?: number }
  ) {
    if (system) {
      system.setWindParams(params);
    }
  }

  private static getWindState(system: KitePhysicsSystem | null) {
    const windState = system?.getWindState();
    return windState
      ? {
          baseSpeed: windState.baseSpeed,
          baseDirection: windState.baseDirection,
          turbulence: windState.turbulence,
        }
      : {
          baseSpeed: 0,
          baseDirection: new THREE.Vector3(),
          turbulence: 0,
        };
  }

  // ============================================================================
  // Force Smoothing Methods
  // ============================================================================

  private static getForceSmoothing(system: KitePhysicsSystem | null): number {
    return system?.getForceSmoothing() || 0.1;
  }

  private static setForceSmoothing(system: KitePhysicsSystem | null, value: number) {
    if (system) {
      system.setForceSmoothing(value);
    }
  }

  // ============================================================================
  // Kite State Methods
  // ============================================================================

  private static getKiteState(system: KitePhysicsSystem | null) {
    return system?.getKiteState() || {
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      orientation: new THREE.Quaternion(),
    };
  }

  // ============================================================================
  // Aerodynamic Methods
  // ============================================================================

  private static getControlLineDiagnostics(system: KitePhysicsSystem | null) {
    return system?.getControlLineDiagnostics() || null;
  }

  private static getAerodynamicForces(system: KitePhysicsSystem | null) {
    return system?.getAerodynamicForces() || null;
  }

  // ============================================================================
  // Aero Vectors Debug Methods
  // ============================================================================

  private static setAeroVectorsEnabled(system: AeroVectorsDebugSystem | null, enabled: boolean) {
    if (system) {
      system.setDebugEnabled(enabled);
    }
  }

  private static setVectorTypeEnabled(
    system: AeroVectorsDebugSystem | null,
    type: "lift" | "drag" | "apparentWind",
    enabled: boolean
  ) {
    if (system) {
      system.setVectorEnabled(type, enabled);
    }
  }

  private static setVectorScale(
    system: AeroVectorsDebugSystem | null,
    type: "lift" | "drag" | "apparentWind",
    scale: number
  ) {
    if (system) {
      system.setVectorScale(type, scale);
    }
  }

  // ============================================================================
  // Control Point Debug Methods
  // ============================================================================

  private static setControlPointDebugEnabled(system: ControlPointDebugRenderer | null, enabled: boolean) {
    if (system) {
      system.setDebugEnabled(enabled);
    }
  }
}
