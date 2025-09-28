/**
 * Vector3Pool.ts - Pool global de Vector3 pour éviter allocations
 *
 * ✅ OBJECTIF : Zéro allocation Vector3 dans les boucles de rendu
 * - Pool de Vector3 pré-alloués réutilisables
 * - API simple get() / release() pour usage optimal
 * - Debugging intégré pour détecter les fuites
 */

import * as THREE from 'three';

export class Vector3Pool {
  private static instance: Vector3Pool;
  private pool: THREE.Vector3[] = [];
  private used: Set<THREE.Vector3> = new Set();
  private readonly POOL_SIZE = 30; // Suffisant pour toute l'app

  private constructor() {
    // Pré-allouer tous les Vector3 au démarrage
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.pool.push(new THREE.Vector3());
    }
  }

  static getInstance(): Vector3Pool {
    if (!Vector3Pool.instance) {
      Vector3Pool.instance = new Vector3Pool();
    }
    return Vector3Pool.instance;
  }

  /**
   * Obtenir un Vector3 du pool (ZÉRO allocation)
   */
  get(): THREE.Vector3 {
    let vector = this.pool.pop();

    if (!vector) {
      // Pool épuisé : créer un nouveau (avec warning)
      console.warn('Vector3Pool: Pool épuisé, création d\'un nouveau Vector3');
      vector = new THREE.Vector3();
    }

    vector.set(0, 0, 0); // Reset pour usage propre
    this.used.add(vector);
    return vector;
  }

  /**
   * Remettre un Vector3 dans le pool pour réutilisation
   */
  release(vector: THREE.Vector3): void {
    if (!this.used.has(vector)) {
      console.warn('Vector3Pool: Tentative de release d\'un Vector3 non-utilisé');
      return;
    }

    this.used.delete(vector);
    this.pool.push(vector);
  }

  /**
   * Fonction utilitaire : Utiliser un Vector3 temporairement avec auto-release
   */
  use<T>(callback: (v: THREE.Vector3) => T): T {
    const vector = this.get();
    try {
      return callback(vector);
    } finally {
      this.release(vector);
    }
  }

  /**
   * Stats pour debugging
   */
  getStats() {
    return {
      available: this.pool.length,
      used: this.used.size,
      total: this.POOL_SIZE,
    };
  }
}

// Export instance singleton pour usage facile
export const vector3Pool = Vector3Pool.getInstance();