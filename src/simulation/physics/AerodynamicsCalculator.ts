/**
 * AerodynamicsCalculator.ts - Calculateur de forces aérodynamiques distribuées
 *
 * Calcule les forces aérodynamiques (portance, traînée) et gravitationnelles 
 * distribuées sur chaque surface du kite selon les principes de la mécanique des fluides.
 *
 * Modèle physique amélioré :
 *   - Coefficients réalistes basés sur données expérimentales (NACA, etc.)
 *   - Modélisation du stall (décrochage) à forts angles d'incidence
 *   - Centre de pression dynamique
 *   - Effets de turbulence et amortissement aérodynamique
 *
 * @see PhysicsEngine.ts - Utilise les forces calculées
 * @see KiteGeometry.ts - Définit les surfaces et masses
 */
import * as THREE from "three";

import { KiteGeometry } from "../config/KiteGeometry";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";
import { SurfaceForce } from "../types/PhysicsTypes";

/**
 * Calculateur de forces aérodynamiques amélioré
 *
 * Calcule comment le vent pousse sur le cerf-volant selon sa forme et orientation
 */
export class AerodynamicsCalculator {
  // Constantes de calculs aérodynamiques
  private static readonly HALF_AIR_DENSITY = 0.5 * CONFIG.physics.airDensity;
  private static readonly MIN_WIND_SPEED = 0.01; // m/s - seuil minimal pour calculs aéro

  // Utiliser désormais les coefficients issus de CONFIG (évite magic numbers)

  /**
   * 🎯 CALCUL SIMPLE DES COEFFICIENTS AÉRODYNAMIQUES
   *
   * Modèle basique pour plaque plane (cerf-volant) :
   * - Portance proportionnelle à sin(α) × cos(α)
   * - Traînée proportionnelle à sin²(α)
   * - Pas de stall, pas de complexité inutile
   *
   * @param alpha Angle d'incidence en radians
   * @returns Coefficients CL (portance) et CD (traînée)
   */
  private static calculateAerodynamicCoefficients(alpha: number): { CL: number; CD: number } {
    // Modèle simple plaque plane
    const sinAlpha = Math.sin(alpha);
    const cosAlpha = Math.cos(alpha);

    // Portance : CL = 2 × sin(α) × cos(α) = sin(2α)
    const CL = 2.0 * sinAlpha * cosAlpha;

    // Traînée : CD = 2 × sin²(α)
    const CD = 2.0 * sinAlpha * sinAlpha;

    return { CL, CD };
  }

  /**
   * 🎯 CALCUL SIMPLE DES FORCES POUR UNE FACE TRIANGULAIRE
   *
   * Fonction encapsulée qui prend tous les paramètres nécessaires
   * et retourne les forces (portance + traînée) à appliquer.
   *
   * @param windVector Vecteur vent apparent (direction + vitesse)
   * @param surfaceNormal Normale unitaire de la surface
   * @param surfaceArea Aire de la surface en m²
   * @returns Forces de portance et traînée
   */
  private static calculateSurfaceForces(
    windVector: THREE.Vector3,
    surfaceNormal: THREE.Vector3,
    surfaceArea: number
  ): { liftForce: THREE.Vector3; dragForce: THREE.Vector3 } {
    const windSpeed = windVector.length();
    if (windSpeed < AerodynamicsCalculator.MIN_WIND_SPEED) {
      return {
        liftForce: new THREE.Vector3(),
        dragForce: new THREE.Vector3()
      };
    }

    const windDir = windVector.clone().normalize();

    // Angle d'incidence : angle entre vent et normale
    const windDotNormal = windDir.dot(surfaceNormal);
    const alpha = Math.acos(Math.abs(windDotNormal)); // Angle en radians

    // Si vent parallèle à la surface, pas de force
    if (Math.abs(windDotNormal) < PhysicsConstants.EPSILON) {
      return {
        liftForce: new THREE.Vector3(),
        dragForce: new THREE.Vector3()
      };
    }

    // Coefficients aérodynamiques basiques
    const { CL, CD } = this.calculateAerodynamicCoefficients(alpha);

    // Pression dynamique : ½ρv²
    const dynamicPressure = 0.5 * CONFIG.physics.airDensity * windSpeed * windSpeed;

    // Magnitudes des forces
    const liftMagnitude = dynamicPressure * surfaceArea * CL;
    const dragMagnitude = dynamicPressure * surfaceArea * CD;

    // Direction de la portance : perpendiculaire au vent dans plan (vent, normale)
    const windFacingNormal = windDotNormal >= 0 ? surfaceNormal.clone() : surfaceNormal.clone().negate();
    const liftDir = windFacingNormal.clone()
      .sub(windDir.clone().multiplyScalar(windFacingNormal.dot(windDir)))
      .normalize();

    // Direction de traînée : parallèle au vent
    const dragDir = windDir.clone();

    // Forces finales
    const liftForce = liftDir.multiplyScalar(liftMagnitude);
    const dragForce = dragDir.multiplyScalar(dragMagnitude);

    return { liftForce, dragForce };
  }

