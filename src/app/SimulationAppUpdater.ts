/**
 * SimulationAppUpdater.ts - Gestionnaire des mises à jour en boucle
 *
 * Gère les mises à jour des lignes, barre, UI et performance dans la boucle animate.
 */

import * as THREE from "three";
import { SimulationApp } from "./SimulationApp";

export class SimulationAppUpdater {
  private app: SimulationApp;
  private _frameCount: number = 0;
  private _linesUpdateInterval: number = 3;

  constructor(app: SimulationApp) {
    this.app = app;
  }

  update(deltaTime: number, currentTime: number): void {
    // Throttling pour lignes coûteuses
    this._frameCount++;
    if (this._frameCount % this._linesUpdateInterval === 0) {
      this.updateLines();
    }

    // Mise à jour visuelle barre
    this.updateControlBarVisual();

    // Mise à jour UI si existe
    if (this.app.simulationUI) {
      const fps = Math.round(
        1000 / (currentTime - this.app._lastFpsTime || 16.67)
      );

      // Altitude mondiale du nez
      const nezLocal = this.app.kite.getPoint("NEZ"); // Casse majuscule
      let altitude = 0;
      if (nezLocal) {
        const nezWorld = new THREE.Vector3(...nezLocal)
          .applyQuaternion(this.app.kite.quaternion)
          .add(this.app.kite.position);
        altitude = nezWorld.y;
      } else {
        console.warn("Point NEZ non trouvé pour altitude UI");
      }

      this.app.simulationUI.updateRealTimeValues({
        fps,
        windSpeed: this.app.physicsEngine.getWindSimulator().getParams().speed,
        altitude: altitude,
      });
      this.app._lastFpsTime = currentTime;
    } else {
      console.warn("simulationUI non initialisée - Vérifiez Initializer");
    }

    // Profiling
    const physicsTime = performance.now() - this.app._physicsStart;
    const renderTime = performance.now() - this.app._renderStart;
    if (physicsTime > 16 || renderTime > 16) {
      console.warn(
        `🔍 Physique: ${physicsTime.toFixed(1)}ms | Rendu: ${renderTime.toFixed(
          1
        )}ms | Delta: ${deltaTime.toFixed(3)}s`
      );
    }

    // Legacy FPS warn
    const currentFps = 1000 / (currentTime - this.app._lastFpsTime || 16.67);
    if (currentFps < 30) {
      console.warn(
        `FPS bas (${Math.round(
          currentFps
        )}), delta ajusté à ${deltaTime.toFixed(3)}s`
      );
    }
  }

  private updateControlBarVisual(): void {
    const controlBarManager = this.app.physicsEngine.getControlBarManager();
    const rotation = controlBarManager.getRotation();
    this.app.controlBar.rotation.y = rotation;
  }

  private updateLines(): void {
    if (!this.app.leftLine || !this.app.rightLine) return;

    const controlBarManager = this.app.physicsEngine.getControlBarManager();
    const lineSystem = this.app.physicsEngine.getLineSystem();
    const handles = controlBarManager.getHandlePositions(
      this.app.kite.position
    );

    // Points d'attache sur le kite
    const leftAttach = this.app.kite.getPoint("CTRL_GAUCHE");
    const rightAttach = this.app.kite.getPoint("CTRL_DROIT");

    if (leftAttach && rightAttach) {
      const leftWorld = leftAttach
        .clone()
        .applyQuaternion(this.app.kite.quaternion)
        .add(this.app.kite.position);
      const rightWorld = rightAttach
        .clone()
        .applyQuaternion(this.app.kite.quaternion)
        .add(this.app.kite.position);

      // Calcul des caténaires
      const leftPoints = lineSystem.calculateCatenary(leftWorld, handles.left);
      const rightPoints = lineSystem.calculateCatenary(
        rightWorld,
        handles.right
      );

      // Mise à jour des géométries
      const leftPositions = new Float32Array(leftPoints.length * 3);
      const rightPositions = new Float32Array(rightPoints.length * 3);

      leftPoints.forEach((point, i) => {
        leftPositions[i * 3] = point.x;
        leftPositions[i * 3 + 1] = point.y;
        leftPositions[i * 3 + 2] = point.z;
      });

      rightPoints.forEach((point, i) => {
        rightPositions[i * 3] = point.x;
        rightPositions[i * 3 + 1] = point.y;
        rightPositions[i * 3 + 2] = point.z;
      });

      this.app.leftLine!.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(leftPositions, 3)
      );
      this.app.rightLine!.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(rightPositions, 3)
      );
    }
  }
}
