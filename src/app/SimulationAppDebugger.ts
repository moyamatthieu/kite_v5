/**
 * SimulationAppDebugger.ts - Gestionnaire de debug et visualisation
 *
 * Gère les informations de debug, flèches visuelles et panneau de debug.
 */

import * as THREE from "three";
import { AerodynamicsCalculator } from "../physics/AerodynamicsCalculator";
import { CONFIG } from "../config/GlobalConfig"; // Ajout de l'import manquant
import { SimulationApp } from "./SimulationApp";
import type { KiteState } from "../types/kite";

export class SimulationAppDebugger {
  private app: SimulationApp;
  private debugArrows: THREE.ArrowHelper[] = [];
  private velocityArrow?: THREE.ArrowHelper;
  private liftArrow?: THREE.ArrowHelper;
  private dragArrow?: THREE.ArrowHelper;
  private windArrow?: THREE.ArrowHelper;

  constructor(app: SimulationApp) {
    this.app = app;
  }

  updateDebugInfo(): void {
    if (!this.app.debugMode) return;

    const kiteController = this.app.physicsEngine.getKiteControllers()[0];
    const kiteState = kiteController.getState();
    const kitePosition = this.app.kite.position;

    // Calculer le centre géométrique du kite
    const centerLocal = new THREE.Vector3(0, 0.325, 0);
    const centerWorld = this.app.kite.localToWorld(centerLocal.clone());

    // Calculs communs (velocity, wind, forces) - toujours effectués pour display
    const velocity = kiteState.velocity;
    const windSimulator = this.app.physicsEngine.getWindSimulator();
    const wind = windSimulator.getWindAt(kitePosition);
    const apparentWind = windSimulator.getApparentWind(velocity, 0.016);
    const relativeWind = wind.clone().sub(velocity);

    let lift = new THREE.Vector3();
    let drag = new THREE.Vector3();
    if (relativeWind.length() > 0.1) {
      ({ lift, drag } = AerodynamicsCalculator.calculateForces(
        relativeWind,
        this.app.kite.quaternion
      ));
    }

    // Mise à jour display textuel (toujours)
    this.updateDebugDisplay(kiteState, kitePosition, { lift, drag });

    // Mise à jour visuelle des flèches si activée
    if (this.app.debugVisualsEnabled) {
      this.updateDebugArrows(centerWorld, velocity, apparentWind, lift, drag);
    }
  }

  private updateDebugArrows(
    centerWorld: THREE.Vector3,
    velocity: THREE.Vector3,
    apparentWind: THREE.Vector3,
    lift: THREE.Vector3,
    drag: THREE.Vector3
  ): void {
    // Flèche de vitesse (verte)
    this.velocityArrow = this.updateArrow(
      this.velocityArrow,
      centerWorld,
      velocity.clone().normalize(),
      velocity.length() * 0.5,
      0x00ff00,
      0.3,
      0.3
    );

    // Flèche de vent apparent (jaune)
    this.windArrow = this.updateArrow(
      this.windArrow,
      centerWorld,
      apparentWind.clone().normalize(),
      apparentWind.length() * 0.5,
      0xffff00,
      0.2,
      0.2
    );

    // Flèche de portance (bleue)
    this.liftArrow = this.updateArrow(
      this.liftArrow,
      centerWorld,
      lift.clone().normalize(),
      Math.sqrt(lift.length()) * 0.3,
      0x0088ff,
      0.3,
      0.3,
      lift.length() > 0.01
    );

    // Flèche de traînée (rouge)
    this.dragArrow = this.updateArrow(
      this.dragArrow,
      centerWorld,
      drag.clone().normalize(),
      Math.sqrt(drag.length()) * 0.3,
      0xff0000,
      0.3,
      0.3,
      drag.length() > 0.01
    );
  }

  private updateArrow(
    arrow: THREE.ArrowHelper | undefined,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    color: number,
    headLength: number,
    headWidth: number,
    show = true
  ): THREE.ArrowHelper | undefined {
    if (show && length > 0.1) {
      if (!arrow) {
        arrow = new THREE.ArrowHelper(
          direction,
          position,
          length,
          color,
          headLength,
          headWidth
        );
        this.app.renderManager.addObject(arrow);
      } else {
        arrow.position.copy(position);
        arrow.setDirection(direction);
        arrow.setLength(length, headLength, headWidth);
      }
      return arrow;
    } else if (arrow) {
      this.app.renderManager.removeObject(arrow);
      return undefined;
    }
    return arrow;
  }

  private updateDebugDisplay(
    kiteState: KiteState,
    kitePosition: THREE.Vector3,
    cachedForces?: { lift: THREE.Vector3; drag: THREE.Vector3 }
  ): void {
    const debugInfo = document.getElementById("debug-info");
    if (!debugInfo || !this.app.debugMode) return;

    // Récupération des données de debug
    const windSimulator = this.app.physicsEngine.getWindSimulator();
    const controlBarManager = this.app.physicsEngine.getControlBarManager();
    const lineSystem = this.app.physicsEngine.getLineSystem();
    const kiteController = this.app.physicsEngine.getKiteControllers()[0];
    const warnings = kiteController.getWarnings();

    const handles = controlBarManager.getHandlePositions(kitePosition);
    const leftDist =
      this.app.kite
        .getPoint("CTRL_GAUCHE")
        ?.clone()
        .applyQuaternion(this.app.kite.quaternion)
        .add(kitePosition)
        .distanceTo(handles.left) || 0;
    const rightDist =
      this.app.kite
        .getPoint("CTRL_DROIT")
        ?.clone()
        .applyQuaternion(this.app.kite.quaternion)
        .add(kitePosition)
        .distanceTo(handles.right) || 0;

    // Calcul de l'angle d'attaque et autres métriques
    const velocity = kiteState.velocity;
    const apparentWind = windSimulator.getApparentWind(velocity, 0.016);
    const kiteForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      this.app.kite.quaternion
    );
    const angleOfAttack =
      Math.asin(
        apparentWind.clone().normalize().dot(kiteForward.clone().normalize())
      ) *
      (180 / Math.PI);

