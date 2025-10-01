/**
 * DebugRenderer.ts - Gestionnaire du rendu de debug pour la simulation Kite
 *
 * Rôle :
 *   - Affiche visuellement les forces physiques (portance, traînée, friction, résultante) et la vitesse du cerf-volant
 *   - Met à jour le panneau d'informations de debug (HTML)
 *   - Permet d'activer/désactiver le mode debug et de gérer l'affichage des vecteurs
 *
 * Dépendances principales :
 *   - RenderManager.ts : Ajoute/retire les objets de debug à la scène Three.js
 *   - PhysicsEngine.ts : Récupère l'état physique du cerf-volant et les forces calculées
 *   - AerodynamicsCalculator.ts : Calcule les forces aérodynamiques sur chaque surface du kite
 *   - Kite.ts : Accès à la géométrie et aux points anatomiques du cerf-volant
 *   - PhysicsConstants.ts, SimulationConfig.ts : Paramètres physiques et configuration
 *   - Types : Utilise SurfaceForce, KiteState pour typer les données physiques
 *
 * Relation avec les fichiers adjacents :
 *   - RenderManager.ts : Fichier adjacent direct, gère la scène 3D et l'environnement visuel. DebugRenderer utilise RenderManager pour afficher les flèches de debug.
 *   - Les autres fichiers du dossier 'rendering' sont absents, la relation est donc principalement avec RenderManager.
 *
 * Utilisation typique :
 *   - Instancié dans la boucle de simulation pour afficher les vecteurs de forces et la vitesse du kite
 *   - Interagit avec le DOM pour afficher les infos de debug
 *
 * Voir aussi :
 *   - src/simulation/physics/PhysicsEngine.ts
 *   - src/simulation/physics/AerodynamicsCalculator.ts
 *   - src/objects/organic/Kite.ts
 *   - src/simulation/rendering/RenderManager.ts
 */
import * as THREE from "three";
import { Kite } from "../../objects/organic/Kite";
import { KiteState, SurfaceForce } from "../types";
import { PhysicsEngine } from "../physics/PhysicsEngine";
import { AerodynamicsCalculator } from "../physics/AerodynamicsCalculator";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { RenderManager } from "./RenderManager";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Gestionnaire du rendu de debug
 *
 * Affiche les forces, vitesses et informations de debug
 */
export class DebugRenderer {
  private renderManager: RenderManager;
  private debugArrows: THREE.ArrowHelper[] = [];
  private debugMode: boolean;

  constructor(renderManager: RenderManager) {
    this.renderManager = renderManager;
    this.debugMode = CONFIG.debugVectors === true;
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;

    const debugBtn = document.getElementById("debug-physics");
    const debugPanel = document.getElementById("debug-panel");

    if (debugBtn) {
      debugBtn.textContent = this.debugMode ? "🔍 Debug ON" : "🔍 Debug OFF";
      debugBtn.classList.toggle("active", this.debugMode);
    }

    if (debugPanel) {
      debugPanel.style.display = this.debugMode ? "block" : "none";
    }

    document.body.classList.toggle("debug-mode", this.debugMode);

    if (!this.debugMode) {
      this.clearDebugArrows();
    }
  }

  toggleDebugMode(): void {
    this.setDebugMode(!this.debugMode);
  }

  clearDebugArrows(): void {
    this.debugArrows.forEach((arrow) => {
      this.renderManager.removeObject(arrow);
    });
    this.debugArrows = [];
  }

  updateDebugArrows(kite: Kite, physicsEngine: PhysicsEngine): void {
    if (!this.debugMode) return;

    this.clearDebugArrows();

    const kiteState = physicsEngine.getKiteController().getState();
    const kitePosition = kite.position.clone();

    // Calculer le centre géométrique entre NEZ et SPINE_BAS
    const centerLocal = new THREE.Vector3(0, 0.325, 0);
    const centerWorld = kite.localToWorld(centerLocal.clone());

    if (kiteState.velocity.length() > 0.1) {
      const velocityArrow = new THREE.ArrowHelper(
        kiteState.velocity.clone().normalize(),
        centerWorld,
        kiteState.velocity.length() * 0.5,
        0x00ff00,
        undefined,
        0.3
      );
      this.renderManager.addObject(velocityArrow);
      this.debugArrows.push(velocityArrow);
    }

    const windSim = physicsEngine.getWindSimulator();
    const wind = windSim.getWindAt(kitePosition);
    const relativeWind = wind.clone().sub(kiteState.velocity);

    if (relativeWind.length() > 0.1) {
      const { lift, drag, surfaceForces } = AerodynamicsCalculator.calculateForces(
        relativeWind,
        kite.quaternion
      );

      // Afficher les forces globales (optionnel)
      if (lift.length() > 0.01) {
        const liftArrow = new THREE.ArrowHelper(
          lift.clone().normalize(),
          centerWorld,
          Math.sqrt(lift.length()) * 0.2, // Réduit pour ne pas interférer
          0x0088ff,
          undefined,
          0.2
        );
        this.renderManager.addObject(liftArrow);
        this.debugArrows.push(liftArrow);
      }

      // Afficher les forces par surface
      this.displaySurfaceForces(surfaceForces, kite);

      // Calculer la résultante globale (somme de toutes les surfaces)
      const globalResultant = surfaceForces.reduce((sum, sf) => sum.add(sf.resultant.clone()), new THREE.Vector3());
      if (globalResultant.length() > 0.01) {
        const resultantArrow = new THREE.ArrowHelper(
          globalResultant.clone().normalize(),
          centerWorld,
          Math.sqrt(globalResultant.length()) * 0.3,
          0xffffff,
          undefined,
          0.28
        );
        this.renderManager.addObject(resultantArrow);
        this.debugArrows.push(resultantArrow);
      }

      this.updateDebugDisplay(kiteState, kitePosition, { lift, drag }, physicsEngine);
    }
  }

