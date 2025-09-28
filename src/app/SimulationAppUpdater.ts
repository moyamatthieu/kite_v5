/**
 * SimulationAppUpdater.ts - Gestionnaire des mises à jour
 *
 * Responsabilités :
 * - Gestion des mises à jour des lignes avec throttling intelligent
 * - Mise à jour UI et performance avec logging optimisé
 * - Évite le flood de logs répétitifs dans la boucle principale
 */

import * as THREE from "three";
import { SimulationApp } from "./SimulationApp";
import { logger } from "@utils/Logger";

export class SimulationAppUpdater {
  private app: SimulationApp;
  private _frameCount: number = 0;
  private _linesUpdateInterval: number = 3; // Mis à jour toutes les 3 frames (16 FPS au lieu de 50)
  private _lastLogTime: number = 0;
  private _lastFpsLogTime: number = 0;
  private _logInterval: number = 1000; // Log max 1 fois par seconde

  // Cache pour éviter les allocations
  private _tempVector = new THREE.Vector3();
  private _tempQuaternion = new THREE.Quaternion();

  // Cache spécifique pour les lignes (évite allocations critiques)
  private _leftWorldCache = new THREE.Vector3();
  private _rightWorldCache = new THREE.Vector3();

  constructor(app: SimulationApp) {
    this.app = app;
  }

  update(deltaTime: number, currentTime: number): void {
    // Throttling pour lignes coûteuses
    this._frameCount++;
    if (this._frameCount % this._linesUpdateInterval === 0) {
      this.updateLines();
    }

    // Mise à jour visuelle barre (lightweight)
    this.updateControlBarVisual();

    // Mise à jour UI avec throttling
    if (this.app.simulationUI && (this._frameCount % 5 === 0)) { // UI update toutes les 5 frames
      this.updateUI(currentTime);
    }

    // Performance tracking ultra-minimal
    this.trackCriticalPerformance();
  }

  private updateControlBarVisual(): void {
    const controlBarManager = this.app.physicsEngine.getControlBarManager();
    const rotation = controlBarManager.getRotation();
    this.app.controlBar.rotation.y = rotation;
  }

  private updateUI(currentTime: number): void {
    const fps = Math.round(1000 / (currentTime - this.app._lastFpsTime || 20));

    // Altitude optimisée avec cache
    const nezLocal = this.app.kite.getPoint("NEZ");
    let altitude = 0;
    if (nezLocal) {
      this._tempVector.copy(nezLocal)
        .applyQuaternion(this.app.kite.quaternion)
        .add(this.app.kite.position);
      altitude = this._tempVector.y;
    }

    this.app.simulationUI.updateRealTimeValues({
      fps,
      windSpeed: this.app.physicsEngine.getWindSimulator().getParams().speed,
      altitude: altitude,
    });
    this.app._lastFpsTime = currentTime;
  }

  private trackCriticalPerformance(): void {
    const physicsTime = performance.now() - this.app._physicsStart;
    const renderTime = performance.now() - this.app._renderStart;

    // Seuls les cas vraiment critiques
    if (physicsTime > 50 || renderTime > 100) {
      logger.error(
        `Performance critique: Physique ${physicsTime.toFixed(1)}ms | Rendu ${renderTime.toFixed(1)}ms`
      );
    }
  }

  private updateLines(): void {
    if (!this.app.leftLine || !this.app.rightLine) return;

    const controlBarManager = this.app.physicsEngine.getControlBarManager();
    const lineSystem = this.app.physicsEngine.getLineSystem();
    const handles = controlBarManager.getHandlePositions(this.app.kite.position);

    // Points d'attache sur le kite
    const leftAttach = this.app.kite.getPoint("CTRL_GAUCHE");
    const rightAttach = this.app.kite.getPoint("CTRL_DROIT");

    if (leftAttach && rightAttach) {
      // ✅ Réutiliser les vecteurs cache (ZÉRO allocation)
      this._leftWorldCache.copy(leftAttach)
        .applyQuaternion(this.app.kite.quaternion)
        .add(this.app.kite.position);

      this._rightWorldCache.copy(rightAttach)
        .applyQuaternion(this.app.kite.quaternion)
        .add(this.app.kite.position);

      // Calcul des caténaires avec cache
      const leftPoints = lineSystem.calculateCatenary(this._leftWorldCache, handles.left);
      const rightPoints = lineSystem.calculateCatenary(this._rightWorldCache, handles.right);

      // Optimisation: Réutiliser les BufferAttribute existants
      this.updateLineGeometry(this.app.leftLine, leftPoints);
      this.updateLineGeometry(this.app.rightLine, rightPoints);
    }
  }

  private updateLineGeometry(line: THREE.Line, points: THREE.Vector3[]): void {
    const geometry = line.geometry as THREE.BufferGeometry;
    let positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute;

    // Créer l'attribut seulement si nécessaire
    if (!positionAttr || positionAttr.count !== points.length) {
      positionAttr = new THREE.BufferAttribute(
        new Float32Array(points.length * 3),
        3
      );
      geometry.setAttribute("position", positionAttr);
    }

    // Mise à jour directe des données
    const array = positionAttr.array as Float32Array;
    points.forEach((point, i) => {
      const idx = i * 3;
      array[idx] = point.x;
      array[idx + 1] = point.y;
      array[idx + 2] = point.z;
    });

    positionAttr.needsUpdate = true;
  }
}