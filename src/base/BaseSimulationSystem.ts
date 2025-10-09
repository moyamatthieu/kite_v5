/**
 * BaseSimulationSystem.ts - Interface de base pour tous les systèmes de simulation
 *
 * Pattern : Template Method pour les systèmes de simulation
 * Chaque système (Physics, Wind, Input, etc.) hérite de cette classe
 * et implémente ses méthodes spécifiques.
 */

export interface SimulationContext {
  deltaTime: number;
  totalTime: number;
  isPaused: boolean;
  debugMode: boolean;
}

export abstract class BaseSimulationSystem {
  protected name: string;
  protected enabled: boolean = true;
  protected priority: number = 0; // Ordre d'exécution (plus petit = plus prioritaire)

  constructor(name: string, priority: number = 0) {
    this.name = name;
    this.priority = priority;
  }

  /**
   * Initialise le système (appelé une fois au démarrage)
   */
  abstract initialize(): void;

  /**
   * Met à jour le système (appelé chaque frame)
   */
  abstract update(context: SimulationContext): void;

  /**
   * Réinitialise le système à son état initial
   */
  abstract reset(): void;

  /**
   * Nettoie les ressources du système
   */
  abstract dispose(): void;

  /**
   * Active/désactive le système
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getName(): string {
    return this.name;
  }

  getPriority(): number {
    return this.priority;
  }

  /**
   * Validation interne du système
   */
  validate(): boolean {
    return true; // Override dans les sous-classes si nécessaire
  }
}