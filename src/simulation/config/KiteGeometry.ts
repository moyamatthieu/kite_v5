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

  /**
   * Calcule l'aire d'un triangle 3D à partir de ses 3 sommets
   * Utilise la formule : Aire = 0.5 × ||AB × AC||
   * 
   * @param v1 Premier sommet du triangle
   * @param v2 Deuxième sommet du triangle
   * @param v3 Troisième sommet du triangle
   * @returns L'aire du triangle en m²
   */
  private static calculateTriangleArea(
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    v3: THREE.Vector3
  ): number {
    // Créer deux vecteurs représentant deux côtés du triangle
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    
    // Le produit vectoriel donne un vecteur perpendiculaire
    // dont la longueur = aire du parallélogramme formé par edge1 et edge2
    const cross = new THREE.Vector3().crossVectors(edge1, edge2);
    
    // L'aire du triangle = la moitié de l'aire du parallélogramme
    return cross.length() / 2;
  }

  // Le cerf-volant est fait de 4 triangles de tissu
  // Chaque triangle a 3 coins (vertices) et une surface en mètres carrés
  //
  // ORDRE DES VERTICES (règle main droite) :
  // Les normales doivent pointer vers l'ARRIÈRE (Z positif) pour recevoir le vent
  // qui vient de l'arrière (direction -Z).
  // Order : sens horaire vu de l'arrière = normale vers l'arrière
  //
  // NOTE : Les aires sont calculées automatiquement à partir de la géométrie réelle
  // pour garantir la cohérence physique
  static readonly SURFACES = [
    {
      // Surface haute gauche (normale doit pointer vers arrière)
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.BORD_GAUCHE,
        KiteGeometry.POINTS.WHISKER_GAUCHE,
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.BORD_GAUCHE,
        KiteGeometry.POINTS.WHISKER_GAUCHE
      ),
    },
    {
      // Surface basse gauche
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.WHISKER_GAUCHE,
        KiteGeometry.POINTS.SPINE_BAS,
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.WHISKER_GAUCHE,
        KiteGeometry.POINTS.SPINE_BAS
      ),
    },
    {
      // Surface haute droite
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.BORD_DROIT,
        KiteGeometry.POINTS.WHISKER_DROIT,
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.BORD_DROIT,
        KiteGeometry.POINTS.WHISKER_DROIT
      ),
    },
    {
      // Surface basse droite
      vertices: [
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.WHISKER_DROIT,
        KiteGeometry.POINTS.SPINE_BAS,
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ,
        KiteGeometry.POINTS.WHISKER_DROIT,
        KiteGeometry.POINTS.SPINE_BAS
      ),
    },
  ];

  // Calcul automatique de la surface totale
  static readonly TOTAL_AREA = KiteGeometry.SURFACES.reduce(
    (sum, surface) => sum + surface.area,
    0
  );
}
