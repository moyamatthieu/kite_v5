/**
 * ControlBarConfig.ts - Configuration de la barre de contrôle
 */

import * as THREE from "three";

export const CONTROL_BAR_CONFIG = {
  width: 0.6, // m - Largeur de la barre
  position: new THREE.Vector3(0, 1.2, 8), // Position initiale

  // Physique du retour automatique à l'équilibre
  springConstant: 2.0, // N·m/rad - Raideur du ressort (force de rappel)
  damping: 0.8, // N·m·s/rad - Amortissement (freine les oscillations)
  mass: 0.1, // kg - Masse de la barre (inertie)
  deadzone: 0.01, // rad - Zone morte pour éviter les micro-mouvements
};