  private updateDebugDisplay(
    kiteState: KiteState,
    kitePosition: THREE.Vector3,
    forces: { lift: THREE.Vector3; drag: THREE.Vector3 },
    physicsEngine: PhysicsEngine
  ): void {
    const debugInfo = document.getElementById("debug-info");
    if (!debugInfo || !this.debugMode) return;

    const { lift, drag } = forces;

    // Calcul des tensions des lignes
    const lineLength = physicsEngine.getLineSystem().lineLength;
    const handles = physicsEngine
      .getControlBarManager()
      .getHandlePositions(kitePosition);

    const kite = physicsEngine.getKiteController().getKite();
    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");

    let tensionInfo = "N/A";
    if (ctrlLeft && ctrlRight) {
      const kiteLeftWorld = ctrlLeft.clone();
      const kiteRightWorld = ctrlRight.clone();
      kite.localToWorld(kiteLeftWorld);
      kite.localToWorld(kiteRightWorld);

      const distL = kiteLeftWorld.distanceTo(handles.left);
      const distR = kiteRightWorld.distanceTo(handles.right);
      const tautL = distL >= lineLength - PhysicsConstants.CONTROL_DEADZONE;
      const tautR = distR >= lineLength - PhysicsConstants.CONTROL_DEADZONE;

      tensionInfo = `L:${tautL ? "TENDU" : "RELÂCHÉ"}(${distL.toFixed(2)}m) R:${
        tautR ? "TENDU" : "RELÂCHÉ"
      }(${distR.toFixed(2)}m)`;
    }

    // Informations du vent
    const windParams = physicsEngine.getWindSimulator().getParams();

    // Assemblage des informations de debug
    const totalForce = Math.sqrt(lift.lengthSq() + drag.lengthSq());

    debugInfo.innerHTML = `
            <strong>🪁 Position Cerf-volant:</strong><br>
            X: ${kitePosition.x.toFixed(2)}m, Y: ${kitePosition.y.toFixed(
      2
    )}m, Z: ${kitePosition.z.toFixed(2)}m<br><br>

            <strong>💨 Vent:</strong><br>
            Vitesse: ${windParams.speed.toFixed(1)} km/h<br>
            Direction: ${windParams.direction.toFixed(0)}°<br>
            Turbulence: ${windParams.turbulence.toFixed(1)}%<br><br>

            <strong>⚡ Forces Aérodynamiques:</strong><br>
            Portance: ${lift.length().toFixed(3)} N<br>
            Traînée: ${drag.length().toFixed(3)} N<br>
            Force Totale: ${totalForce.toFixed(3)} N<br><br>

            <strong>🔗 Tensions Lignes:</strong><br>
            ${tensionInfo}<br><br>

            <strong>🏃 Vitesse Cerf-volant:</strong><br>
            ${kiteState.velocity.length().toFixed(2)} m/s<br><br>

            <strong>⚙️ Performance:</strong><br>
            Statut: <span style="color: #00ff88;">STABLE</span>
        `;
  }

  /**
   * Affiche une flèche de force pour chaque surface du kite
   */
  private displaySurfaceForces(surfaceForces: SurfaceForce[], kite: Kite): void {
    const colorPalette = [
      0xff6b6b, // Rouge - Surface 0 (haute gauche)
      0x51cf66, // Vert - Surface 1 (basse gauche) 
      0x667eea, // Bleu - Surface 2 (haute droite)
      0xff9f43, // Orange - Surface 3 (basse droite)
    ];

    surfaceForces.forEach((surfaceForce) => {
      const { lift, drag, friction, resultant, center, surfaceIndex } = surfaceForce;
      const centerWorld = center.clone();
      kite.localToWorld(centerWorld);

      // Lift (bleu clair)
      if (lift.length() > 0.01) {
        const liftArrow = new THREE.ArrowHelper(
          lift.clone().normalize(),
          centerWorld,
          Math.sqrt(lift.length()) * 0.3,
          0x00cfff,
          undefined,
          0.25
        );
        this.renderManager.addObject(liftArrow);
        this.debugArrows.push(liftArrow);
      }

      // Drag (rouge foncé)
      if (drag.length() > 0.01) {
        const dragArrow = new THREE.ArrowHelper(
          drag.clone().normalize(),
          centerWorld,
          Math.sqrt(drag.length()) * 0.3,
          0xff2222,
          undefined,
          0.25
        );
        this.renderManager.addObject(dragArrow);
        this.debugArrows.push(dragArrow);
      }

      // Friction (gris, si non nul)
      if (friction && friction.length() > 0.01) {
        const frictionArrow = new THREE.ArrowHelper(
          friction.clone().normalize(),
          centerWorld,
          Math.sqrt(friction.length()) * 0.2,
          0x888888,
          undefined,
          0.18
        );
        this.renderManager.addObject(frictionArrow);
        this.debugArrows.push(frictionArrow);
      }

      // Résultante (blanc)
      if (resultant.length() > 0.01) {
        const resultantArrow = new THREE.ArrowHelper(
          resultant.clone().normalize(),
          centerWorld,
          Math.sqrt(resultant.length()) * 0.4,
          0xffffff,
          undefined,
          0.35
        );
        this.renderManager.addObject(resultantArrow);
        this.debugArrows.push(resultantArrow);
      }
    });
  }
}