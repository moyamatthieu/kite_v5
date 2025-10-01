/**
 * KiteGeometry.ts - Définition de la géométrie du cerf-volant pour la simulation Kite
 *
 * Rôle :
 *   - Définit la forme, les points anatomiques et les surfaces du cerf-volant
 *   - Sert de plan de construction pour tous les calculs physiques et graphiques
 *   - Utilisé pour le calcul des forces, la création du modèle 3D et la configuration
 *
 * Dépendances principales :
 *   - Three.js : Utilisé pour les coordonnées et la géométrie
 *
 * Relation avec les fichiers adjacents :
 *   - SimulationConfig.ts : Utilise KiteGeometry pour la surface et les points
 *   - Tous les modules physiques et graphiques utilisent KiteGeometry pour les calculs
 *
 * Utilisation typique :
 *   - Importé dans les modules de physique, de rendu et de configuration
 *   - Sert à positionner les points et surfaces du kite
 *
 * Voir aussi :
 *   - src/simulation/config/SimulationConfig.ts
 */
import * as THREE from "three";

/**
 * Géométrie du cerf-volant
 *
 * La forme du cerf-volant - comme un plan de construction
 * On définit où sont tous les points importants du cerf-volant
 */
export class KiteGeometry {
  // Les points clés du cerf-volant (comme les coins d'une maison)
  // Coordonnées en mètres : [gauche/droite, haut/bas, avant/arrière]
  static readonly POINTS = {
    NEZ: new THREE.Vector3(0, 0.65, 0), // Le bout pointu en haut
    SPINE_BAS: new THREE.Vector3(0, 0, 0), // Le centre en bas
    BORD_GAUCHE: new THREE.Vector3(-0.825, 0, 0), // L'extrémité de l'aile gauche
    BORD_DROIT: new THREE.Vector3(0.825, 0, 0), // L'extrémité de l'aile droite
    WHISKER_GAUCHE: new THREE.Vector3(-0.4125, 0.1, -0.15), // Stabilisateur gauche (légèrement en arrière)
    WHISKER_DROIT: new THREE.Vector3(0.4125, 0.1, -0.15), // Stabilisateur droit (légèrement en arrière)
    CTRL_GAUCHE: new THREE.Vector3(-0.15, 0.3, 0.4), // Où s'attache la ligne gauche
    CTRL_DROIT: new THREE.Vector3(0.15, 0.3, 0.4), // Où s'attache la ligne droite
  };

  // Le cerf-volant est fait de 4 triangles de tissu
  // Chaque triangle a 3 coins (vertices) et une surface en mètres carrés
  // NOTE: vertex order chosen so que la normale de chaque triangle ait
  // une composante Y positive (vers le haut). Ceci favorise une portance
  // ascendante plutôt qu'une force dirigée vers le bas due à une
  // orientation de surface inversée.
  static readonly SURFACES = [
    {
      // Surface haute gauche - inversion des deux derniers sommets
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.WHISKER_GAUCHE,
        KiteGeometry.POINTS.BORD_GAUCHE,
      ],
      area: 0.23, // m² - Surface haute gauche
    },
    {
      // Surface basse gauche
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.SPINE_BAS,
        KiteGeometry.POINTS.WHISKER_GAUCHE,
      ],
      area: 0.11, // m² - Surface basse gauche
    },
    {
      // Surface haute droite - inversion symétrique
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.WHISKER_DROIT,
        KiteGeometry.POINTS.BORD_DROIT,
      ],
      area: 0.23, // m² - Surface haute droite
    },
    {
      // Surface basse droite
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.SPINE_BAS,
        KiteGeometry.POINTS.WHISKER_DROIT,
      ],
      area: 0.11, // m² - Surface basse droite
    },
  ];

  static readonly TOTAL_AREA = 0.68; // m² - Surface totale
}