    // Mise à jour du panneau de debug
    const wind = windSimulator.getWindAt(kitePosition);
    const barRotation = controlBarManager.getRotation() * (180 / Math.PI);

    // Calcul inline de la tension moyenne des lignes
    const pilotPosition = new THREE.Vector3(...CONFIG.controlBar.position);
    const tensions = lineSystem.calculateLineTensions(
      this.app.kite,
      controlBarManager.getRotation(),
      pilotPosition
    );
    const lineTension =
      (tensions.leftForce.length() + tensions.rightForce.length()) / 2;

    const infoHTML = `
      <div class="debug-section">
        <h4>📍 Position Kite</h4>
        <p>X: ${kitePosition.x.toFixed(1)}m Y: ${kitePosition.y.toFixed(
      1
    )}m Z: ${kitePosition.z.toFixed(1)}m</p>
      </div>
      <div class="debug-section">
        <h4>💨 Vent & Vitesse</h4>
        <p>Vent: ${wind.length().toFixed(1)} m/s | Vitesse: ${velocity
      .length()
      .toFixed(1)} m/s</p>
        <p>Angle d'attaque: ${angleOfAttack.toFixed(
          1
        )}° | Rotation barre: ${barRotation.toFixed(1)}°</p>
      </div>
      <div class="debug-section">
        <h4>⚡ Forces</h4>
        ${
          cachedForces
            ? `
          <p>Portance: ${cachedForces.lift
            .length()
            .toFixed(1)}N | Traînée: ${cachedForces.drag
                .length()
                .toFixed(1)}N</p>
          <p>Tension lignes: ${lineTension.toFixed(1)}N</p>
        `
            : "<p>Calcul en cours...</p>"
        }
      </div>
    `;

    debugInfo.innerHTML = infoHTML;
  }

  clearDebugArrows(): void {
    // Nettoyer toutes les flèches individuelles
    [
      this.velocityArrow,
      this.liftArrow,
      this.dragArrow,
      this.windArrow,
    ].forEach((arrow) => {
      if (arrow) {
        this.app.renderManager.removeObject(arrow);
      }
    });

    // Réinitialiser les références
    this.velocityArrow = undefined;
    this.liftArrow = undefined;
    this.dragArrow = undefined;
    this.windArrow = undefined;

    // Nettoyer l'ancien array (maintenu pour compatibilité)
    this.debugArrows.forEach((arrow) => {
      this.app.renderManager.removeObject(arrow);
    });
    this.debugArrows = [];
  }

  // Méthodes publiques pour toggles (appelées depuis app)
  toggleDebugMode(): void {
    this.app.debugMode = !this.app.debugMode;
    const debugInfo = document.getElementById("debug-info");
    if (debugInfo) {
      debugInfo.style.display = this.app.debugMode ? "block" : "none";
    }
    console.log(
      this.app.debugMode ? "🐛 Mode debug activé" : "🚫 Mode debug désactivé"
    );
  }

  toggleFullDebug(): void {
    this.app.debugMode = !this.app.debugMode;
    this.app.debugVisualsEnabled = !this.app.debugVisualsEnabled;

    // Toggle panneau textuel
    const debugInfo = document.getElementById("debug-info");
    if (debugInfo) {
      debugInfo.style.display = this.app.debugMode ? "block" : "none";
    }

    // Nettoyage des vecteurs si désactivé
    if (!this.app.debugVisualsEnabled) {
      [
        this.velocityArrow,
        this.liftArrow,
        this.dragArrow,
        this.windArrow,
      ].forEach((arrow) => {
        if (arrow) {
          this.app.renderManager.removeObject(arrow);
        }
      });
      this.velocityArrow = undefined;
      this.liftArrow = undefined;
      this.dragArrow = undefined;
      this.windArrow = undefined;
    }

    console.log(
      this.app.debugMode
        ? "🐛 Debug complet activé : panneau + vecteurs"
        : "🚫 Debug complet désactivé"
    );
  }

  toggleDebugVisuals(): void {
    this.app.debugVisualsEnabled = !this.app.debugVisualsEnabled;

    if (!this.app.debugVisualsEnabled) {
      // Nettoyage des vecteurs
      [
        this.velocityArrow,
        this.liftArrow,
        this.dragArrow,
        this.windArrow,
      ].forEach((arrow) => {
        if (arrow) {
          this.app.renderManager.removeObject(arrow);
        }
      });
      this.velocityArrow = undefined;
      this.liftArrow = undefined;
      this.dragArrow = undefined;
      this.windArrow = undefined;
    }

    console.log(
      this.app.debugVisualsEnabled
        ? "👁️ Vecteurs debug activés"
        : "👁️ Vecteurs debug désactivés"
    );
  }
}
