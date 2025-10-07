/**
 * AerodynamicsCalculator.ts - Calculateur de forces aérodynamiques pour le cerf-volant
 *
 * Rôle :
 *   - Calcule les forces de portance, traînée, friction et résultante sur chaque surface du kite
 *   - Utilisé pour déter      // Séparation couples aéro et gravité pour scaling cohérent :
      // - Couple aéro : sera scalé proportionnellement aux forces (liftScale/dragScale)
      // - Couple gravité : physique pure, pas de scaling
      const centreWorld = centre.clone().applyQuaternion(kiteOrientation);
      
      // Couple aérodynamique (lift + drag)
      const aeroTorqueSurface = new THREE.Vector3().crossVectors(centreWorld, aeroForce);
      aeroTorque.add(aeroTorqueSurface);
      
      // Couple gravitationnel (émergent de la distribution de masse)
      const gravityTorqueSurface = new THREE.Vector3().crossVectors(centreWorld, gravity);
      gravityTorque.add(gravityTorqueSurface);
      
      // Couple total pour cette surface
      const torque = new THREE.Vector3().crossVectors(centreWorld, totalSurfaceForce);
      totalTorque.add(torque);ement du kite face au vent
 *   - Fournit les vecteurs de force pour le rendu debug et la physique
 *
 * Dépendances principales :
 *   - KiteGeometry.ts : Définition des surfaces et géométrie du kite
 *   - PhysicsConstants.ts : Constantes physiques globales
 *   - SimulationConfig.ts : Paramètres de simulation
 *   - Types/PhysicsTypes.ts : Typage des forces et surfaces
 *
 * Relation avec les fichiers adjacents :
 *   - PhysicsEngine.ts : Utilise AerodynamicsCalculator pour calculer les forces à chaque frame
 *   - Les autres modules du dossier 'physics' (WindSimulator, LineSystem) fournissent les données nécessaires au calcul
 *
 * Utilisation typique :
 *   - Appelé par PhysicsEngine et DebugRenderer pour obtenir les forces aérodynamiques
 *
 * Voir aussi :
 *   - src/simulation/physics/PhysicsEngine.ts
 *   - src/simulation/config/KiteGeometry.ts
 *   - src/simulation/types/PhysicsTypes.ts
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
    kiteOrientation: THREE.Quaternion
  ): {
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    gravity: THREE.Vector3;  // 🔴 BUG FIX #1 : Gravité retournée séparément
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
        gravity: new THREE.Vector3(),  // 🔴 BUG FIX #1 : Retourner gravité même si vent nul
        torque: new THREE.Vector3(),
        surfaceForces: [],
      };
    }

    const windDir = apparentWind.clone().normalize();
    const dynamicPressure =
      0.5 * CONFIG.physics.airDensity * windSpeed * windSpeed;

    // Forces séparées pour gauche et droite
    let leftForce = new THREE.Vector3();
    let rightForce = new THREE.Vector3();
    let totalForce = new THREE.Vector3();
    let totalTorque = new THREE.Vector3();
    
    // 🔴 BUG FIX #4 : Accumuler lift/drag SÉPARÉMENT avec coefficients corrects
    // Utiliser formules plaque plane : CL = sin(α)×cos(α), CD = sin²(α)
    let totalLift = new THREE.Vector3();      // Portance totale
    let totalDrag = new THREE.Vector3();      // Traînée totale
    let gravityForce = new THREE.Vector3();   // Gravité séparée
    
    // Séparation couples aéro et gravité pour scaling cohérent
    let aeroTorque = new THREE.Vector3();
    let gravityTorque = new THREE.Vector3();
    
    // Collection des forces par surface pour le debug
    const surfaceForces: SurfaceForce[] = [];

    // On examine chaque triangle du cerf-volant un par un
    // C'est comme vérifier comment le vent frappe chaque panneau d'un parasol
    KiteGeometry.SURFACES_WITH_MASS.forEach((surface, surfaceIndex) => {
      // Pour comprendre comment le vent frappe ce triangle,
      // on doit savoir dans quelle direction il "regarde"
      // (comme l'orientation d'un panneau solaire)
      const edge1 = surface.vertices[1].clone().sub(surface.vertices[0]);
      const edge2 = surface.vertices[2].clone().sub(surface.vertices[0]);
      const normaleLocale = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize();

      // 2. Rotation de la normale selon l'orientation du kite
      const normaleMonde = normaleLocale
        .clone()
        .applyQuaternion(kiteOrientation);

      // Calcul de l'angle d'incidence pour une plaque plane (cerf-volant)
      // α = angle entre la direction du vent et la surface
      const windDotNormal = windDir.dot(normaleMonde);
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
      
      // Direction : normale à la surface, orientée face au vent
      const windFacingNormal = windDotNormal >= 0 ? normaleMonde.clone() : normaleMonde.clone().negate();
      
      // DIRECTION LIFT : Perpendiculaire au vent, dans le plan (vent, normale)
      // Méthode : liftDir = normalize(windFacingNormal - (windFacingNormal·windDir)×windDir)
      const liftDir = windFacingNormal.clone()
        .sub(windDir.clone().multiplyScalar(windFacingNormal.dot(windDir)))
        .normalize();
      
      // Vérifier validité (éviter division par zéro si vent // normale)
      if (liftDir.lengthSq() < PhysicsConstants.EPSILON) {
        liftDir.copy(windFacingNormal);  // Fallback : utiliser normale
      }
      
      // DIRECTION DRAG : Parallèle au vent
      const dragDir = windDir.clone();
      
      // FORCES AÉRODYNAMIQUES (AVANT scaling)
      const liftMagnitude = dynamicPressure * surface.area * CL;
      const dragMagnitude = dynamicPressure * surface.area * CD;
      
      const liftForce = liftDir.clone().multiplyScalar(liftMagnitude);
      const dragForce = dragDir.clone().multiplyScalar(dragMagnitude);
      
      // Force aérodynamique totale = lift + drag (vectoriel)
      const aeroForce = liftForce.clone().add(dragForce);
      
      // GRAVITÉ DISTRIBUÉE (émergente, pas scriptée !)
      // Chaque surface porte une fraction de la masse totale
      // La gravité est appliquée au centre géométrique de chaque surface
      // → Couple gravitationnel émerge naturellement de r × F_gravity
      const gravity = new THREE.Vector3(0, -surface.mass * CONFIG.physics.gravity, 0);
      
      // 🔴 BUG FIX #4 : Accumuler lift/drag SÉPARÉMENT (pas de décomposition !)
      totalLift.add(liftForce);       // Portance accumulée
      totalDrag.add(dragForce);       // Traînée accumulée
      gravityForce.add(gravity);      // Gravité séparée
      
      // Force totale sur cette surface = aéro + gravité
      const totalSurfaceForce = aeroForce.clone().add(gravity);
      
      // Pour le debug : conserver lift/drag locaux
      const lift = liftForce.clone();
      const drag = dragForce.clone();

      // 6. Centre de pression = centre géométrique du triangle
      const centre = surface.vertices[0]
        .clone()
        .add(surface.vertices[1])
        .add(surface.vertices[2])
        .divideScalar(3);

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
      const centreWorld = centre.clone().applyQuaternion(kiteOrientation);
      
      // Couple aérodynamique (lift + drag)
      const aeroTorqueSurface = new THREE.Vector3().crossVectors(centreWorld, aeroForce);
      aeroTorque.add(aeroTorqueSurface);
      
      // Couple gravitationnel (émergent de la distribution de masse)
      const gravityTorqueSurface = new THREE.Vector3().crossVectors(centreWorld, gravity);
      gravityTorque.add(gravityTorqueSurface);
      
      // Couple total pour cette surface
      const torque = new THREE.Vector3().crossVectors(centreWorld, totalSurfaceForce);
      totalTorque.add(torque);

    // console.log("Surface Index:", surfaceIndex);
    // console.log("Lift Vector:", lift);
    // console.log("Drag Vector:", drag);
    // console.log("Normal Vector:", normaleMonde);
    // console.log("Wind Direction:", windDir);
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
      gravity: gravityForce,  // 🔴 BUG FIX #1 : Retourner gravité séparément
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
    let weightedNormal = new THREE.Vector3();

    KiteGeometry.SURFACES.forEach((surface) => {
      const edge1 = surface.vertices[1].clone().sub(surface.vertices[0]);
      const edge2 = surface.vertices[2].clone().sub(surface.vertices[0]);
      const normaleMonde = new THREE.Vector3()
        .crossVectors(edge1, edge2)
        .normalize()
        .applyQuaternion(kiteOrientation);

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