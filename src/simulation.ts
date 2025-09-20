/**
 * Simulation.ts - Point d'entrée principal de la simulation de cerf-volant
 *
 * Cette version refactorisée utilise une architecture modulaire avec séparation
 * des responsabilités pour une meilleure maintenabilité.
 */

// Réexportation de SimulationApp pour compatibilité
export { SimulationApp as Simulation } from "./app/SimulationApp";

// Export des types principaux
export type { WindParams } from "./types/wind";
export type { KiteState } from "./types/kite";
export type { HandlePositions } from "./types/controls";

// Export des composants principaux si nécessaire
export { PhysicsEngine } from "./physics/PhysicsEngine";
export { RenderManager } from "./rendering/RenderManager";
export { CONFIG } from "./config/GlobalConfig";
