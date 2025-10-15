/**
 * InputSystem.ts - Système de gestion des entrées utilisateur
 */

import * as THREE from 'three';

import { BaseSystem } from '@base/BaseSystem';
import { Entity } from '@base/Entity';

export interface InputState {
  // Entrées analogiques (normalisées -1 à 1)
  barPosition: number; // Position de la barre (-1: tirée gauche, 0: neutre, 1: tirée droite)
  barVelocity: number; // Vitesse de mouvement de la barre

  // Entrées numériques
  resetPressed: boolean;
  debugTogglePressed: boolean;
}

export interface InputConfig {
  barSmoothingEnabled: boolean;
  barSmoothingFactor: number; // Facteur de lissage (0-1, plus proche de 1 = plus lisse)
  deadzone: number; // Zone morte pour éviter les oscillations
  maxBarSpeed: number; // Vitesse maximale de changement de la barre
  keyboardEnabled: boolean;
  mouseEnabled: boolean;
}

export class InputSystem extends BaseSystem {
  private inputState: InputState = {
    barPosition: 0,
    barVelocity: 0,
    resetPressed: false,
    debugTogglePressed: false,
  };

  private config: InputConfig;

  // Gestion des événements
  private keyStates = new Map<string, boolean>();
  private mousePosition = new THREE.Vector2();
  private mouseButtons = new Map<number, boolean>();

  constructor(config: Partial<InputConfig> = {}) {
    super('InputSystem', 1); // Haute priorité (traité en premier)

    this.config = {
      barSmoothingEnabled: true,
      barSmoothingFactor: 0.92, // Plus élevé = plus smooth (0-1)
      deadzone: 0.05,
      maxBarSpeed: 2.0, // unités par seconde
      keyboardEnabled: true,
      mouseEnabled: true,
      ...config
    };

    this.setupEventListeners();
  }

  initialize(): Promise<void> {
    console.log('InputSystem initialized');
    return Promise.resolve();
  }

  update(entities: Entity[], deltaTime: number): void {
    // Mettre à jour l'état des entrées
    this.updateKeyboardInput();
    this.updateMouseInput();

    // Calculer la position de la barre avec lissage
    this.updateBarPosition(deltaTime);

    // Mettre à jour les états des boutons (pulse)
    this.updateButtonStates();

    // Log supprimé - trop verbeux
  }

  /**
   * Configure les écouteurs d'événements
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Écouteurs clavier
    if (this.config.keyboardEnabled) {
      window.addEventListener('keydown', this.onKeyDown.bind(this));
      window.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    // Écouteurs souris
    if (this.config.mouseEnabled) {
      window.addEventListener('mousemove', this.onMouseMove.bind(this));
      window.addEventListener('mousedown', this.onMouseDown.bind(this));
      window.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  /**
   * Gestionnaire d'événement clavier (appui)
   */
  private onKeyDown(event: KeyboardEvent): void {
    this.keyStates.set(event.code, true);

    // Empêcher le comportement par défaut pour certaines touches
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyR'].includes(event.code)) {
      event.preventDefault();
    }
  }

  /**
   * Gestionnaire d'événement clavier (relâchement)
   */
  private onKeyUp(event: KeyboardEvent): void {
    this.keyStates.set(event.code, false);
  }

  /**
   * Gestionnaire de mouvement de souris
   */
  private onMouseMove(event: MouseEvent): void {
    this.mousePosition.set(event.clientX, event.clientY);
  }

  /**
   * Gestionnaire d'appui souris
   */
  private onMouseDown(event: MouseEvent): void {
    this.mouseButtons.set(event.button, true);
  }

  /**
   * Gestionnaire de relâchement souris
   */
  private onMouseUp(event: MouseEvent): void {
    this.mouseButtons.set(event.button, false);
  }

  /**
   * Met à jour les entrées clavier
   */
  private updateKeyboardInput(): void {
    // Contrôle de la barre avec les flèches gauche/droite
    // Input brut de l'utilisateur (instantané)
    let rawInput = 0;

    if (this.keyStates.get('ArrowLeft')) {
      rawInput = -1; // Barre tirée à gauche
    } else if (this.keyStates.get('ArrowRight')) {
      rawInput = 1; // Barre tirée à droite
    }

    // Appliquer la zone morte
    if (Math.abs(rawInput) < this.config.deadzone) {
      rawInput = 0;
    }

    // Stocker l'input brut (sans smoothing)
    // Le smoothing sera fait dans ControlBarSystem
    this.inputState.barPosition = rawInput;

    // Boutons pulse
    this.inputState.resetPressed = this.keyStates.get('KeyR') || false;
    this.inputState.debugTogglePressed = this.keyStates.get('KeyD') || false;
  }

  /**
   * Met à jour les entrées souris (réservé pour extension future)
   */
  private updateMouseInput(): void {
    // Pour l'instant, la souris n'est pas utilisée pour le contrôle principal
    // Mais on pourrait l'utiliser pour un contrôle plus fin
  }

  /**
   * Met à jour la position de la barre (pas de smoothing ici, fait dans ControlBarSystem)
   */
  private updateBarPosition(deltaTime: number): void {
    // L'input est déjà dans barPosition (brut)
    // Le smoothing sera appliqué dans ControlBarSystem sur la rotation physique

    // Calculer la vitesse de changement
    this.inputState.barVelocity = (this.inputState.barPosition - this.inputState.barVelocity) / deltaTime;

    // Limiter la vitesse maximale
    if (Math.abs(this.inputState.barVelocity) > this.config.maxBarSpeed) {
      this.inputState.barVelocity = Math.sign(this.inputState.barVelocity) * this.config.maxBarSpeed;
    }
  }

  /**
   * Met à jour les états des boutons (pulse - seulement true pendant un frame)
   */
  private updateButtonStates(): void {
    // Pour l'instant, pas de logique pulse nécessaire car on utilise directement les keyStates
    // Mais on pourrait implémenter une logique de pulse ici si nécessaire
  }

  /**
   * Obtient l'état actuel des entrées
   */
  getInputState(): Readonly<InputState> {
    return this.inputState;
  }

  /**
   * Force une position de barre (pour debug ou automation)
   */
  setBarPosition(position: number): void {
    this.inputState.barPosition = THREE.MathUtils.clamp(position, -1, 1);
  }

  /**
   * Obtient la configuration actuelle
   */
  getConfig(): Readonly<InputConfig> {
    return this.config;
  }

  reset(): void {
    this.inputState.barPosition = 0;
    this.inputState.barVelocity = 0;
    this.inputState.resetPressed = false;
    this.inputState.debugTogglePressed = false;

    // Réinitialiser les états des touches
    this.keyStates.clear();
    this.mouseButtons.clear();
  }

  dispose(): void {
    // Supprimer les écouteurs d'événements
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown.bind(this));
      window.removeEventListener('keyup', this.onKeyUp.bind(this));
      window.removeEventListener('mousemove', this.onMouseMove.bind(this));
      window.removeEventListener('mousedown', this.onMouseDown.bind(this));
      window.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  getRotationInput(): number {
    return this.inputState.barPosition;
  }
}