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
import { SurfaceForce } from "../types";
import type { LineSystem } from "../physics/LineSystem";
import type { WindSimulator } from "../physics/WindSimulator";
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
  velocity: 1.0,        // Augmenté pour plus de visibilité
  apparentWind: 0.8,    // Augmenté pour mieux voir le vent apparent
  globalLift: 0.4,      // Portance globale plus visible
  globalResultant: 0.6, // Résultante plus proéminente
  surfaceLift: 0.5,     // Forces par surface plus visibles
  surfaceDrag: 0.5,
  surfaceFriction: 0.3,
  surfaceResultant: 0.7, // Résultante locale plus visible
  surfaceMass: 4.0,     // Gravité distribuée plus visible
  torque: 0.8,          // Couple plus visible
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
  private debugLabels: THREE.Object3D[] = []; // Nouveaux labels textuels
  private debugMode: boolean;
  private vectorVisibility: VectorVisibility = {
    velocity: true,
    apparentWind: true,
    globalForces: true,
    surfaceForces: true,
    surfaceMass: false,  // Désactivé par défaut (peut surcharger l'affichage)
    torque: true, // Activé par défaut
  };
  private physicsSystem: any;

  constructor(renderTarget: DebugRenderTarget, physicsSystem: any) {
    this.renderTarget = renderTarget;
    this.physicsSystem = physicsSystem;
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
   * Met à jour le panneau d'informations de debug HTML
   */
  updateDebugDisplay(kitePhysicsSystem: any): void {
    if (!this.debugMode) return;

    const debugPanel = document.getElementById("debug-panel");
    if (!debugPanel) return;

    // Récupérer les données physiques
    const kiteState = kitePhysicsSystem.getKiteState();
    const forces = kitePhysicsSystem.getAerodynamicForces();
    const windSimulator = kitePhysicsSystem.getWindSimulator();
    const lineSystem = kitePhysicsSystem.getLineSystem();

    if (!kiteState || !forces || !windSimulator || !lineSystem) return;

    // Calculer les valeurs à afficher
    const velocity = kiteState.velocity.length().toFixed(2);
    const position = kiteState.position.clone();
    const windParams = windSimulator.getParams();
    const tensions = lineSystem.getTensions();

    // Mettre à jour le contenu du panneau
    const debugContent = debugPanel.querySelector(".debug-content");
    if (debugContent) {
      debugContent.innerHTML = `
        <div class="debug-section">
          <h4>🏃 État du Kite</h4>
          <div class="debug-item">Position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) m</div>
          <div class="debug-item">Vitesse: ${velocity} m/s</div>
        </div>

        <div class="debug-section">
          <h4>💨 Vent</h4>
          <div class="debug-item">Vitesse: ${windParams.speed.toFixed(1)} km/h</div>
          <div class="debug-item">Direction: ${windParams.direction.toFixed(0)}°</div>
          <div class="debug-item">Turbulence: ${windParams.turbulence.toFixed(1)}%</div>
        </div>

        <div class="debug-section">
          <h4>✈️ Forces Aérodynamiques</h4>
          <div class="debug-item">Portance: ${forces.lift.length().toFixed(2)} N</div>
          <div class="debug-item">Traînée: ${forces.drag.length().toFixed(2)} N</div>
          <div class="debug-item">Résultante: ${forces.lift.clone().add(forces.drag).length().toFixed(2)} N</div>
        </div>

        <div class="debug-section">
          <h4>🎯 Lignes de Contrôle</h4>
          <div class="debug-item">Tension Gauche: ${tensions.left.toFixed(2)} N</div>
          <div class="debug-item">Tension Droite: ${tensions.right.toFixed(2)} N</div>
          <div class="debug-item">Longueur: ${lineSystem.lineLength.toFixed(2)} m</div>
        </div>
      `;
    }
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
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <strong style="color: #fff; font-size: 14px;">🔧 Contrôles:</strong>
              <label style="display: flex; align-items: center; cursor: pointer; font-size: 12px;">
                <input type="checkbox" id="toggle-all-vectors" style="margin-right: 5px; cursor: pointer;">
                Tout activer/désactiver
              </label>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <label style="color: #fff; font-size: 12px;">Échelle globale:</label>
              <input type="range" id="vector-scale" min="0.1" max="3.0" step="0.1" value="1.0" style="flex: 1;">
              <span id="scale-value" style="color: #fff; font-size: 12px; min-width: 30px;">1.0x</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
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
          </div>
        `;

        debugPanel.appendChild(controlsContainer);

        // Ajouter les event listeners
        document.getElementById("toggle-all-vectors")?.addEventListener("change", (e) => {
          const checked = (e.target as HTMLInputElement).checked;
          this.vectorVisibility.velocity = checked;
          this.vectorVisibility.apparentWind = checked;
          this.vectorVisibility.globalForces = checked;
          this.vectorVisibility.surfaceForces = checked;
          this.vectorVisibility.surfaceMass = checked;
          this.vectorVisibility.torque = checked;

          // Mettre à jour tous les checkboxes
          (document.getElementById("toggle-velocity") as HTMLInputElement).checked = checked;
          (document.getElementById("toggle-apparent-wind") as HTMLInputElement).checked = checked;
          (document.getElementById("toggle-global-forces") as HTMLInputElement).checked = checked;
          (document.getElementById("toggle-surface-forces") as HTMLInputElement).checked = checked;
          (document.getElementById("toggle-surface-mass") as HTMLInputElement).checked = checked;
          (document.getElementById("toggle-torque") as HTMLInputElement).checked = checked;
        });

        // Contrôle d'échelle globale
        document.getElementById("vector-scale")?.addEventListener("input", (e) => {
          const scale = parseFloat((e.target as HTMLInputElement).value);
          this.setGlobalVectorScale(scale);
          document.getElementById("scale-value")!.textContent = `${scale.toFixed(1)}x`;
        });
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

    // Nettoyer aussi les labels
    this.debugLabels.forEach((label) => {
      this.renderTarget.removeObject(label);
    });
    this.debugLabels = [];
  }

  /**
   * Crée un vecteur avec son label textuel
   */
  private createLabeledVector(
    direction: THREE.Vector3,
    origin: THREE.Vector3,
    length: number,
    color: number,
    label: string,
    headLength?: number,
    headWidth?: number
  ): void {
    // Créer la flèche
    const arrow = Primitive.arrow(direction, origin, length, color, headLength, headWidth);
    this.debugArrows.push(arrow);
    this.renderTarget.addObject(arrow);

    // Créer le label à la pointe de la flèche
    const labelPosition = origin.clone().add(direction.clone().multiplyScalar(length * 1.1));
    const textLabel = Primitive.textLabel(label, labelPosition, color, 0.3);
    this.debugLabels.push(textLabel);
    this.renderTarget.addObject(textLabel);
  }

  /**
   * Calcule une échelle adaptative pour les vecteurs basée sur leur magnitude
   * relative aux autres forces dans la scène
   */
  private calculateAdaptiveScale(
    magnitude: number,
    baseScale: number,
    minScale: number = 0.1,
    maxScale: number = 3.0
  ): number {
    if (magnitude <= 0) return minScale;

    // Utiliser une échelle logarithmique pour une meilleure visibilité
    const logMagnitude = Math.log10(Math.max(magnitude, 0.01));
    const adaptiveScale = baseScale * (1 + logMagnitude * 0.2) * this.globalVectorScale;

    // Limiter l'échelle dans des bornes raisonnables
    return Math.max(minScale, Math.min(maxScale, adaptiveScale));
  }

  /**
   * Définit l'échelle globale des vecteurs
   */
  private globalVectorScale: number = 1.0;

  setGlobalVectorScale(scale: number): void {
    this.globalVectorScale = Math.max(0.1, Math.min(5.0, scale));
  }

  /**
   * Met à jour tous les vecteurs de debug avec l'architecture ECS
   */
  public updateDebugVectors(kite: Kite, kitePhysicsSystem: any): void {
    if (!this.debugMode) return;

    this.clearDebugArrows();

    // Calculer la position centrale du kite pour tous les vecteurs
    const centerPoint = kite.getPoint("CENTRE");
    const centerWorld = centerPoint ? kite.localToWorld(centerPoint.clone()) : kite.position;

    // Afficher la vitesse du kite
    if (this.vectorVisibility.velocity) {
      this.displayVelocityVector(kitePhysicsSystem, centerWorld);
    }

    // Afficher le vent apparent
    if (this.vectorVisibility.apparentWind) {
      this.displayApparentWindVector(kitePhysicsSystem, centerWorld);
    }

    // Afficher les forces globales
    if (this.vectorVisibility.globalForces) {
      this.displayGlobalForces(kitePhysicsSystem, centerWorld);
    }

    // Afficher les forces par surface
    if (this.vectorVisibility.surfaceForces) {
      this.displaySurfaceForcesFromECS(kitePhysicsSystem, kite);
    }

    // Afficher le couple aérodynamique
    if (this.vectorVisibility.torque) {
      this.displayTorqueVector(kitePhysicsSystem, centerWorld);
    }

    // Afficher les contraintes (tensions des lignes et brides)
    this.displayConstraintForces(kitePhysicsSystem, kite);

    // Afficher la gravité distribuée si activé
    if (this.vectorVisibility.surfaceMass) {
      this.displayGravityForces(kite);
    }
  }

  /**
   * Affiche le vecteur de vitesse du kite
   */
  private displayVelocityVector(kitePhysicsSystem: any, centerWorld: THREE.Vector3): void {
    const kiteState = kitePhysicsSystem.getKiteState();
    if (!kiteState || kiteState.velocity.length() < 0.1) return;

    const velocity = kiteState.velocity;

    const dir = velocity.clone().normalize();
    const magnitude = velocity.length();
    const adaptiveScale = this.calculateAdaptiveScale(magnitude, VECTOR_SCALES.velocity);
    const length = magnitude * adaptiveScale;

    this.createLabeledVector(
      dir,
      centerWorld, // Utiliser la position centrale cohérente
      length,
      DEBUG_COLORS.velocity,
      `${magnitude.toFixed(1)} m/s`,
      ARROW_HEAD_CONFIG.large.headLength,
      ARROW_HEAD_CONFIG.large.headWidth
    );
  }

  /**
   * Affiche le vecteur de vent apparent
   */
  private displayApparentWindVector(kitePhysicsSystem: any, kitePosition: THREE.Vector3): void {
    const windSimulator = kitePhysicsSystem.getWindSimulator();
    if (!windSimulator) return;

    // Obtenir l'état actuel du kite pour calculer le vent apparent
    const kiteState = kitePhysicsSystem.getKiteState();
    if (!kiteState) return;

    // Calculer le vent apparent = vent réel - vitesse du kite
    const windParams = windSimulator.getParams();
    const windSpeed = windParams.speed; // km/h
    const windDirectionRad = (windParams.direction * Math.PI) / 180;

    if (windSpeed < 0.1) return;

    // Vecteur vent réel (converti en m/s pour cohérence avec la vitesse du kite)
    const windVector = new THREE.Vector3(
      Math.sin(windDirectionRad) * (windSpeed / 3.6), // km/h -> m/s
      0,
      -Math.cos(windDirectionRad) * (windSpeed / 3.6)
    );

    // Vent apparent = vent réel - vitesse du kite
    const apparentWind = windVector.clone().sub(kiteState.velocity);

    if (apparentWind.length() < 0.1) return;

    const dir = apparentWind.clone().normalize();
    const magnitude = apparentWind.length();
    const adaptiveScale = this.calculateAdaptiveScale(magnitude, VECTOR_SCALES.apparentWind);
    const length = magnitude * adaptiveScale;

    this.createLabeledVector(
      dir,
      kitePosition, // Utiliser la position du centre du kite sur sa surface
      length,
      DEBUG_COLORS.apparentWind,
      `${magnitude.toFixed(1)} m/s`,
      ARROW_HEAD_CONFIG.large.headLength,
      ARROW_HEAD_CONFIG.large.headWidth
    );
  }

  /**
   * Affiche les forces globales (lift, drag, résultante)
   */
  private displayGlobalForces(kitePhysicsSystem: any, kitePosition: THREE.Vector3): void {
    const forces = kitePhysicsSystem.getAerodynamicForces();
    if (!forces) return;

    const { lift, drag } = forces;

    // Vecteur de portance globale (bleu royal)
    if (this.vectorVisibility.globalForces && lift.length() > CONFIG.debug.minVectorLength) {
      const liftDir = lift.clone().normalize();
      const liftMagnitude = lift.length();
      const liftScale = this.calculateAdaptiveScale(liftMagnitude, VECTOR_SCALES.globalLift);
      const liftLength = Math.sqrt(liftMagnitude) * liftScale;

      this.createLabeledVector(
        liftDir,
        kitePosition, // Position du centre du kite sur sa surface
        liftLength,
        DEBUG_COLORS.globalLift,
        `${liftMagnitude.toFixed(1)} N`,
        ARROW_HEAD_CONFIG.medium.headLength,
        ARROW_HEAD_CONFIG.medium.headWidth
      );
    }

    // Vecteur de traînée globale (rouge)
    if (this.vectorVisibility.globalForces && drag.length() > CONFIG.debug.minVectorLength) {
      const dragDir = drag.clone().normalize();
      const dragMagnitude = drag.length();
      const dragScale = this.calculateAdaptiveScale(dragMagnitude, VECTOR_SCALES.globalLift);
      const dragLength = Math.sqrt(dragMagnitude) * dragScale;

      this.createLabeledVector(
        dragDir,
        kitePosition, // Position du centre du kite sur sa surface
        dragLength,
        0xff4444, // Rouge pour la traînée globale
        `${dragMagnitude.toFixed(1)} N`,
        ARROW_HEAD_CONFIG.medium.headLength,
        ARROW_HEAD_CONFIG.medium.headWidth
      );
    }

    // Vecteur résultant global (somme vectorielle de lift et drag)
    if (lift.length() > CONFIG.debug.minVectorLength || drag.length() > CONFIG.debug.minVectorLength) {
      const resultant = lift.clone().add(drag);
      if (resultant.length() > CONFIG.debug.minVectorLength) {
        const resultantDir = resultant.clone().normalize();
        const resultantMagnitude = resultant.length();
        const resultantScale = this.calculateAdaptiveScale(resultantMagnitude, VECTOR_SCALES.globalResultant);
        const resultantLength = Math.sqrt(resultantMagnitude) * resultantScale;

        this.createLabeledVector(
          resultantDir,
          kitePosition, // Position du centre du kite sur sa surface
          resultantLength,
          DEBUG_COLORS.globalResultant,
          `${resultantMagnitude.toFixed(1)} N`,
          ARROW_HEAD_CONFIG.large.headLength,
          ARROW_HEAD_CONFIG.large.headWidth
        );
      }
    }
  }

  /**
   * Affiche les forces par surface depuis l'architecture ECS
   */
  private displaySurfaceForcesFromECS(kitePhysicsSystem: any, kite: Kite): void {
    const surfaceForces = kitePhysicsSystem.getSurfaceForces();
    if (surfaceForces && surfaceForces.length > 0) {
      // TODO: Implémenter displaySurfaceForces quand la méthode sera disponible
      // this.displaySurfaceForces(surfaceForces, kite);
    }
  }

  /**
   * Affiche le vecteur de couple aérodynamique
   */
  private displayTorqueVector(kitePhysicsSystem: any, kitePosition: THREE.Vector3): void {
    // Note: Dans l'architecture actuelle, le couple n'est pas directement exposé
    // Nous utilisons une approximation basée sur les forces aérodynamiques disponibles
    const forces = kitePhysicsSystem.getAerodynamicForces();
    if (!forces) return;

    const kiteState = kitePhysicsSystem.getKiteState();
    if (!kiteState) return;

    const { lift } = forces;

    // Approximation du couple basée sur la portance (en utilisant une distance arbitraire)
    // Dans un système complet, cela devrait venir directement du système de physique
    const approximateTorqueMagnitude = lift.length() * 0.5; // Distance arbitraire de 0.5m

    if (approximateTorqueMagnitude < CONFIG.debug.minVectorLength) return;

    // Créer un vecteur de couple approximatif (direction perpendiculaire à la portance)
    const torqueVector = new THREE.Vector3(-lift.y, lift.x, 0).normalize().multiplyScalar(approximateTorqueMagnitude);

    const dir = torqueVector.clone().normalize();
    const length = Math.sqrt(approximateTorqueMagnitude) * VECTOR_SCALES.torque;

    this.createLabeledVector(
      dir,
      kitePosition, // Position du centre du kite sur sa surface
      length,
      DEBUG_COLORS.torque,
      `${approximateTorqueMagnitude.toFixed(1)} N·m`,
      ARROW_HEAD_CONFIG.large.headLength,
      ARROW_HEAD_CONFIG.large.headWidth
    );
  }

  /**
   * Affiche les vecteurs de tension des lignes et brides
   */
  private displayConstraintForces(kitePhysicsSystem: any, kite: Kite): void {
    const lineSystem = kitePhysicsSystem.getLineSystem();
    if (!lineSystem) return;

    const kiteState = kitePhysicsSystem.getKiteState();
    if (!kiteState) return;

    // Obtenir les tensions des lignes
    const tensions = lineSystem.getTensions();
    const handlePositions = kitePhysicsSystem.getHandlePositions?.() || { left: new THREE.Vector3(), right: new THREE.Vector3() };

    // Points d'attache des lignes sur le kite
    const kiteLeftWorld = kite.toWorldCoordinates(kite.getPoint("CTRL_GAUCHE")?.clone() || new THREE.Vector3());
    const kiteRightWorld = kite.toWorldCoordinates(kite.getPoint("CTRL_DROIT")?.clone() || new THREE.Vector3());

    // Vecteurs de tension pour la ligne gauche
    if (tensions.left > 0.1) {
      const tensionLeftDir = handlePositions.left.clone().sub(kiteLeftWorld).normalize();
      const tensionLeftLength = Math.sqrt(tensions.left) * 0.1; // Échelle pour visualisation
      const tensionLeftArrow = Primitive.arrow(
        tensionLeftDir,
        kiteLeftWorld,
        tensionLeftLength,
        0xff6b6b, // Rouge pour tension
        ARROW_HEAD_CONFIG.small.headLength,
        ARROW_HEAD_CONFIG.small.headWidth
      );
      this.debugArrows.push(tensionLeftArrow);
      this.renderTarget.addObject(tensionLeftArrow);
    }

    // Vecteurs de tension pour la ligne droite
    if (tensions.right > 0.1) {
      const tensionRightDir = handlePositions.right.clone().sub(kiteRightWorld).normalize();
      const tensionRightLength = Math.sqrt(tensions.right) * 0.1; // Échelle pour visualisation
      const tensionRightArrow = Primitive.arrow(
        tensionRightDir,
        kiteRightWorld,
        tensionRightLength,
        0x4ecdc4, // Cyan pour tension
        ARROW_HEAD_CONFIG.small.headLength,
        ARROW_HEAD_CONFIG.small.headWidth
      );
      this.debugArrows.push(tensionRightArrow);
      this.renderTarget.addObject(tensionRightArrow);
    }
  }

  /**
   * Affiche les vecteurs de gravité distribuée sur chaque surface
   */
  private displayGravityForces(kite: Kite): void {
    // Pour chaque surface avec sa masse
    KiteGeometry.SURFACES_WITH_MASS.forEach((surface: any, _surfaceIndex: number) => {
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
  getWindSimulator(): WindSimulator;
  getLineSystem(): LineSystem;
}