  /**
   * Calcule le couple (moment) d'une force appliquée à un point
   * Méthode utilitaire pour éviter la répétition de new THREE.Vector3().crossVectors()
   */
  private static calculateTorque(lever: THREE.Vector3, force: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3().crossVectors(lever, force);
  }

  /**
   * (Supprimé) Amortissement aérodynamique explicite: on laisse le couple émerger uniquement des forces.
   */

  /**
   * Centre de pression simplifié: toujours le centroïde géométrique.
   * (dynamicCP supprimé pour un modèle purement émergent et plus simple à régler)
   */
  private static calculateCenterOfPressure(
    _surface: any,
    _alpha: number,
    centroid: THREE.Vector3
  ): THREE.Vector3 {
    return centroid.clone();
  }
  /**
   * Calcule la normale d'un triangle dans l'espace monde
   * Méthode utilitaire pour éviter la duplication de code
   *
   * @param surface - Surface triangulaire avec vertices
   * @param kiteOrientation - Quaternion d'orientation du kite (optionnel)
   * @returns Vecteur normal unitaire dans l'espace monde
   */
  private static calculateSurfaceNormal(
    surface: { vertices: THREE.Vector3[] },
    kiteOrientation?: THREE.Quaternion
  ): THREE.Vector3 {
    // Calcul des arêtes du triangle
    const edge1 = surface.vertices[1].clone().sub(surface.vertices[0]);
    const edge2 = surface.vertices[2].clone().sub(surface.vertices[0]);
    
    // Normale locale (produit vectoriel normalisé)
    const normal = new THREE.Vector3()
      .crossVectors(edge1, edge2)
      .normalize();
    
    // Transformation dans l'espace monde si orientation fournie
    return kiteOrientation ? normal.applyQuaternion(kiteOrientation) : normal;
  }

