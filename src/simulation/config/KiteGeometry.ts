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
import { Point } from "@/objects/Point";

/**
 * Géométrie du cerf-volant
 *
 * La forme du cerf-volant - comme un plan de construction
 * On définit où sont tous les points importants du cerf-volant
 */
export class KiteGeometry {
  // Les points clés du cerf-volant (comme les coins d'une maison)
  // Coordonnées en mètres : [gauche/droite, haut/bas, avant/arrière]
  // NOTE: Les points de contrôle CTRL_GAUCHE/CTRL_DROIT ne sont PAS définis ici.
  // Ils sont calculés dynamiquement à partir des longueurs de brides via PointFactory.
  /**
   * Converts the static POINTS to use the Point class instead of THREE.Vector3.
   */
  static readonly POINTS = {
    NEZ: new Point(0, 0.65, 0), // Le bout pointu en haut
    SPINE_BAS: new Point(0, 0, 0), // Le centre en bas
    BORD_GAUCHE: new Point(-0.825, 0, 0), // L'extrémité de l'aile gauche
    BORD_DROIT: new Point(0.825, 0, 0), // L'extrémité de l'aile droite
    WHISKER_GAUCHE: new Point(-0.4125, 0.1, -0.15), // Stabilisateur gauche
    WHISKER_DROIT: new Point(0.4125, 0.1, -0.15), // Stabilisateur droit
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

  /**
   * Calcule le centroïde (centre géométrique) d'un triangle
   * Le centroïde est situé à l'intersection des médianes du triangle
   * 
   * @param v1 Premier sommet du triangle
   * @param v2 Deuxième sommet du triangle  
   * @param v3 Troisième sommet du triangle
   * @returns Le point centroïde du triangle
   */
  static calculateTriangleCentroid(
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    v3: THREE.Vector3
  ): THREE.Vector3 {
    return v1.clone()
      .add(v2)
      .add(v3)
      .divideScalar(3);
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
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.BORD_GAUCHE.toVector3(),
        KiteGeometry.POINTS.WHISKER_GAUCHE.toVector3(),
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.BORD_GAUCHE.toVector3(),
        KiteGeometry.POINTS.WHISKER_GAUCHE.toVector3()
      ),
    },
    {
      // Surface basse gauche
      vertices: [
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.WHISKER_GAUCHE.toVector3(),
        KiteGeometry.POINTS.SPINE_BAS.toVector3(),
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.WHISKER_GAUCHE.toVector3(),
        KiteGeometry.POINTS.SPINE_BAS.toVector3()
      ),
    },
    {
      // Surface haute droite
      vertices: [
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.WHISKER_DROIT.toVector3(),
        KiteGeometry.POINTS.BORD_DROIT.toVector3(),
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.WHISKER_DROIT.toVector3(),
        KiteGeometry.POINTS.BORD_DROIT.toVector3()
      ),
    },
    {
      // Surface basse droite
      vertices: [
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.SPINE_BAS.toVector3(),
        KiteGeometry.POINTS.WHISKER_DROIT.toVector3(),
      ],
      area: KiteGeometry.calculateTriangleArea(
        KiteGeometry.POINTS.NEZ.toVector3(),
        KiteGeometry.POINTS.SPINE_BAS.toVector3(),
        KiteGeometry.POINTS.WHISKER_DROIT.toVector3()
      ),
    },
  ];

  /**
   * Subdivise un triangle en 4 sous-triangles (subdivision barycentrique simple)
   * @param v1, v2, v3 : sommets du triangle
   * @returns Tableau de 4 sous-triangles {vertices, area}
   */
  private static subdivideTriangle(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3) {
    // Calcul des milieux
    const m12 = v1.clone().add(v2).multiplyScalar(0.5);
    const m23 = v2.clone().add(v3).multiplyScalar(0.5);
    const m31 = v3.clone().add(v1).multiplyScalar(0.5);

    // 4 sous-triangles
    const tris = [
      { vertices: [v1, m12, m31] },
      { vertices: [v2, m23, m12] },
      { vertices: [v3, m31, m23] },
      { vertices: [m12, m23, m31] },
    ];
    // Ajoute l'aire à chaque sous-triangle
    return tris.map(t => ({
      vertices: t.vertices,
      area: KiteGeometry.calculateTriangleArea(t.vertices[0], t.vertices[1], t.vertices[2])
    }));
  }

  /**
   * Subdivise récursivement un triangle selon un niveau donné
   * @param v1, v2, v3 : sommets du triangle
   * @param level : niveau de subdivision (0 = pas de subdivision)
   * @returns Tableau de tous les sous-triangles
   */
  private static subdivideTriangleRecursive(
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    v3: THREE.Vector3,
    level: number
  ): { vertices: THREE.Vector3[]; area: number }[] {
    if (level <= 0) {
      // Pas de subdivision : retourner le triangle original
      return [{
        vertices: [v1, v2, v3],
        area: KiteGeometry.calculateTriangleArea(v1, v2, v3)
      }];
    }

    // Subdiviser en 4 sous-triangles
    const subTriangles = KiteGeometry.subdivideTriangle(v1, v2, v3);

    // Appliquer récursivement la subdivision à chaque sous-triangle
    const result: { vertices: THREE.Vector3[]; area: number }[] = [];
    for (const subTri of subTriangles) {
      const [sv1, sv2, sv3] = subTri.vertices;
      result.push(...KiteGeometry.subdivideTriangleRecursive(sv1, sv2, sv3, level - 1));
    }

    return result;
  }

  /**
   * Subdivision du maillage pour améliorer la précision aérodynamique.
   *
   * POURQUOI LA SUBDIVISION :
   * - Un triangle unique ne peut avoir qu'une seule normale → angle d'attaque uniforme
   * - Avec subdivision, chaque sous-triangle peut avoir un angle d'attaque local différent
   * - Permet de capturer les variations spatiales du vent et de la courbure virtuelle
   * - Améliore le réalisme des couples aérodynamiques distribués
   *
   * COÛT PERFORMANCE :
   * - Niveau 0 : 4 triangles (rapide, peu précis)
   * - Niveau 1 : 16 triangles (bon compromis)
   * - Niveau 2 : 64 triangles (précis, coût modéré) ← recommandé
   * - Niveau 3 : 256 triangles (très précis, coûteux)
   * - Niveau 4+ : 1024+ triangles (impact performance significatif)
   */

  /**
   * Niveau de subdivision actuel du maillage
   * Par défaut niveau 1 (16 triangles), peut être changé via setMeshSubdivisionLevel()
   */
  private static meshSubdivisionLevel: number = 1; // Niveau par défaut, sera initialisé depuis CONFIG dans SimulationApp

  /**
   * Cache typé des surfaces subdivisées
   */
  private static _subdividedSurfaces: { vertices: THREE.Vector3[]; area: number }[] | null = null;

  /**
   * Constantes pour la subdivision
   */
  private static readonly MAX_SUBDIVISION_LEVEL = 3; // Limite raisonnable pour éviter surcharge

  /**
   * Calcule le nombre de triangles par surface originale pour un niveau donné
   * Formule : 4^niveau (car chaque subdivision découpe en 4)
   *
   * @param level - Niveau de subdivision (0, 1, 2, 3...)
   * @returns Nombre de sous-triangles par surface originale
   *
   * @example
   * TRIANGLES_PER_SURFACE_AT_LEVEL(0) → 1 triangle
   * TRIANGLES_PER_SURFACE_AT_LEVEL(1) → 4 triangles
   * TRIANGLES_PER_SURFACE_AT_LEVEL(2) → 16 triangles
   * TRIANGLES_PER_SURFACE_AT_LEVEL(3) → 64 triangles
   */
  static TRIANGLES_PER_SURFACE_AT_LEVEL(level: number): number {
    return Math.pow(4, level);
  }

  /**
   * Modifie le niveau de subdivision du maillage
   *
   * @param level - Niveau de subdivision (0=4 triangles, 1=16, 2=64, 3=256)
   *
   * IMPORTANT : Des niveaux élevés (>3) peuvent causer des problèmes de performance.
   * Le niveau est automatiquement limité à MAX_SUBDIVISION_LEVEL (3).
   */
  static setMeshSubdivisionLevel(level: number): void {
    // Clamper entre 0 et MAX
    const clampedLevel = Math.max(0, Math.min(level, KiteGeometry.MAX_SUBDIVISION_LEVEL));

    // Warning si niveau trop élevé
    if (level > KiteGeometry.MAX_SUBDIVISION_LEVEL) {
      const totalTriangles = KiteGeometry.SURFACES.length * KiteGeometry.TRIANGLES_PER_SURFACE_AT_LEVEL(level);
      console.warn(
        `⚠️ Niveau de subdivision ${level} trop élevé (${totalTriangles} triangles).\n` +
        `Limité à ${KiteGeometry.MAX_SUBDIVISION_LEVEL} pour éviter surcharge performance.\n` +
        `Si vous avez vraiment besoin de plus, augmentez MAX_SUBDIVISION_LEVEL.`
      );
    }

    if (clampedLevel !== KiteGeometry.meshSubdivisionLevel) {
      KiteGeometry.meshSubdivisionLevel = clampedLevel;
      // Invalider le cache des surfaces subdivisées
      KiteGeometry._subdividedSurfaces = null;

      const totalTriangles = KiteGeometry.SURFACES.length * KiteGeometry.TRIANGLES_PER_SURFACE_AT_LEVEL(clampedLevel);
      console.log(`🔧 Maillage subdivisé : niveau ${clampedLevel} → ${totalTriangles} triangles au total`);
    }
  }

  /**
   * Retourne le niveau de subdivision actuel du maillage
   */
  static getMeshSubdivisionLevel(): number {
    return KiteGeometry.meshSubdivisionLevel;
  }

  /**
   * Maillage fin : tous les sous-triangles du kite selon le niveau de subdivision configuré
   *
   * CACHE : Les surfaces sont calculées une seule fois puis mises en cache.
   * Le cache est invalidé automatiquement quand le niveau change.
   *
   * @returns Tableau de tous les sous-triangles avec leurs vertices et aires
   */
  static get SUBDIVIDED_SURFACES(): { vertices: THREE.Vector3[]; area: number }[] {
    if (!KiteGeometry._subdividedSurfaces) {
      KiteGeometry._subdividedSurfaces = KiteGeometry.SURFACES.flatMap(surface =>
        KiteGeometry.subdivideTriangleRecursive(
          surface.vertices[0],
          surface.vertices[1],
          surface.vertices[2],
          KiteGeometry.meshSubdivisionLevel
        )
      );
    }
    return KiteGeometry._subdividedSurfaces;
  }

  // Calcul automatique de la surface totale
  static readonly TOTAL_AREA = KiteGeometry.SURFACES.reduce(
    (sum, surface) => sum + surface.area,
    0
  );  // ============================================================================
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
      ripstop: 40,     // Ripstop nylon standard (corrigé de 40)
    },
    // Accessoires (masse en grammes)
    accessories: {
      connectorsLeadingEdge: 1,  // Connecteurs pour les bords d'attaque
      connectorCenterT: 1,       // Connecteur central en T
      connectorsStruts: 1,       // Connecteurs pour les struts
      bridleSystem: 1,          // Système de brides complet
      reinforcements: 1,        // Renforts et coutures
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
   * 🔴 BUG FIX #2 : Distribution masse frame selon géométrie RÉELLE
   * 
   * Topologie du kite (4 surfaces triangulaires) :
   *   Surface 0 (haute gauche)  : NEZ → BORD_GAUCHE → WHISKER_GAUCHE
   *   Surface 1 (basse gauche)  : NEZ → WHISKER_GAUCHE → SPINE_BAS
   *   Surface 2 (haute droite)  : NEZ → BORD_DROIT → WHISKER_DROIT
   *   Surface 3 (basse droite)  : NEZ → WHISKER_DROIT → SPINE_BAS
   * 
   * Attribution des segments de frame aux surfaces :
   *   - Spine (NEZ → SPINE_BAS) : partagée 50/50 entre hautes et basses
   *   - Leading edge gauche (NEZ → BORD_GAUCHE) : 100% surface 0
   *   - Leading edge droit (NEZ → BORD_DROIT) : 100% surface 2
   *   - Strut gauche (BORD_GAUCHE → WHISKER_GAUCHE) : partagé surface 0/1
   *   - Strut droit (BORD_DROIT → WHISKER_DROIT) : partagé surface 2/3
   *   - Spreader (WHISKER_GAUCHE → WHISKER_DROIT) : partagé entre toutes
   * 
   * @returns Tableau de 4 masses (kg) pour chaque surface
   */
  private static calculateFrameMassDistribution(): number[] {
    const specs = KiteGeometry.MATERIAL_SPECS.carbon;
    
    // Masses linéiques (kg/m)
    const spineUnitMass = specs.spine / 1000;        // g/m → kg/m
    const leadingEdgeUnitMass = specs.leadingEdge / 1000;
    const strutUnitMass = specs.strut / 1000;
    
    // Longueurs individuelles des segments
    const spineLength = KiteGeometry.POINTS.NEZ.distanceTo(KiteGeometry.POINTS.SPINE_BAS);
    const leadingEdgeLeft = KiteGeometry.POINTS.NEZ.distanceTo(KiteGeometry.POINTS.BORD_GAUCHE);
    const leadingEdgeRight = KiteGeometry.POINTS.NEZ.distanceTo(KiteGeometry.POINTS.BORD_DROIT);
    const strutLeft = KiteGeometry.POINTS.BORD_GAUCHE.distanceTo(KiteGeometry.POINTS.WHISKER_GAUCHE);
    const strutRight = KiteGeometry.POINTS.BORD_DROIT.distanceTo(KiteGeometry.POINTS.WHISKER_DROIT);
    const spreader = KiteGeometry.POINTS.WHISKER_GAUCHE.distanceTo(KiteGeometry.POINTS.WHISKER_DROIT);
    /**
     * Subdivise un triangle en 4 sous-triangles (subdivision barycentrique simple)
     * @param v1, v2, v3 : sommets du triangle
     * @returns Tableau de 4 sous-triangles {vertices, area}
     */

    // Masses individuelles des segments
    const spineMass = spineLength * spineUnitMass;
    const leadingEdgeLeftMass = leadingEdgeLeft * leadingEdgeUnitMass;
    const leadingEdgeRightMass = leadingEdgeRight * leadingEdgeUnitMass;
    const strutLeftMass = strutLeft * strutUnitMass;
    const strutRightMass = strutRight * strutUnitMass;
    const spreaderMass = spreader * strutUnitMass;
    
    // Attribution géométrique réaliste aux surfaces
    const frameMasses = [
      // Surface 0 (haute gauche) : spine + leading edge gauche + strut gauche + spreader
      (spineMass * 0.25) +          // 25% spine (partagée entre 4 surfaces)
      leadingEdgeLeftMass +         // 100% leading edge gauche
      (strutLeftMass * 0.5) +       // 50% strut gauche (partie haute)
      (spreaderMass * 0.25),        // 25% spreader (coin gauche)

      // Surface 1 (basse gauche) : spine + strut gauche + spreader
      (spineMass * 0.25) +          // 25% spine (partagée entre 4 surfaces)
      (strutLeftMass * 0.5) +       // 50% strut gauche (partie basse)
      (spreaderMass * 0.25),        // 25% spreader (coin gauche)

      // Surface 2 (haute droite) : spine + leading edge droit + strut droit + spreader
      (spineMass * 0.25) +          // 25% spine (partagée entre 4 surfaces)
      leadingEdgeRightMass +        // 100% leading edge droit
      (strutRightMass * 0.5) +      // 50% strut droit (partie haute)
      (spreaderMass * 0.25),        // 25% spreader (coin droit)

      // Surface 3 (basse droite) : spine + strut droit + spreader
      (spineMass * 0.25) +          // 25% spine (partagée entre 4 surfaces)
      (strutRightMass * 0.5) +      // 50% strut droit (partie basse)
      (spreaderMass * 0.25),        // 25% spreader (coin droit)
    ];
    
    return frameMasses;
  }

  /**
   * Distribution de la masse sur les surfaces
   * Chaque surface porte une fraction de la masse totale
   * 
   * Modèle physique CORRIGÉ :
   * - Masse de tissu (fabric) : Distribuée proportionnellement à l'aire
   * - Masse de frame : Distribuée selon géométrie réelle (🔴 BUG FIX #2)
   * - Masse d'accessoires : Distribuée uniformément sur les 4 surfaces
   * 
   * @returns Masse de chaque surface en kg
   */
  static calculateSurfaceMasses(): number[] {
    const fabricMass = KiteGeometry.calculateFabricMass();
    const frameMasses = KiteGeometry.calculateFrameMassDistribution();  // 🔴 BUG FIX #2
    const accessoriesMass = KiteGeometry.calculateAccessoriesMass();
    
    // Accessoires répartis uniformément (connecteurs dispersés sur tout le kite)
    const uniformAccessories = accessoriesMass / KiteGeometry.SURFACES.length;
    
    // La masse de tissu est répartie proportionnellement à l'aire
    return KiteGeometry.SURFACES.map((surface, index) => {
      const fabricMassRatio = surface.area / KiteGeometry.TOTAL_AREA;
      const surfaceFabricMass = fabricMass * fabricMassRatio;
      
      return surfaceFabricMass + frameMasses[index] + uniformAccessories;
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
    // Constantes pour calcul d'inertie (éviter dépendance circulaire avec CONFIG)
    const GYRATION_DIVISOR = Math.sqrt(2); // wingspan / √2 pour forme delta (triangle isocèle)

    // Rayon de giration correct pour forme delta wing
    // Formule réaliste : r = wingspan / √2 (au lieu de /4)
    // Référence : géométrie d'un triangle isocèle
    const wingspan =
      KiteGeometry.POINTS.BORD_GAUCHE.distanceTo(
        KiteGeometry.POINTS.BORD_DROIT
      );
    const radiusOfGyration = wingspan / GYRATION_DIVISOR;  // ≈ 1.167 m au lieu de 0.4125 m

    const physicalInertia = KiteGeometry.TOTAL_MASS * radiusOfGyration * radiusOfGyration;

    // 🔧 FIX INERTIE: Factor 0.1 pour réactivité immédiate au vent
    // Le kite doit être "emporté" par le vent, pas résister par inertie
    // Factor 0.1 ramène à ~0.042 kg·m² (très réactif, comme un tissu léger)
    const REACTIVE_INERTIA_FACTOR = 0.1;
    return physicalInertia * REACTIVE_INERTIA_FACTOR;
  }

  /**
   * Moment d'inertie calculé automatiquement
   */
  static readonly INERTIA = KiteGeometry.calculateInertia();
}
