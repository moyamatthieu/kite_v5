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
  private triangleArrows: THREE.ArrowHelper[] = []; // Nouvelles flèches par triangle
  private forceHistory: Array<{
    time: number;
    lift: number;
    drag: number;
    tension: number;
  }> = []; // Historique des forces

  // 🌟 OPTIMISATION PERFORMANCE : Fréquence adaptative pour debug
  private lastDebugUpdate: number = 0;
  private debugUpdateInterval: number = 200; // ms entre mises à jour debug (5 FPS max pour économiser CPU)

  constructor(app: SimulationApp) {
    this.app = app;
  }

  updateDebugInfo(): void {
    if (!this.app.debugMode) return;

    const currentTime = performance.now();

    // 🌟 OPTIMISATION PERFORMANCE : Limiter fréquence des mises à jour debug
    if (currentTime - this.lastDebugUpdate < this.debugUpdateInterval) {
      return; // Skip cette frame pour performance
    }
    this.lastDebugUpdate = currentTime;

    // 🔥 CRITIQUE : Nettoyer les anciennes flèches AVANT d'en créer de nouvelles
    this.clearDebugArrows();

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
      this.updateTriangleArrows(); // Nouvelles flèches par triangle
    }

    // Stocker l'historique des forces pour le graphique
    this.updateForceHistory(lift, drag);
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

  /**
   * Met à jour les flèches de debug par triangle
   */
  private updateTriangleArrows(): void {
    // Nettoyer les anciennes flèches
    this.triangleArrows.forEach((arrow) => {
      this.app.renderManager.removeObject(arrow);
    });
    this.triangleArrows = [];

    // Obtenir les surfaces du kite
    const kite = this.app.kite;
    const kiteState = this.app.physicsEngine.getKiteControllers()[0].getState();
    const windSimulator = this.app.physicsEngine.getWindSimulator();
    const wind = windSimulator.getWindAt(kite.position);
    const relativeWind = wind.clone().sub(kiteState.velocity);

    if (relativeWind.length() < 0.1) return;

    // Calculer les forces par triangle (copié d'AerodynamicsCalculator)
    const surfaces: Array<{ vertices: THREE.Vector3[]; area: number }> =
      this.getKiteTriangles();
    const dynamicPressure = 0.5 * 1.225 * relativeWind.lengthSq(); // ρ/2 * v²

    surfaces.forEach((surface, index) => {
      // Normale du triangle en coordonnées monde
      const edge1 = surface.vertices[1].clone().sub(surface.vertices[0]);
      const edge2 = surface.vertices[2].clone().sub(surface.vertices[0]);
      const normalLocale = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize();
      const normaleMonde = normalLocale
        .clone()
        .applyQuaternion(kite.quaternion);

      // Angle d'incidence
      const cosIncidence = Math.abs(
        relativeWind.clone().normalize().dot(normaleMonde)
      );
      if (cosIncidence <= 0.01) return;

      // Force sur ce triangle
      const forceMagnitude = dynamicPressure * surface.area * cosIncidence;
      const facing = relativeWind.dot(normaleMonde);
      const normalDir =
        facing >= 0 ? normaleMonde.clone() : normaleMonde.clone().negate();
      const force = normalDir.multiplyScalar(forceMagnitude);

      // Centre du triangle en coordonnées monde
      const centre = surface.vertices[0]
        .clone()
        .add(surface.vertices[1])
        .add(surface.vertices[2])
        .divideScalar(3)
        .applyQuaternion(kite.quaternion)
        .add(kite.position);

      // Créer la flèche de force pour ce triangle
      if (force.length() > 0.1) {
        const forceScale = Math.sqrt(force.length()) * 0.1; // Échelle visuelle
        const arrow = new THREE.ArrowHelper(
          force.clone().normalize(),
          centre,
          forceScale,
          0xff6600, // Orange pour distinguer des autres flèches
          0.1,
          0.1
        );
        this.app.renderManager.addObject(arrow);
        this.triangleArrows.push(arrow);
      }
    });
  }

  /**
   * Obtient les triangles du kite pour les calculs aérodynamiques
   */
  private getKiteTriangles(): Array<{
    vertices: THREE.Vector3[];
    area: number;
  }> {
    const surfaces = [];

    // Définir les 4 panneaux triangulaires du kite (comme dans buildSurfaces)
    const panels = [
      ["NEZ", "BORD_GAUCHE", "WHISKER_GAUCHE"],
      ["NEZ", "WHISKER_GAUCHE", "SPINE_BAS"],
      ["NEZ", "BORD_DROIT", "WHISKER_DROIT"],
      ["NEZ", "WHISKER_DROIT", "SPINE_BAS"],
    ];

    panels.forEach((panel) => {
      const vertices = panel.map((pointName) => {
        const point = this.app.kite.getPoint(pointName);
        return point ? new THREE.Vector3(...point) : new THREE.Vector3();
      });

      if (vertices.length === 3) {
        // Calculer l'aire du triangle
        const edge1 = vertices[1].clone().sub(vertices[0]);
        const edge2 = vertices[2].clone().sub(vertices[0]);
        const area = edge1.cross(edge2).length() * 0.5;

        surfaces.push({ vertices, area });
      }
    });

    return surfaces;
  }

  /**
   * Met à jour l'historique des forces pour le graphique
   */
  private updateForceHistory(lift: THREE.Vector3, drag: THREE.Vector3): void {
    const currentTime = performance.now();

    // Calculer la tension des lignes
    const pilotPosition = new THREE.Vector3(...CONFIG.controlBar.position);
    const controlBarManager = this.app.physicsEngine.getControlBarManager();
    const lineSystem = this.app.physicsEngine.getLineSystem();
    const tensions = lineSystem.calculateLineTensions(
      this.app.kite,
      controlBarManager.getRotation(),
      pilotPosition
    );
    const avgTension =
      (tensions.leftForce.length() + tensions.rightForce.length()) / 2;

    // Ajouter le nouveau point
    this.forceHistory.push({
      time: currentTime,
      lift: lift.length(),
      drag: drag.length(),
      tension: avgTension,
    });

    // Garder seulement les 100 derniers points (environ 1.6 secondes à 60 FPS)
    if (this.forceHistory.length > 100) {
      this.forceHistory.shift();
    }
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
      <div class="debug-section">
        <h4>📊 Graphique Forces</h4>
        <canvas id="force-chart" width="250" height="120" style="background: rgba(0,0,0,0.3); border-radius: 5px;"></canvas>
      </div>
    `;

    debugInfo.innerHTML = infoHTML;

    // Dessiner le graphique après avoir mis à jour le DOM
    requestAnimationFrame(() => this.drawForceChart());
  }

  /**
   * Dessine le graphique des forces en temps réel
   */
  private drawForceChart(): void {
    const canvas = document.getElementById("force-chart") as HTMLCanvasElement;
    if (!canvas || this.forceHistory.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Nettoyer le canvas
    ctx.clearRect(0, 0, width, height);

    // Trouver les valeurs min/max pour l'échelle
    let maxForce = 0;
    this.forceHistory.forEach((point) => {
      maxForce = Math.max(maxForce, point.lift, point.drag, point.tension);
    });

    if (maxForce === 0) return;

    // Dessiner les axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;

    // Axe X (temps)
    ctx.beginPath();
    ctx.moveTo(20, height - 20);
    ctx.lineTo(width - 10, height - 20);
    ctx.stroke();

    // Axe Y (forces)
    ctx.beginPath();
    ctx.moveTo(20, 10);
    ctx.lineTo(20, height - 20);
    ctx.stroke();

    // Dessiner les courbes
    const drawCurve = (
      getValue: (point: any) => number,
      color: string,
      label: string
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      this.forceHistory.forEach((point, index) => {
        const x = 20 + ((width - 30) * index) / (this.forceHistory.length - 1);
        const y = height - 20 - ((height - 30) * getValue(point)) / maxForce;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    };

    // Courbes des forces
    drawCurve((p) => p.lift, "#0088ff", "Portance"); // Bleu
    drawCurve((p) => p.drag, "#ff0000", "Traînée"); // Rouge
    drawCurve((p) => p.tension, "#00ff00", "Tension"); // Vert

    // Légende
    ctx.font = "10px Arial";
    ctx.fillStyle = "#0088ff";
    ctx.fillText("Portance", width - 80, 15);
    ctx.fillStyle = "#ff0000";
    ctx.fillText("Traînée", width - 80, 27);
    ctx.fillStyle = "#00ff00";
    ctx.fillText("Tension", width - 80, 39);

    // Échelle Y
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "9px Arial";
    ctx.fillText("0", 2, height - 15);
    ctx.fillText(maxForce.toFixed(0) + "N", 2, 15);
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

    // Nettoyer les flèches des triangles
    this.triangleArrows.forEach((arrow) => {
      this.app.renderManager.removeObject(arrow);
    });
    this.triangleArrows = [];
  }

  // Méthodes publiques pour toggles (appelées depuis app)
  toggleDebugMode(): void {
    this.app.debugMode = !this.app.debugMode;

    // Contrôler la visibilité du panel debug via SimulationUI
    if (this.app.simulationUI) {
      this.app.simulationUI.toggleDebugPanel(this.app.debugMode);
    }

    // Supprimer les logs de toggle debug pour réduire le flood
  }

  toggleFullDebug(): void {
    this.app.debugMode = !this.app.debugMode;
    this.app.debugVisualsEnabled = !this.app.debugVisualsEnabled;

    // Contrôler la visibilité du panel debug via SimulationUI
    if (this.app.simulationUI) {
      this.app.simulationUI.toggleDebugPanel(this.app.debugMode);
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

      // Nettoyer aussi les flèches des triangles
      this.triangleArrows.forEach((arrow) => {
        this.app.renderManager.removeObject(arrow);
      });
      this.triangleArrows = [];
    }

    // Supprimer les logs de debug complet pour réduire le flood
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

      // Nettoyer les flèches des triangles
      this.triangleArrows.forEach((arrow) => {
        this.app.renderManager.removeObject(arrow);
      });
      this.triangleArrows = [];
    }

    // Supprimer les logs de vecteurs debug pour réduire le flood
  }
}