  /**
   * Calcule comment le vent pousse sur le cerf-volant
   *
   * COMMENT ÇA MARCHE :
   * 1. On regarde chaque triangle du cerf-volant
   * 2. On calcule sous quel angle le vent frappe ce triangle
   * 3. Plus le vent frappe de face, plus la force est grande
   * 4. On additionne toutes les forces pour avoir la force totale
   *
   * POURQUOI C'EST IMPORTANT :
   * Si un côté du kite reçoit plus de vent, il sera poussé plus fort
   * Cette différence fait tourner le kite naturellement !
   */
  static calculateForces(
    apparentWind: THREE.Vector3,
    kiteOrientation: THREE.Quaternion,
    kitePosition?: THREE.Vector3,
    _kiteVelocity?: THREE.Vector3,
    _angularVelocity?: THREE.Vector3
  ): {
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    gravity: THREE.Vector3;  // Gravité distribuée par surface
    torque: THREE.Vector3;
    leftForce?: THREE.Vector3;
    rightForce?: THREE.Vector3;
    surfaceForces: SurfaceForce[];
  } {
    const windSpeed = apparentWind.length();
    if (windSpeed < 0.1) {
      return {
        lift: new THREE.Vector3(),
        drag: new THREE.Vector3(),
        gravity: new THREE.Vector3(),  // Pas de gravité si vent nul
        torque: new THREE.Vector3(),
        surfaceForces: [],
      };
    }

    apparentWind.clone().normalize();
    AerodynamicsCalculator.HALF_AIR_DENSITY * windSpeed * windSpeed;

    // Forces séparées pour gauche et droite
    const leftForce = new THREE.Vector3();
    const rightForce = new THREE.Vector3();
    const totalForce = new THREE.Vector3();
    const totalTorque = new THREE.Vector3();
    
    // Accumulation des forces par type (formules plaque plane : CL = sin(α)×cos(α), CD = sin²(α))
    const totalLift = new THREE.Vector3();      // Portance totale
    const totalDrag = new THREE.Vector3();      // Traînée totale
    const gravityForce = new THREE.Vector3();   // Gravité distribuée par surface/frame
    
    // Séparation couples aéro et gravité pour scaling cohérent
    const aeroTorque = new THREE.Vector3();
    const gravityTorque = new THREE.Vector3();
    
    // Collection des forces par surface pour le debug
    const surfaceForces: SurfaceForce[] = [];

  // Modèle physique :
  // - Les forces aérodynamiques (portance, traînée) sont calculées et appliquées pour chaque surface triangulaire
  // - La masse de chaque surface est proportionnelle à son aire
  // - Les forces sont appliquées au centre géométrique du triangle (barycentre)
  // - Les couples émergent naturellement de la distribution spatiale des forces
  // - Voir PHYSICS_MODEL.md §4.2 pour les équations et principes
  // On examine chaque triangle du cerf-volant un par un
  // C'est comme vérifier comment le vent frappe chaque panneau d'un parasol
    KiteGeometry.SUBDIVIDED_SURFACES.forEach((surface, surfaceIndex) => {
      // 🎯 CALCUL SIMPLE ET PROPRE pour chaque face triangulaire

      // 1. Distribuer la masse proportionnellement à l'aire
      const trianglesPerSurface = KiteGeometry.TRIANGLES_PER_SURFACE_AT_LEVEL(
        KiteGeometry.getMeshSubdivisionLevel()
      );
      const originalSurfaceIndex = Math.floor(surfaceIndex / trianglesPerSurface);
      const originalSurfaceMass = KiteGeometry.SURFACE_MASSES[originalSurfaceIndex];
      const totalAreaForOriginal = KiteGeometry.SURFACES[originalSurfaceIndex].area;
      const massRatio = surface.area / totalAreaForOriginal;
      const surfaceMass = originalSurfaceMass * massRatio;

      // 2. Calculer la normale de la surface dans l'espace monde
      const surfaceNormal = AerodynamicsCalculator.calculateSurfaceNormal(surface, kiteOrientation);

      // 3. Calculer les forces aérodynamiques via méthode encapsulée
      const { liftForce, dragForce } = AerodynamicsCalculator.calculateSurfaceForces(
        apparentWind,
        surfaceNormal,
        surface.area
      );

      // 4. Si pas de force, passer au triangle suivant
      if (liftForce.lengthSq() + dragForce.lengthSq() < PhysicsConstants.EPSILON) {
        return;
      }

      // 5. Calculer la gravité distribuée sur cette surface
      const gravity = new THREE.Vector3(0, -surfaceMass * CONFIG.physics.gravity, 0);

      // 6. Force aérodynamique totale = portance + traînée
      const aeroForce = liftForce.clone().add(dragForce);
      
      // Accumulation des forces par type
      totalLift.add(liftForce);
      totalDrag.add(dragForce);
      gravityForce.add(gravity);
      
      // Force totale sur cette surface = aéro + gravité
      const totalSurfaceForce = aeroForce.clone().add(gravity);
      
      // Pour le debug : conserver lift/drag locaux
      const lift = liftForce.clone();
      const drag = dragForce.clone();

      // 7. Centre de pression = centroïde géométrique (simplifié)
      const geometricCentroid = KiteGeometry.calculateTriangleCentroid(
        surface.vertices[0],
        surface.vertices[1],
        surface.vertices[2]
      );

      const centerOfPressure = geometricCentroid.clone();

      // Centre orienté dans le repère monde (sans translation)
      const centreOriente = centerOfPressure.clone().applyQuaternion(kiteOrientation);
      // Centre monde complet (incluant translation si disponible)
      const centreMonde = kitePosition
        ? centreOriente.clone().add(kitePosition)
        : centreOriente.clone();

      // 🔍 DEBUG TOUTES les surfaces : géométrie + forces - DISABLED for performance


      // On note si cette force est sur le côté gauche ou droit
      // C'est important car si un côté a plus de force,
      // le kite va tourner (comme un bateau avec une seule rame)
      const isLeft = centerOfPressure.x < 0; // Négatif = gauche, Positif = droite

      if (isLeft) {
        leftForce.add(totalSurfaceForce); // Force totale (aéro + gravité)
      } else {
        rightForce.add(totalSurfaceForce); // Force totale (aéro + gravité)
      }

      totalForce.add(totalSurfaceForce);

      // Friction (négligeable pour l'air, nulle)
      const friction = new THREE.Vector3();

      // Résultante = force aéro totale (lift + drag vectoriel)
      const resultant = aeroForce.clone();

      surfaceForces.push({
        surfaceIndex,
        lift,
        drag,
        friction,
        resultant,
        center: centreMonde,
        normal: surfaceNormal.clone(),
        area: surface.area,
      });

      // Le couple, c'est ce qui fait tourner le kite
      // Imaginez une porte : si vous poussez près des gonds, elle tourne peu
      // Si vous poussez loin des gonds, elle tourne beaucoup
      // Ici, plus la force est loin du centre, plus elle fait tourner
      //
      // Séparation couples aéro et gravité pour scaling cohérent :
      // - Couple aéro : sera scalé proportionnellement aux forces (liftScale/dragScale)
      // - Couple gravité : physique pure, pas de scaling
      // Note: centre est déjà en coordonnées locales, on applique seulement la rotation
  const centreWorldForTorque = centreOriente.clone();
      
      // Couples calculés via méthode utilitaire
      aeroTorque.add(AerodynamicsCalculator.calculateTorque(centreWorldForTorque, aeroForce));
      gravityTorque.add(AerodynamicsCalculator.calculateTorque(centreWorldForTorque, gravity));
      totalTorque.add(AerodynamicsCalculator.calculateTorque(centreWorldForTorque, totalSurfaceForce));


    });

    // PHYSIQUE ÉMERGENTE : Le couple vient de la différence G/D
    // Si leftForce > rightForce → rotation vers la droite
    // Si rightForce > leftForce → rotation vers la gauche
    // AUCUN facteur artificiel nécessaire!

    // 🔴 BUG FIX #4 : PAS DE DÉCOMPOSITION GLOBALE !
    // Les lift/drag ont déjà été calculés CORRECTEMENT par surface avec CL/CD
    // Il suffit d'appliquer les scaling factors directement
    const lift = totalLift.multiplyScalar(CONFIG.aero.liftScale);
    const drag = totalDrag.multiplyScalar(CONFIG.aero.dragScale);

    // 🔍 DEBUG : Afficher forces calculées - DISABLED for performance
    // Uncomment for debugging:


    // 🔍 DEBUG CRITIQUE : Asymétrie gauche/droite - DISABLED for performance
    // const leftMag = leftForce.length();
    // const rightMag = rightForce.length();
    // const asymmetry = leftMag - rightMag;
    // const asymmetryPercent = rightMag > 0 ? (asymmetry / rightMag * 100) : 0;
    // const leftArr = leftForce.toArray();
    // const rightArr = rightForce.toArray();
    // const diffArr = leftForce.clone().sub(rightForce).toArray();


    // CORRECTION CRITIQUE : Scaling cohérent du couple aérodynamique
    // Le couple DOIT être scalé proportionnellement aux forces aéro pour cohérence physique
    // Si les forces sont doublées (scale=2), le couple doit l'être aussi
    // MAIS la gravité reste inchangée (physique pure)
    const averageAeroScale = (CONFIG.aero.liftScale + CONFIG.aero.dragScale) / 2;
    const scaledAeroTorque = aeroTorque.multiplyScalar(averageAeroScale);
    
    // Couple total = couple aéro scalé + couple gravité (non scalé)
  const finalTorque = scaledAeroTorque.clone().add(gravityTorque);

    // Clamp final du couple pour stabilité numérique (garde-fou générique)
    if (finalTorque.length() > PhysicsConstants.MAX_TORQUE) {
      finalTorque.setLength(PhysicsConstants.MAX_TORQUE);
    }

    return {
      lift,
      drag,
      gravity: gravityForce,  // � RESTAURÉ : Gravité distribuée par surface
      torque: finalTorque,  // Couple cohérent avec forces scalées + amortissement
      leftForce, // Exposer les forces pour analyse
      rightForce, // Permet de voir l'asymétrie émergente
      surfaceForces, // Forces individuelles par surface pour debug
    };
  }

