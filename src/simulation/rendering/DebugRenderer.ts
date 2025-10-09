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
import { Primitive } from "@core/Primitive";

import { Kite } from "../../objects/Kite";
import { KiteState, SurfaceForce } from "../types";
import type { KiteController } from "../controllers/KiteController";
import type { ControlBarManager } from "../controllers/ControlBarManager";
import type { LineSystem } from "../physics/LineSystem";
import type { WindSimulator } from "../physics/WindSimulator";
import { AerodynamicsCalculator } from "../physics/AerodynamicsCalculator";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";
import { KiteGeometry } from "../config/KiteGeometry";

export interface DebugRenderTarget {
  addObject(object: THREE.Object3D): void;
  removeObject(object: THREE.Object3D): void;
  getScene(): THREE.Scene | null | undefined;
}

/**
 * Palette de couleurs améliorée pour les vecteurs de debug
 */
const DEBUG_COLORS = {
  // Vecteurs de mouvement
  velocity: 0x00ff00,        // Vert vif - Vitesse du kite
  apparentWind: 0x00ffff,    // Cyan - Vent apparent

  // Forces globales
  globalLift: 0x4169e1,      // Bleu royal - Portance globale
  globalResultant: 0xffffff, // Blanc - Résultante globale

  // Forces par surface
  surfaceLift: 0x00bfff,     // Bleu ciel profond - Portance locale
  surfaceDrag: 0xff4444,     // Rouge vif - Traînée
  surfaceFriction: 0xaaaaaa, // Gris moyen - Friction
  surfaceResultant: 0xffdd00,// Jaune vif - Résultante locale
  
  // Masse distribuée
  surfaceMass: 0xff00ff,     // Magenta - Force gravitationnelle par surface
  torque: 0xffa500,          // Orange - Couple aérodynamique
};

/**
 * Tailles des vecteurs pour meilleure lisibilité
 */
const VECTOR_SCALES = {
  velocity: 0.6,
  apparentWind: 0.5,
  globalLift: 0.25,
  globalResultant: 0.35,
  surfaceLift: 0.35,
  surfaceDrag: 0.35,
  surfaceFriction: 0.25,
  surfaceResultant: 0.45,
  surfaceMass: 3.0,  // Amplifier pour visibilité (gravité ~0.8N par surface)
  torque: 0.5,       // Échelle pour le couple
};

/**
 * Configuration des têtes de flèches pour un rendu plus fin et précis
 */
const ARROW_HEAD_CONFIG = {
  // Grandes flèches (vitesse, vent apparent, résultantes)
  large: {
    headLength: 0.15,  // Longueur de la tête de flèche
    headWidth: 0.12,   // Largeur de la tête de flèche
  },
  // Flèches moyennes (forces globales)
  medium: {
    headLength: 0.12,
    headWidth: 0.09,
  },
  // Petites flèches (forces par surface)
  small: {
    headLength: 0.10,
    headWidth: 0.07,
  },
  // Très petites flèches (friction)
  tiny: {
    headLength: 0.08,
    headWidth: 0.06,
  },
};

/**
 * Gestionnaire du rendu de debug
 *
 * Affiche les forces, vitesses et informations de debug
 */
/**
 * Configuration des vecteurs visibles
 */
interface VectorVisibility {
  velocity: boolean;
  apparentWind: boolean;
  globalForces: boolean;
  surfaceForces: boolean;
  surfaceMass: boolean;  // Afficher forces gravitationnelles distribuées
  torque: boolean; // Nouvelle option pour le couple
}

export class DebugRenderer {
  private renderTarget: DebugRenderTarget;
  private debugArrows: THREE.ArrowHelper[] = [];
  private debugMode: boolean;
  private vectorVisibility: VectorVisibility = {
    velocity: true,
    apparentWind: true,
    globalForces: true,
    surfaceForces: true,
    surfaceMass: false,  // Désactivé par défaut (peut surcharger l'affichage)
    torque: true, // Activé par défaut
  };

