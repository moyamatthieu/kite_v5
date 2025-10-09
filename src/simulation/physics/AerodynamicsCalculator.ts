/**
 * AerodynamicsCalculator.ts - Calculateur de forces aérodynamiques distribuées
 *
 * Calcule les forces aérodynamiques (portance, traînée) et gravitationnelles 
 * distribuées sur chaque surface du kite selon les principes de la mécanique des fluides.
 *
 * Modèle physique :
 *   - Portance : CL = sin(α)×cos(α) (plaqu      gravity: gravityForce,  // Gravité distribuée par surface plane)
 *   - Traînée : CD = sin²(α) (plaque plane)
 *   - Gravité distribuée par masse surfacique
 *   - Couples émergents de la distribution spatiale des forces
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
 * Calculateur de forces aérodynamiques
 *
 * Calcule comment le vent pousse sur le cerf-volant selon sa forme et orientation
 */
export class AerodynamicsCalculator {
  // Constantes de calculs aérodynamiques
  private static readonly HALF_AIR_DENSITY = 0.5 * CONFIG.physics.airDensity;
  private static readonly MIN_WIND_SPEED = 0.01; // m/s - seuil minimal pour calculs aéro

  /**
   * Calcule le couple (moment) d'une force appliquée à un point
   * Méthode utilitaire pour éviter la répétition de new THREE.Vector3().crossVectors()
   */
  private static calculateTorque(lever: THREE.Vector3, force: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3().crossVectors(lever, force);
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
    kiteVelocity?: THREE.Vector3,
    angularVelocity?: THREE.Vector3
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

    const windDir = apparentWind.clone().normalize();
    const dynamicPressure = AerodynamicsCalculator.HALF_AIR_DENSITY * windSpeed * windSpeed;

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

    // On examine chaque triangle du cerf-volant un par un
    // C'est comme vérifier comment le vent frappe chaque panneau d'un parasol
    KiteGeometry.SUBDIVIDED_SURFACES.forEach((surface, surfaceIndex) => {
      // 🔴 MAILLAGE FIN : Distribuer la masse proportionnellement à l'aire
      // Trouver quelle surface originale contient ce sous-triangle
      const trianglesPerSurface = KiteGeometry.TRIANGLES_PER_SURFACE_AT_LEVEL(
        KiteGeometry.getMeshSubdivisionLevel()
      );
      const originalSurfaceIndex = Math.floor(surfaceIndex / trianglesPerSurface);
      const originalSurfaceMass = KiteGeometry.SURFACE_MASSES[originalSurfaceIndex];

      // Distribuer la masse proportionnellement à l'aire relative
      const totalAreaForOriginal = KiteGeometry.SURFACES[originalSurfaceIndex].area;
      const massRatio = surface.area / totalAreaForOriginal;
      const surfaceMass = originalSurfaceMass * massRatio;
      // 🔴 DÉSACTIVATION TEMPORAIRE du vent apparent local pour debug
      // Le calcul local peut réduire trop fortement le vent perçu en rotation
      
      // Utiliser le vent apparent GLOBAL pour toutes les surfaces
      const localApparentWind = apparentWind.clone();
      const localWindSpeed = localApparentWind.length();
      
      if (localWindSpeed < 0.1) {
        return; // Pas de vent sur cette surface
      }
      
      const localWindDir = localApparentWind.clone().normalize();
      const localDynamicPressure = 0.5 * CONFIG.physics.airDensity * localWindSpeed * localWindSpeed;
      
      // Pour comprendre comment le vent frappe ce triangle,
      // on doit savoir dans quelle direction il "regarde"
      // (comme l'orientation d'un panneau solaire)
      const normaleMonde = AerodynamicsCalculator.calculateSurfaceNormal(surface, kiteOrientation);

      // Calcul de l'angle d'incidence pour une plaque plane (cerf-volant)
      // α = angle entre la direction du vent et la surface
      const windDotNormal = localWindDir.dot(normaleMonde);
      const cosTheta = Math.abs(windDotNormal); // cos(θ) où θ = angle vent-normale

      // Pour une plaque : sin(α) = cos(θ) et cos(α) = sin(θ)
      const sinAlpha = cosTheta;
      const cosAlpha = Math.sqrt(1 - sinAlpha * sinAlpha); // sin²+cos²=1

      // Si le vent glisse sur le côté (angle = 0), pas de force
      if (sinAlpha <= PhysicsConstants.EPSILON) {
        return;
      }

      // 🔴 BUG FIX #4 : COEFFICIENTS PLAQUE PLANE CORRECTS (Hoerner)
      // Formules physiques pour plaque plane inclinée à angle α :
      //   C_L = sin(α) × cos(α)  → Coefficient de portance
      //   C_D = sin²(α)           → Coefficient de traînée
      // Ces coefficients sont validés expérimentalement !
      
      const CL = sinAlpha * cosAlpha;  // Coefficient lift
      const CD = sinAlpha * sinAlpha;   // Coefficient drag (= CN)
      
      // 🔍 DEBUG première surface (angle et coefficients) - DISABLED for performance
      // if (surfaceIndex === 0) {
      //   const alphaDeg = Math.asin(sinAlpha) * 180 / Math.PI;

      // }
      
      // Direction : normale à la surface, orientée face au vent
      const windFacingNormal = windDotNormal >= 0 ? normaleMonde.clone() : normaleMonde.clone().negate();
      
      // DIRECTION LIFT : Perpendiculaire au vent, dans le plan (vent, normale)
      // Méthode : liftDir = normalize(windFacingNormal - (windFacingNormal·windDir)×windDir)
      const liftDir = windFacingNormal.clone()
        .sub(localWindDir.clone().multiplyScalar(windFacingNormal.dot(localWindDir)))
        .normalize();
      
      // Vérifier validité (éviter division par zéro si vent // normale)
      if (liftDir.lengthSq() < PhysicsConstants.EPSILON) {
        liftDir.copy(windFacingNormal);  // Fallback : utiliser normale
      }
      
      // DIRECTION DRAG : Parallèle au vent
      const dragDir = localWindDir.clone();
      
      // FORCES AÉRODYNAMIQUES (AVANT scaling) avec pression dynamique LOCALE
      const liftMagnitude = localDynamicPressure * surface.area * CL;
      const dragMagnitude = localDynamicPressure * surface.area * CD;
      
      const liftForce = liftDir.clone().multiplyScalar(liftMagnitude);
      const dragForce = dragDir.clone().multiplyScalar(dragMagnitude);
      
      // Force aérodynamique totale = lift + drag (vectoriel)
      const aeroForce = liftForce.clone().add(dragForce);
      
      // GRAVITÉ DISTRIBUÉE (émergente, pas scriptée !)
      // Chaque surface porte une fraction de la masse totale
      // La gravité est appliquée au centre géométrique de chaque surface
      // → Couple gravitationnel émerge naturellement de r × F_gravity
      const gravity = new THREE.Vector3(0, -surfaceMass * CONFIG.physics.gravity, 0);
      
      // Accumulation des forces par type
      totalLift.add(liftForce);
      totalDrag.add(dragForce);
      gravityForce.add(gravity);
      
      // Force totale sur cette surface = aéro + gravité
      const totalSurfaceForce = aeroForce.clone().add(gravity);
      
      // Pour le debug : conserver lift/drag locaux
      const lift = liftForce.clone();
      const drag = dragForce.clone();

      // 6. Centre de pression = centre géométrique du triangle
      const centre = KiteGeometry.calculateTriangleCentroid(
        surface.vertices[0],
        surface.vertices[1], 
        surface.vertices[2]
      );

      // 🔍 DEBUG TOUTES les surfaces : géométrie + forces - DISABLED for performance


      // On note si cette force est sur le côté gauche ou droit
      // C'est important car si un côté a plus de force,
      // le kite va tourner (comme un bateau avec une seule rame)
      const isLeft = centre.x < 0; // Négatif = gauche, Positif = droite

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
        center: centre.clone(), // Coordonnées locales du kite
        normal: normaleMonde.clone(),
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
      const centreWorldForTorque = centre.clone().applyQuaternion(kiteOrientation);
      
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

    return {
      lift,
      drag,
      gravity: gravityForce,  // � RESTAURÉ : Gravité distribuée par surface
      torque: finalTorque,  // Couple cohérent avec forces scalées
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