  /**
   * Calcule des métriques pour le debug
   */
  static computeMetrics(
    apparentWind: THREE.Vector3,
    kiteOrientation: THREE.Quaternion
  ): {
    apparentSpeed: number;
    liftMag: number;
    dragMag: number;
    lOverD: number;
    aoaDeg: number;
  } {
    const windSpeed = apparentWind.length();
    if (windSpeed < PhysicsConstants.EPSILON) {
      return { apparentSpeed: 0, liftMag: 0, dragMag: 0, lOverD: 0, aoaDeg: 0 };
    }

    const { lift } = this.calculateForces(apparentWind, kiteOrientation);
    const liftMag = lift.length();
    const dragMag = 0; // Traînée intégrée dans les forces totales
    const lOverD = 0; // Ratio non applicable pour un cerf-volant

    // Calcul approximatif de l'angle d'attaque
    const windDir = apparentWind.clone().normalize();
    const weightedNormal = new THREE.Vector3();

    KiteGeometry.SURFACES.forEach((surface) => {
      const normaleMonde = AerodynamicsCalculator.calculateSurfaceNormal(surface, kiteOrientation);

      const facing = windDir.dot(normaleMonde);
      const cosIncidence = Math.max(0, Math.abs(facing));

      const normalDir =
        facing >= 0 ? normaleMonde : normaleMonde.clone().negate();
      weightedNormal.add(normalDir.multiplyScalar(surface.area * cosIncidence));
    });

    let aoaDeg = 0;
    if (
      weightedNormal.lengthSq() >
      PhysicsConstants.EPSILON * PhysicsConstants.EPSILON
    ) {
      const eff = weightedNormal.normalize();
      const dot = Math.max(-1, Math.min(1, eff.dot(windDir)));
      const phiDeg = (Math.acos(dot) * 180) / Math.PI;
      aoaDeg = Math.max(0, 90 - phiDeg);
    }

    return { apparentSpeed: windSpeed, liftMag, dragMag, lOverD, aoaDeg };
  }
}