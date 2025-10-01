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
}

export class DebugRenderer {
  private renderManager: RenderManager;
  private debugArrows: THREE.ArrowHelper[] = [];
  private debugMode: boolean;
  private vectorVisibility: VectorVisibility = {
    velocity: true,
    apparentWind: true,
    globalForces: true,
    surfaceForces: true,
  };

  constructor(renderManager: RenderManager) {
    this.renderManager = renderManager;
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
      }
    }
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

    // Vecteur de vitesse du kite (vert vif)
    if (this.vectorVisibility.velocity && kiteState.velocity.length() > 0.1) {
      const velocityArrow = new THREE.ArrowHelper(
        kiteState.velocity.clone().normalize(),
        centerWorld,
        kiteState.velocity.length() * VECTOR_SCALES.velocity,
        DEBUG_COLORS.velocity,
        ARROW_HEAD_CONFIG.large.headLength,
        ARROW_HEAD_CONFIG.large.headWidth
      );
      this.renderManager.addObject(velocityArrow);
      this.debugArrows.push(velocityArrow);
    }

    const windSim = physicsEngine.getWindSimulator();
    const wind = windSim.getWindAt(kitePosition);
    const relativeWind = wind.clone().sub(kiteState.velocity);

    // Vecteur de vent apparent (cyan)
    if (this.vectorVisibility.apparentWind && relativeWind.length() > 0.1) {
      const apparentWindArrow = new THREE.ArrowHelper(
        relativeWind.clone().normalize(),
        centerWorld,
        relativeWind.length() * VECTOR_SCALES.apparentWind,
        DEBUG_COLORS.apparentWind,
        ARROW_HEAD_CONFIG.large.headLength,
        ARROW_HEAD_CONFIG.large.headWidth
      );
      this.renderManager.addObject(apparentWindArrow);
      this.debugArrows.push(apparentWindArrow);
    }

    if (relativeWind.length() > 0.1) {
      const { lift, drag, surfaceForces } = AerodynamicsCalculator.calculateForces(
        relativeWind,
        kite.quaternion
      );

      // Forces globales (si activé)
      if (this.vectorVisibility.globalForces) {
        // Portance globale (bleu royal)
        if (lift.length() > 0.01) {
          const liftArrow = new THREE.ArrowHelper(
            lift.clone().normalize(),
            centerWorld,
            Math.sqrt(lift.length()) * VECTOR_SCALES.globalLift,
            DEBUG_COLORS.globalLift,
            ARROW_HEAD_CONFIG.medium.headLength,
            ARROW_HEAD_CONFIG.medium.headWidth
          );
          this.renderManager.addObject(liftArrow);
          this.debugArrows.push(liftArrow);
        }

        // Résultante globale (blanc) - somme de toutes les surfaces
        const globalResultant = surfaceForces.reduce((sum, sf) => sum.add(sf.resultant.clone()), new THREE.Vector3());
        if (globalResultant.length() > 0.01) {
          const resultantArrow = new THREE.ArrowHelper(
            globalResultant.clone().normalize(),
            centerWorld,
            Math.sqrt(globalResultant.length()) * VECTOR_SCALES.globalResultant,
            DEBUG_COLORS.globalResultant,
            ARROW_HEAD_CONFIG.large.headLength,
            ARROW_HEAD_CONFIG.large.headWidth
          );
          this.renderManager.addObject(resultantArrow);
          this.debugArrows.push(resultantArrow);
        }
      }

      // Afficher les forces par surface (si activé)
      if (this.vectorVisibility.surfaceForces) {
        this.displaySurfaceForces(surfaceForces, kite);
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

      // Portance locale (bleu ciel profond)
      if (lift.length() > 0.01) {
        const liftArrow = new THREE.ArrowHelper(
          lift.clone().normalize(),
          centerWorld,
          Math.sqrt(lift.length()) * VECTOR_SCALES.surfaceLift,
          DEBUG_COLORS.surfaceLift,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
        this.renderManager.addObject(liftArrow);
        this.debugArrows.push(liftArrow);
      }

      // Traînée (rouge vif)
      if (drag.length() > 0.01) {
        const dragArrow = new THREE.ArrowHelper(
          drag.clone().normalize(),
          centerWorld,
          Math.sqrt(drag.length()) * VECTOR_SCALES.surfaceDrag,
          DEBUG_COLORS.surfaceDrag,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
        this.renderManager.addObject(dragArrow);
        this.debugArrows.push(dragArrow);
      }

      // Friction (gris moyen)
      if (friction && friction.length() > 0.01) {
        const frictionArrow = new THREE.ArrowHelper(
          friction.clone().normalize(),
          centerWorld,
          Math.sqrt(friction.length()) * VECTOR_SCALES.surfaceFriction,
          DEBUG_COLORS.surfaceFriction,
          ARROW_HEAD_CONFIG.tiny.headLength,
          ARROW_HEAD_CONFIG.tiny.headWidth
        );
        this.renderManager.addObject(frictionArrow);
        this.debugArrows.push(frictionArrow);
      }

      // Résultante locale (jaune vif)
      if (resultant.length() > 0.01) {
        const resultantArrow = new THREE.ArrowHelper(
          resultant.clone().normalize(),
          centerWorld,
          Math.sqrt(resultant.length()) * VECTOR_SCALES.surfaceResultant,
          DEBUG_COLORS.surfaceResultant,
          ARROW_HEAD_CONFIG.small.headLength,
          ARROW_HEAD_CONFIG.small.headWidth
        );
        this.renderManager.addObject(resultantArrow);
        this.debugArrows.push(resultantArrow);
      }
    });
  }
}