  constructor(renderTarget: DebugRenderTarget) {
    this.renderTarget = renderTarget;
    this.debugMode = CONFIG.debugVectors === true;
    this.setupDebugControls();
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

  /**
   * Configure le panneau de contrôle des vecteurs de debug
   */
  private setupDebugControls(): void {
    // Trouver ou créer le conteneur de contrôles
    let controlsContainer = document.getElementById("debug-vector-controls");

    if (!controlsContainer) {
      const debugPanel = document.getElementById("debug-panel");
      if (debugPanel) {
        controlsContainer = document.createElement("div");
        controlsContainer.id = "debug-vector-controls";
        controlsContainer.style.cssText = `
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(255,255,255,0.2);
        `;

        controlsContainer.innerHTML = `
          <strong style="display: block; margin-bottom: 10px;">🎨 Vecteurs visibles:</strong>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="toggle-velocity" checked style="margin-right: 8px; cursor: pointer;">
              <span style="color: #00ff00;">●</span> Vitesse kite
            </label>
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="toggle-apparent-wind" checked style="margin-right: 8px; cursor: pointer;">
              <span style="color: #00ffff;">●</span> Vent apparent
            </label>
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="toggle-global-forces" checked style="margin-right: 8px; cursor: pointer;">
              <span style="color: #4169e1;">●</span> Forces globales
            </label>
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="toggle-surface-forces" checked style="margin-right: 8px; cursor: pointer;">
              <span style="color: #ffdd00;">●</span> Forces surfaces
            </label>
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="toggle-surface-mass" style="margin-right: 8px; cursor: pointer;">
              <span style="color: #ff00ff;">●</span> Masse distribuée
            </label>
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="toggle-torque" checked style="margin-right: 8px; cursor: pointer;">
              <span style="color: #ffa500;">●</span> Couple aérodynamique
            </label>
          </div>
        `;

        debugPanel.appendChild(controlsContainer);

        // Ajouter les event listeners
        document.getElementById("toggle-velocity")?.addEventListener("change", (e) => {
          this.vectorVisibility.velocity = (e.target as HTMLInputElement).checked;
        });

        document.getElementById("toggle-apparent-wind")?.addEventListener("change", (e) => {
          this.vectorVisibility.apparentWind = (e.target as HTMLInputElement).checked;
        });

        document.getElementById("toggle-global-forces")?.addEventListener("change", (e) => {
          this.vectorVisibility.globalForces = (e.target as HTMLInputElement).checked;
        });

        document.getElementById("toggle-surface-forces")?.addEventListener("change", (e) => {
          this.vectorVisibility.surfaceForces = (e.target as HTMLInputElement).checked;
        });

        document.getElementById("toggle-surface-mass")?.addEventListener("change", (e) => {
          this.vectorVisibility.surfaceMass = (e.target as HTMLInputElement).checked;
        });

        document.getElementById("toggle-torque")?.addEventListener("change", (e) => {
          this.vectorVisibility.torque = (e.target as HTMLInputElement).checked;
        });
      }
    }
  }

  clearDebugArrows(): void {
    this.debugArrows.forEach((arrow) => {
      this.renderTarget.removeObject(arrow);
    });
    this.debugArrows = [];
  }

  updateDebugArrows(kite: Kite, physicsSource: DebugPhysicsSource): void {
    if (!this.debugMode) return;

    this.clearDebugArrows();

    const kiteState = physicsSource.getKiteController().getState();
    const kitePosition = kite.position.clone();

    // Calculer le centre géométrique entre NEZ et SPINE_BAS
    const centerLocal = new THREE.Vector3(0, 0.325, 0);
    const centerWorld = kite.toWorldCoordinates(centerLocal);

    // Vecteur de vitesse du kite (vert vif)
    if (this.vectorVisibility.velocity && kiteState.velocity.length() > CONFIG.debug.minVelocityDisplay) {
      const velocityArrow = Primitive.arrow(
        kiteState.velocity.clone().normalize(),
        centerWorld,
        kiteState.velocity.length() * VECTOR_SCALES.velocity,
        DEBUG_COLORS.velocity,
        ARROW_HEAD_CONFIG.large.headLength,
        ARROW_HEAD_CONFIG.large.headWidth
      );
        this.renderTarget.addObject(velocityArrow);
      this.debugArrows.push(velocityArrow);
    }

    const windSim = physicsSource.getWindSimulator();
    const wind = windSim.getWindAt(kitePosition);
    const relativeWind = wind.clone().sub(kiteState.velocity);

    // Vecteur de vent apparent (cyan)
    if (this.vectorVisibility.apparentWind && relativeWind.length() > CONFIG.debug.minVelocityDisplay) {
      const apparentWindArrow = Primitive.arrow(
        relativeWind.clone().normalize(),
        centerWorld,
        relativeWind.length() * VECTOR_SCALES.apparentWind,
        DEBUG_COLORS.apparentWind,
        ARROW_HEAD_CONFIG.large.headLength,
        ARROW_HEAD_CONFIG.large.headWidth
      );
        this.renderTarget.addObject(apparentWindArrow);
      this.debugArrows.push(apparentWindArrow);
    }

    if (relativeWind.length() > CONFIG.debug.minVelocityDisplay) {
      const { lift, drag, surfaceForces } = AerodynamicsCalculator.calculateForces(
        relativeWind,
        kite.quaternion,
        kite.position,
        kiteState.velocity,
        kiteState.angularVelocity
      );

      // Forces globales (si activé)
      if (this.vectorVisibility.globalForces) {
        // Portance globale (bleu royal)
        if (lift.length() > CONFIG.debug.minVectorLength) {
          const liftArrow = Primitive.arrow(
            lift.clone().normalize(),
            centerWorld,
            Math.sqrt(lift.length()) * VECTOR_SCALES.globalLift,
            DEBUG_COLORS.globalLift,
            ARROW_HEAD_CONFIG.medium.headLength,
            ARROW_HEAD_CONFIG.medium.headWidth
          );
            this.renderTarget.addObject(liftArrow);
          this.debugArrows.push(liftArrow);
        }

        // Résultante globale (blanc) - somme de toutes les surfaces
        const globalResultant = surfaceForces.reduce((sum, sf) => sum.add(sf.resultant.clone()), new THREE.Vector3());
        if (globalResultant.length() > CONFIG.debug.minVectorLength) {
          const resultantArrow = Primitive.arrow(
            globalResultant.clone().normalize(),
            centerWorld,
            Math.sqrt(globalResultant.length()) * VECTOR_SCALES.globalResultant,
            DEBUG_COLORS.globalResultant,
            ARROW_HEAD_CONFIG.large.headLength,
            ARROW_HEAD_CONFIG.large.headWidth
          );
            this.renderTarget.addObject(resultantArrow);
          this.debugArrows.push(resultantArrow);
        }
      }

      // Afficher les forces par surface (si activé)
      if (this.vectorVisibility.surfaceForces) {
        this.displaySurfaceForces(surfaceForces);
      }

      // Afficher les vecteurs de masse distribuée (si activé)
      if (this.vectorVisibility.surfaceMass) {
        this.displaySurfaceMass(kite);
      }

      // Afficher le couple aérodynamique (si activé)
      if (this.vectorVisibility.torque) {
        const { torque } = AerodynamicsCalculator.calculateForces(
          relativeWind,
          kite.quaternion,
          kite.position,
          kiteState.velocity,
          kiteState.angularVelocity
        );
        if (torque.length() > CONFIG.debug.minVectorLength) {
          const torqueArrow = Primitive.arrow(
            torque.clone().normalize(),
            centerWorld,
            Math.sqrt(torque.length()) * VECTOR_SCALES.torque,
            DEBUG_COLORS.torque,
            ARROW_HEAD_CONFIG.medium.headLength,
            ARROW_HEAD_CONFIG.medium.headWidth
          );
            this.renderTarget.addObject(torqueArrow);
          this.debugArrows.push(torqueArrow);
        }
      }

      this.updateDebugDisplay(kiteState, kitePosition, { lift, drag }, physicsSource);
    }
  }

  private updateDebugDisplay(
    kiteState: KiteState,
    kitePosition: THREE.Vector3,
    forces: { lift: THREE.Vector3; drag: THREE.Vector3 },
    physicsSource: DebugPhysicsSource
  ): void {
    const debugInfo = document.getElementById("debug-info");
    if (!debugInfo || !this.debugMode) return;

    const { lift, drag } = forces;

    // Calcul des tensions des lignes
    const lineLength = physicsSource.getLineSystem().lineLength;
    const handles = physicsSource
      .getControlBarManager()
      .getHandlePositions(kitePosition);

    const kite = physicsSource.getKiteController().getKite();
    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");

    let tensionInfo = "N/A";
    if (ctrlLeft && ctrlRight) {
      const kiteLeftWorld = kite.toWorldCoordinates(ctrlLeft);
      const kiteRightWorld = kite.toWorldCoordinates(ctrlRight);

      const distL = kiteLeftWorld.distanceTo(handles.left);
      const distR = kiteRightWorld.distanceTo(handles.right);
      const tautL = distL >= lineLength - PhysicsConstants.LINE_CONSTRAINT_TOLERANCE;
      const tautR = distR >= lineLength - PhysicsConstants.LINE_CONSTRAINT_TOLERANCE;

      tensionInfo = `L:${tautL ? "TENDU" : "RELÂCHÉ"}(${distL.toFixed(2)}m) R:${
        tautR ? "TENDU" : "RELÂCHÉ"
      }(${distR.toFixed(2)}m)`;
    }

    const windState = physicsSource.getWindSimulator().getParams();

    // Assemblage des informations de debug
    const totalForce = Math.sqrt(lift.lengthSq() + drag.lengthSq());

    debugInfo.innerHTML = `
            <strong>🪁 Position Cerf-volant:</strong><br>
            X: ${kitePosition.x.toFixed(2)}m, Y: ${kitePosition.y.toFixed(
      2
    )}m, Z: ${kitePosition.z.toFixed(2)}m<br><br>

            <strong>💨 Vent:</strong><br>
            Vitesse: ${windState.speed.toFixed(1)} km/h<br>
            Direction: ${windState.direction.toFixed(0)}°<br>
            Turbulence: ${windState.turbulence.toFixed(1)}%<br><br>

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
  private displaySurfaceForces(surfaceForces: SurfaceForce[]): void {
    const colorPalette = [
      0xff6b6b, // Rouge - Surface 0 (haute gauche)
      0x51cf66, // Vert - Surface 1 (basse gauche) 
      0x667eea, // Bleu - Surface 2 (haute droite)
      0xff9f43, // Orange - Surface 3 (basse droite)
    ];

    surfaceForces.forEach((surfaceForce) => {
      const { lift, drag, friction, resultant, center, surfaceIndex: _surfaceIndex } = surfaceForce;
  const centerWorld = center.clone();

      // Portance locale (bleu ciel profond)
      if (lift.length() > CONFIG.debug.minVectorLength) {
        const liftArrow = Primitive.arrow(
          lift.clone().normalize(),
          centerWorld,
          Math.sqrt(lift.length()) * VECTOR_SCALES.surfaceLift,
          DEBUG_COLORS.surfaceLift,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
          this.renderTarget.addObject(liftArrow);
        this.debugArrows.push(liftArrow);
      }

      // Traînée (rouge vif)
      if (drag.length() > CONFIG.debug.minVectorLength) {
        const dragArrow = Primitive.arrow(
          drag.clone().normalize(),
          centerWorld,
          Math.sqrt(drag.length()) * VECTOR_SCALES.surfaceDrag,
          DEBUG_COLORS.surfaceDrag,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
          this.renderTarget.addObject(dragArrow);
        this.debugArrows.push(dragArrow);
      }

      // Friction (gris moyen)
      if (friction && friction.length() > CONFIG.debug.minVectorLength) {
        const frictionArrow = Primitive.arrow(
          friction.clone().normalize(),
          centerWorld,
          Math.sqrt(friction.length()) * VECTOR_SCALES.surfaceFriction,
          DEBUG_COLORS.surfaceFriction,
          ARROW_HEAD_CONFIG.tiny.headLength,
          ARROW_HEAD_CONFIG.tiny.headWidth
        );
          this.renderTarget.addObject(frictionArrow);
        this.debugArrows.push(frictionArrow);
      }

      // Résultante locale (jaune vif)
      if (resultant.length() > CONFIG.debug.minVectorLength) {
        const resultantArrow = Primitive.arrow(
          resultant.clone().normalize(),
          centerWorld,
          Math.sqrt(resultant.length()) * VECTOR_SCALES.surfaceResultant,
          DEBUG_COLORS.surfaceResultant,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
          this.renderTarget.addObject(resultantArrow);
        this.debugArrows.push(resultantArrow);
      }
    });
  }

  /**
   * Affiche les vecteurs de force gravitationnelle pour chaque surface
   * Visualise la masse distribuée (physique émergente)
   */
  private displaySurfaceMass(kite: Kite): void {
    // Pour chaque surface avec sa masse
    KiteGeometry.SURFACES_WITH_MASS.forEach((surface: any, surfaceIndex: number) => {
      // Centre géométrique de la surface (coordonnées locales)
      const centre = KiteGeometry.calculateTriangleCentroid(
        surface.vertices[0],
        surface.vertices[1], 
        surface.vertices[2]
      );

      // Transformer en coordonnées monde
      const centerWorld = kite.toWorldCoordinates(centre);

      // Force gravitationnelle = m × g (vers le bas)
      const gravityForce = new THREE.Vector3(0, -surface.mass * CONFIG.physics.gravity, 0);
      const forceMagnitude = gravityForce.length();

      // Afficher flèche magenta pointant vers le bas
      if (forceMagnitude > CONFIG.debug.minVectorLength) {
        const gravityArrow = Primitive.arrow(
          gravityForce.clone().normalize(),
          centerWorld,
          forceMagnitude * VECTOR_SCALES.surfaceMass,
          DEBUG_COLORS.surfaceMass,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
          this.renderTarget.addObject(gravityArrow);
        this.debugArrows.push(gravityArrow);

        // Optionnel : Ajouter une sphère pour montrer la masse
        // Taille proportionnelle à la masse
        const sphereRadius = surface.mass * 0.2; // 0.2m pour 1kg
        const massIndicator = new THREE.Mesh(
          new THREE.SphereGeometry(sphereRadius, 8, 8),
          new THREE.MeshBasicMaterial({
            color: DEBUG_COLORS.surfaceMass,
            transparent: true,
            opacity: 0.3,
            wireframe: true
          })
        );
        massIndicator.position.copy(centerWorld);
          this.renderTarget.addObject(massIndicator);
        this.debugArrows.push(massIndicator as any); // Pour cleanup
      }
    });
  }
}

/**
 * Interface pour la source de données physiques de debug
 *
 * Fournit les méthodes nécessaires pour accéder aux contrôleurs et simulateurs
 */
export interface DebugPhysicsSource {
  getKiteController(): KiteController;
  getWindSimulator(): WindSimulator;
  getLineSystem(): LineSystem;
  getControlBarManager(): ControlBarManager;
}

