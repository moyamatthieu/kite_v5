/**
 * AerodynamicsCalculator.ts - Calculateur de forces aérodynamiques pour le cerf-volant
 *
 * Rôle :
 *   - Calcule les forces de portance, traînée, friction et résultante sur chaque surface du kite
 *   - Utilisé pour déterminer le comportement du kite face au vent
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
    
    // Collection des forces par surface pour le debug
    const surfaceForces: SurfaceForce[] = [];

    // On examine chaque triangle du cerf-volant un par un
    // C'est comme vérifier comment le vent frappe chaque panneau d'un parasol
    KiteGeometry.SURFACES.forEach((surface, surfaceIndex) => {
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

      // MODÈLE PHYSIQUE POUR PLAQUE PLANE (Hoerner, "Fluid Dynamic Drag")
      // Coefficients sans dimension pour plaque plane :
      const CL = sinAlpha * cosAlpha; // Coefficient de portance ∝ sin(α)cos(α)
      const CD = sinAlpha * sinAlpha;  // Coefficient de traînée ∝ sin²(α)

      // Direction de portance : perpendiculaire au vent, dans le plan vent-normale
      // Direction de traînée : parallèle au vent

      // Vecteur perpendiculaire au vent dans le plan (vent, normale)
      const windFacingNormal = windDotNormal >= 0 ? normaleMonde.clone() : normaleMonde.clone().negate();

      // Lift perpendiculaire au vent (vers le haut pour un kite)
      const liftDir = new THREE.Vector3()
        .crossVectors(windDir, new THREE.Vector3().crossVectors(windFacingNormal, windDir))
        .normalize();

      // Si liftDir invalide (vent parallèle à normale), utiliser normale
      if (liftDir.lengthSq() < PhysicsConstants.EPSILON) {
        liftDir.copy(windFacingNormal);
      }

      // Forces aérodynamiques décomposées
      const liftMagnitude = dynamicPressure * surface.area * CL;
      const dragMagnitude = dynamicPressure * surface.area * CD;

      const lift = liftDir.clone().multiplyScalar(liftMagnitude);
      const drag = windDir.clone().multiplyScalar(dragMagnitude);

      // Force totale = lift + drag
      const force = new THREE.Vector3().add(lift).add(drag);

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
        leftForce.add(force); // On additionne à la force totale gauche
      } else {
        rightForce.add(force); // On additionne à la force totale droite
      }

      totalForce.add(force);

      // Lift et drag déjà calculés correctement ci-dessus avec le modèle plaque plane
      // Pas besoin de recalculer par décomposition vectorielle

      // Friction (négligeable pour l'air, nulle)
      const friction = new THREE.Vector3();

      // Résultante = force normale totale (PAS force + lift + drag !)
      // lift + drag = force par décomposition vectorielle
      const resultant = force.clone();

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
      const centreWorld = centre.clone().applyQuaternion(kiteOrientation);
      const torque = new THREE.Vector3().crossVectors(centreWorld, force);
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

    // Décomposition globale lift/drag selon la direction du vent
    // Somme de toutes les forces par surface
    const globalDragComponent = totalForce.dot(windDir);
    const globalDrag = windDir.clone().multiplyScalar(globalDragComponent);
    const globalLift = totalForce.clone().sub(globalDrag);

    // Application des facteurs de configuration
    const lift = globalLift.multiplyScalar(CONFIG.aero.liftScale);
    const drag = globalDrag.multiplyScalar(CONFIG.aero.dragScale);

    // NOTE: Si liftScale = dragScale = 1.0, le couple n'a pas besoin de scaling
    // Le couple est déjà calculé correctement par somme des τ = r × F individuels
    // Pas de scaling artificiel appliqué - physique pure

    return {
      lift,
      drag,
      torque: totalTorque,  // Pas de scaling - physique pure
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