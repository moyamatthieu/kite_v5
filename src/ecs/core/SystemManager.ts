/**
 * SystemManager.ts - Gestionnaire de systèmes ECS
 * 
 * Responsabilités :
 * - Enregistrer des systèmes
 * - Les exécuter dans l'ordre de priorité
 * - Gérer leur cycle de vie (init/update/dispose)
 */

import { System, SimulationContext } from './System';
import { EntityManager } from './EntityManager';

export class SystemManager {
  /** Liste des systèmes (triée par priorité) */
  private systems: System[];
  
  constructor() {
    this.systems = [];
  }
  
  /**
   * Ajoute un système (et trie par priorité)
   */
  add(system: System): void {
    this.systems.push(system);
    // Tri par priorité croissante
    this.systems.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Initialise tous les systèmes
   */
  async initializeAll(entityManager: EntityManager): Promise<void> {
    for (const system of this.systems) {
      system.initialize(entityManager);
    }
  }
  
  /**
   * Update tous les systèmes actifs
   */
  updateAll(context: SimulationContext): void {
    for (const system of this.systems) {
      if (system.isEnabled()) {
        system.update(context);
      }
    }
  }
  
  /**
   * Dispose tous les systèmes
   */
  disposeAll(): void {
    for (const system of this.systems) {
      system.dispose();
    }
    this.systems = [];
  }
  
  /**
   * Récupère un système par son nom
   */
  getSystem(name: string): System | undefined {
    return this.systems.find(s => s.name === name);
  }
  
  /**
   * Active/désactive un système
   */
  setSystemEnabled(name: string, enabled: boolean): void {
    const system = this.getSystem(name);
    if (system) {
      system.setEnabled(enabled);
    }
  }
  
  /**
   * Liste tous les systèmes
   */
  getAllSystems(): System[] {
    return [...this.systems];
  }
}
