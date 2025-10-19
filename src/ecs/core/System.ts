/**
 * System.ts - Classe de base pour tous les systèmes ECS
 * 
 * Un système contient la logique métier qui opère sur les entités
 * possédant certains composants.
 * 
 * Cycle de vie : initialize() → update() → dispose()
 */

import { EntityManager } from './EntityManager';

/**
 * Contexte de simulation passé à chaque update
 * Peut contenir des caches temporaires partagés entre systèmes
 */
export interface SimulationContext {
  deltaTime: number;
  totalTime: number;
  entityManager: EntityManager;
  
  // Caches optionnels pour partage de données inter-systèmes
  windCache?: Map<string, unknown>; // Cache du vent apparent (WindSystem → AeroSystem)
  [key: string]: unknown; // Permettre d'autres caches personnalisés
}

/**
 * Classe de base abstraite pour tous les systèmes
 */
export abstract class System {
  /** Nom du système (pour debug) */
  readonly name: string;
  
  /** Priorité d'exécution (plus bas = plus tôt) */
  readonly priority: number;
  
  /** Le système est-il actif ? */
  private enabled: boolean = true;
  
  constructor(name: string, priority: number = 50) {
    this.name = name;
    this.priority = priority;
  }
  
  /**
   * Initialisation du système (appelé une fois au démarrage)
   * Utile pour créer des ressources, s'abonner à des événements, etc.
   */
  initialize(_entityManager: EntityManager): void {
    // Override si nécessaire
  }
  
  /**
   * Update du système (appelé chaque frame)
   * C'est ici que la logique métier s'exécute
   */
  abstract update(context: SimulationContext): void;
  
  /**
   * Nettoyage du système (appelé à la fin)
   * Libère les ressources, se désabonne des événements, etc.
   */
  dispose(): void {
    // Override si nécessaire
  }
  
  /**
   * Active/désactive le système
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Vérifie si le système est actif
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
