/**
 * SimulationApp.ts - Application principale de simulation de cerf-volant
 *
 * 🎯 CE QUE FAIT CE FICHIER :
 * C'est le chef d'orchestre de notre simulation ! Il coordonne tous les éléments :
 * - Le cerf-volant qui vole dans le ciel
 * - Le pilote qui tient la barre de contrôle
 * - Le vent qui pousse le kite
 * - Les lignes qui relient le pilote au kite
 * - L'affichage 3D de toute la scène
 *
 * 🎮 COMMENT ÇA MARCHE :
 * 1. Au démarrage : Crée le kite, le pilote, les lignes et démarre la physique
 * 2. En continu (60 fois par seconde) : Met à jour la physique et redessine tout
 * 3. Sur les événements : Répond aux clics souris et touches clavier
 *
 * 🏗️ ARCHITECTURE :
 * - PhysicsEngine : Calcule comment tout bouge selon les lois de la physique
 * - RenderManager : Dessine tout en 3D avec des beaux effets
 * - InputHandler : Écoute vos commandes au clavier
 * - Configuration : Stocke tous les réglages (vent, masses, tailles...)
 */
import * as THREE from "three";
import { Kite } from "../objects/organic/Kite";
import { PhysicsEngine } from "../physics/PhysicsEngine";
import { RenderManager } from "../rendering/RenderManager";
import { InputHandler } from "../input/InputHandler";
import { CONFIG } from "../config/GlobalConfig";
import { INPUT_CONFIG } from "../config/InputConfig";
import type { WindParams } from "../types/wind";
import { SimulationUI } from "../ui/SimulationUI";

// Nouveaux imports pour sous-modules
import { SimulationAppInitializer } from "./SimulationAppInitializer";
import { SimulationAppControls } from "./SimulationAppControls";
import { SimulationAppDebugger } from "./SimulationAppDebugger";
import { SimulationAppUpdater } from "./SimulationAppUpdater";
import { logger } from "../utils/Logger";

export class SimulationApp {
  // 🎮 COMPOSANTS PRINCIPAUX - Les "modules" de notre simulation
  public renderManager: RenderManager; // 🎨 S'occupe d'afficher tout en 3D (rendu public)
  public physicsEngine!: PhysicsEngine; // ⚡ Calcule comment tout bouge selon la physique (rendu public)
  private inputHandler: InputHandler; // 🎯 Écoute vos commandes clavier

  // 🪁 OBJETS DE LA SCÈNE - Ce qu'on voit voler dans le ciel
  public kite!: Kite; // Le cerf-volant qui vole (public pour accès dans sous-modules)
  public controlBar!: THREE.Group; // La barre que le pilote tient dans ses mains
  public leftLine: THREE.Line | null = null; // Ligne gauche (corde du kite vers pilote)
  public rightLine: THREE.Line | null = null; // Ligne droite (corde du kite vers pilote)

  // ⏰ GESTION DU TEMPS - Pour calculer les mouvements fluides
  private clock: THREE.Clock; // Chronomètre pour mesurer le temps qui passe

  // 🎛️ ÉTAT DE LA SIMULATION - Ce qui contrôle le comportement
  public isPlaying: boolean = true; // true = simulation en marche, false = en pause (public)
  public debugMode: boolean = true; // Affichage des infos techniques pour développeur (public)
  public debugVisualsEnabled: boolean = false; // Nouveau flag pour les visuels (désactivé par défaut pour perf) (public)

  // Temps et accumulateur (public pour accès)
  public _lastTime: number = 0;
  public _lastFpsTime: number = 0;
  public _accumulator: number = 0;
  public _frameCount: number = 0; // Renommé pour éviter conflit
  public _physicsStart: number = 0;
  public _renderStart: number = 0;
  public simulationUI!: SimulationUI; // Ajout si pas déjà
  private container: HTMLElement;

  // Sous-modules
  private initializer!: SimulationAppInitializer;
  private controls!: SimulationAppControls;
  private debugger: SimulationAppDebugger;
  private updater!: SimulationAppUpdater;

  // PHYSICS_TIMESTEP constant
  private readonly PHYSICS_TIMESTEP: number = CONFIG.physics.fixedTimestep; // 1/60

