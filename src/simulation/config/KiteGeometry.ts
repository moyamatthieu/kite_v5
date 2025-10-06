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
  //
  // NOTE : Les masses sont calculées après, voir SURFACES_WITH_MASS ci-dessous
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

  // ============================================================================
  // CALCUL AUTOMATIQUE DE LA MASSE DU CERF-VOLANT
  // ============================================================================

  /**
   * Spécifications des matériaux utilisés pour calculer la masse
   * Basé sur des composants réels de kites sport/stunt
   *
   * CORRECTION: Grammages augmentés pour atteindre masse réaliste de 0.3-0.4 kg
   * (Précédente masse calculée de ~0.153 kg était ×2.5 trop légère)
   */
  private static readonly MATERIAL_SPECS = {
    // Tubes de carbone (masse linéique en g/m)
    carbon: {
      spine: 10,        // 5mm diamètre renforcé (corrigé de 10)
      leadingEdge: 10,  // 5mm diamètre standard (corrigé de 10)
      strut: 4,         // 4mm diamètre léger (corrigé de 2)
    },
    // Tissu (grammage en g/m²)
    fabric: {
      ripstop: 120,     // Ripstop nylon standard (corrigé de 40)
    },
    // Accessoires (masse fixe en grammes)
    accessories: {
      connectorsLeadingEdge: 15,  // 2× connecteurs @ 7.5g
      connectorCenterT: 12,        // 1× connecteur T central
      connectorsStruts: 18,        // 4× connecteurs @ 4.5g
      bridleSystem: 25,            // Système de bridage complet
      reinforcements: 20,          // Renforts aux points de tension
    },
  };

  /**
   * Calcule la longueur totale de tous les tubes de la frame
   * @returns Objet contenant les longueurs par type de tube et le total
   */
  private static calculateFrameLengths(): {
    spine: number;
    leadingEdges: number;
    struts: number;
    total: number;
  } {
    const spine = KiteGeometry.POINTS.NEZ.distanceTo(
      KiteGeometry.POINTS.SPINE_BAS
    );

    const leadingEdgeLeft = KiteGeometry.POINTS.NEZ.distanceTo(
      KiteGeometry.POINTS.BORD_GAUCHE
    );
    const leadingEdgeRight = KiteGeometry.POINTS.NEZ.distanceTo(
      KiteGeometry.POINTS.BORD_DROIT
    );
    const leadingEdges = leadingEdgeLeft + leadingEdgeRight;

    const strutLeft = KiteGeometry.POINTS.BORD_GAUCHE.distanceTo(
      KiteGeometry.POINTS.WHISKER_GAUCHE
    );
    const strutRight = KiteGeometry.POINTS.BORD_DROIT.distanceTo(
      KiteGeometry.POINTS.WHISKER_DROIT
    );
    const spreader = KiteGeometry.POINTS.WHISKER_GAUCHE.distanceTo(
      KiteGeometry.POINTS.WHISKER_DROIT
    );
    const struts = strutLeft + strutRight + spreader;

    return {
      spine,
      leadingEdges,
      struts,
      total: spine + leadingEdges + struts,
    };
  }

  /**
   * Calcule la masse de la structure (frame) en carbone
   * @returns Masse en kilogrammes
   */
  private static calculateFrameMass(): number {
    const lengths = KiteGeometry.calculateFrameLengths();
    const specs = KiteGeometry.MATERIAL_SPECS.carbon;

    const spineMass = lengths.spine * specs.spine;
    const leadingEdgesMass = lengths.leadingEdges * specs.leadingEdge;
    const strutsMass = lengths.struts * specs.strut;

    // Somme en grammes, conversion en kg
    return (spineMass + leadingEdgesMass + strutsMass) / 1000;
  }

  /**
   * Calcule la masse du tissu (voile)
   * @returns Masse en kilogrammes
   */
  private static calculateFabricMass(): number {
    const grammage = KiteGeometry.MATERIAL_SPECS.fabric.ripstop;
    // Surface en m² × grammage en g/m² → conversion en kg
    return (KiteGeometry.TOTAL_AREA * grammage) / 1000;
  }

  /**
   * Calcule la masse totale des accessoires
   * @returns Masse en kilogrammes
   */
  private static calculateAccessoriesMass(): number {
    const acc = KiteGeometry.MATERIAL_SPECS.accessories;
    const total =
      acc.connectorsLeadingEdge +
      acc.connectorCenterT +
      acc.connectorsStruts +
      acc.bridleSystem +
      acc.reinforcements;

    // Conversion g → kg
    return total / 1000;
  }

  /**
   * Calcule la masse totale du cerf-volant (frame + tissu + accessoires)
   * Calculée automatiquement depuis la géométrie et les spécifications matériaux
   * @returns Masse en kilogrammes
   */
  static calculateTotalMass(): number {
    return (
      KiteGeometry.calculateFrameMass() +
      KiteGeometry.calculateFabricMass() +
      KiteGeometry.calculateAccessoriesMass()
    );
  }

  /**
   * Masse totale du cerf-volant calculée automatiquement
   * Basée sur la géométrie réelle et les matériaux standards
   */
  static readonly TOTAL_MASS = KiteGeometry.calculateTotalMass();

  /**
   * Distribution de la masse sur les surfaces
   * Chaque surface porte une fraction de la masse totale proportionnelle à son aire
   * 
   * Modèle physique :
   * - Masse de tissu (fabric) : Distribuée proportionnellement à l'aire
   * - Masse de frame : Distribuée uniformément sur les 4 surfaces
   * - Masse d'accessoires : Distribuée uniformément sur les 4 surfaces
   * 
   * @returns Masse de chaque surface en kg
   */
  static calculateSurfaceMasses(): number[] {
    const fabricMass = KiteGeometry.calculateFabricMass();
    const frameMass = KiteGeometry.calculateFrameMass();
    const accessoriesMass = KiteGeometry.calculateAccessoriesMass();
    
    // La masse de frame + accessoires est répartie uniformément
    const uniformMassPerSurface = (frameMass + accessoriesMass) / KiteGeometry.SURFACES.length;
    
    // La masse de tissu est répartie proportionnellement à l'aire
    return KiteGeometry.SURFACES.map(surface => {
      const fabricMassRatio = surface.area / KiteGeometry.TOTAL_AREA;
      const surfaceFabricMass = fabricMass * fabricMassRatio;
      return surfaceFabricMass + uniformMassPerSurface;
    });
  }

  /**
   * Masses précalculées pour chaque surface (en kg)
   * Index correspond à l'index dans SURFACES
   */
  static readonly SURFACE_MASSES = KiteGeometry.calculateSurfaceMasses();

  /**
   * Surfaces enrichies avec leur masse individuelle
   * Utilisées par AerodynamicsCalculator pour appliquer la gravité distribuée
   */
  static readonly SURFACES_WITH_MASS = KiteGeometry.SURFACES.map((surface, index) => ({
    ...surface,
    mass: KiteGeometry.SURFACE_MASSES[index],
  }));

  /**
   * Calcule le moment d'inertie approximatif du cerf-volant
   * Utilise la formule simplifiée : I ≈ m × r²
   * où r est le rayon de giration moyen
   * @returns Moment d'inertie en kg·m²
   */
  static calculateInertia(): number {
    // Rayon de giration correct pour forme delta wing
    // Formule réaliste : r = wingspan / √2 (au lieu de /4)
    // Référence : géométrie d'un triangle isocèle
    const wingspan =
      KiteGeometry.POINTS.BORD_GAUCHE.distanceTo(
        KiteGeometry.POINTS.BORD_DROIT
      );
    const radiusOfGyration = wingspan / Math.sqrt(2);  // ≈ 1.167 m au lieu de 0.4125 m

    return KiteGeometry.TOTAL_MASS * radiusOfGyration * radiusOfGyration;
  }

  /**
   * Moment d'inertie calculé automatiquement
   */
  static readonly INERTIA = KiteGeometry.calculateInertia();
}
