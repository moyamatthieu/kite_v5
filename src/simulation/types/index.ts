
/**
 * index.ts - Export centralisé de tous les types de la simulation Kite
 *
 * Rôle :
 *   - Centralise l'export des types physiques et de vent
 *   - Permet d'importer tous les types depuis un seul point
 *
 * Dépendances principales :
 *   - PhysicsTypes.ts : Types pour la physique
 *   - WindTypes.ts : Types pour le vent
 *
 * Relation avec les fichiers adjacents :
 *   - Sert de point d'entrée pour tous les imports de types dans le projet
 *
 * Utilisation typique :
 *   - Importé dans les modules physiques, de rendu, de configuration, etc.
 *   - Facilite la maintenance et la cohérence des types
 *
 * Voir aussi :
 *   - src/simulation/types/PhysicsTypes.ts
 *   - src/simulation/types/WindTypes.ts
 */

export * from './PhysicsTypes';
export * from './WindTypes';