  /**
   * 🚀 CONSTRUCTEUR - Le "démarrage" de notre simulation
   *
   * C'est comme allumer une console de jeu : on initialise tout ce qu'il faut
   * pour que la simulation fonctionne !
   *
   * @param container - L'élément HTML où afficher la simulation 3D
   */
  constructor(container: HTMLElement) {
    this.container = container;
    // Supprimer le log de démarrage pour réduire le flood

    // ⏰ Création du chronomètre pour mesurer le temps
    this.clock = new THREE.Clock();

    // 🎨 Initialisation du moteur de rendu 3D (les "graphismes")
    // C'est lui qui dessine le ciel, le sol, les objets...
    this.renderManager = new RenderManager(container);

    // 🎯 Initialisation du gestionnaire de commandes clavier
    // Il écoute quand vous appuyez sur les flèches, WASD, etc.
    this.inputHandler = new InputHandler();

    // Connecter les contrôles OrbitControls à l'InputHandler pour éviter les conflits
    this.inputHandler.setOrbitControls(this.renderManager.getControls());

    // Initialiser sous-modules
    this.debugger = new SimulationAppDebugger(this);
    this.initializer = new SimulationAppInitializer(
      this,
      this.renderManager,
      this.inputHandler,
      container
    );
    this.controls = new SimulationAppControls(this);
    this.updater = new SimulationAppUpdater(this);

    // 🏗️ Construction de toute la scène 3D
    // Crée le kite, le pilote, les lignes, démarre la physique...
    this.initializer.initializeScene();
    this.controls.setupControls();
    this.controls.setupUIControls();

    // 🎬 Démarrage de la boucle d'animation infinie
    // Appelle animate() 60 fois par seconde pour faire bouger tout
    this.animate();
  }

  /**
   * 🎬 BOUCLE D'ANIMATION PRINCIPALE - Le "cœur qui bat" de la simulation
   *
   * Cette fonction est appelée 60 fois par seconde (comme un film à 60 images/sec).
   * À chaque "battement", elle :
   * 1. Lit vos commandes clavier
   * 2. Calcule la nouvelle physique (où va le kite ?)
   * 3. Met à jour l'affichage visuel
   * 4. Recommence à l'image suivante !
   *
   * C'est la "pompe" qui fait vivre toute la simulation.
   */
  private animate(currentTime: number = performance.now()): void {
    const deltaTime = Math.min((currentTime - this._lastTime) / 1000, 0.025); // Cap 25ms pour plus de fluidité
    this._lastTime = currentTime;

    // Early exit si en pause
    if (!this.isPlaying) {
      requestAnimationFrame(() => this.animate());
      return;
    }

    this._physicsStart = performance.now();

    // Fixed timestep optimisé avec moins d'itérations
    this._accumulator += deltaTime;
    let iterations = 0;
    const maxIterations = 2; // Réduit à 2 pour fluidité maximale
    const physicsDelta = this.PHYSICS_TIMESTEP;

    while (this._accumulator >= physicsDelta && iterations < maxIterations) {
      const targetRotation = this.inputHandler.getTargetBarRotation();
      this.physicsEngine.update(physicsDelta, targetRotation, false);
      this._accumulator -= physicsDelta;
      iterations++;
    }

    // Reset plus agressif
    if (iterations >= maxIterations) {
      this._accumulator = 0; // Reset sans log pour éviter le flood
    }

    // Mise à jour input (léger)
    this.inputHandler.update(deltaTime);

    // Debug avec throttling intégré
    this.debugger.updateDebugInfo();

    // Updater avec throttling intelligent
    this.updater.update(deltaTime, currentTime);

    // Rendu optimisé
    this._renderStart = performance.now();
    this.renderManager.render();

    requestAnimationFrame(() => this.animate());
  }

  // Méthodes publiques de contrôle (gardées dans core)
  public togglePause(): void {
    this.isPlaying = !this.isPlaying;
    // Supprimer les logs de pause/reprise pour réduire le flood
  }

  public resetSimulation(): void {
    this.kite.position.set(0, 7, -5);
    this.kite.quaternion.set(0, 0, 0, 1);
    // Supprimer le log de reset pour réduire le flood
  }

  // Alias pour l'interface utilisateur
  public reset(): void {
    this.resetSimulation();
  }

  // Les toggles debug sont maintenant dans debugger, mais exposés
  public toggleDebugMode(): void {
    this.debugger.toggleDebugMode();
  }

  public toggleFullDebug(): void {
    this.debugger.toggleFullDebug();
  }

  public toggleDebugVisuals(): void {
    this.debugger.toggleDebugVisuals();
  }

  // Méthodes de configuration
  public setWindParams(params: Partial<WindParams>): void {
    this.physicsEngine.setWindParams(params);
  }

  public setLineLength(length: number): void {
    this.physicsEngine.setLineLength(length);
  }

  // Getters
  public getKite(): Kite {
    return this.kite;
  }

  public getPhysicsEngine(): PhysicsEngine {
    return this.physicsEngine;
  }

  public getRenderManager(): RenderManager {
    return this.renderManager;
  }

  // Nettoyage des ressources
  public cleanup(): void {
    console.log("🧹 Nettoyage de SimulationApp...");

    // Nettoyer via debugger
    this.debugger.clearDebugArrows();

    // Nettoyer les lignes
    if (this.leftLine) {
      this.renderManager.removeObject(this.leftLine);
      this.leftLine = null;
    }
    if (this.rightLine) {
      this.renderManager.removeObject(this.rightLine);
      this.rightLine = null;
    }

    // Arrêter la simulation
    this.isPlaying = false;
  }
}
