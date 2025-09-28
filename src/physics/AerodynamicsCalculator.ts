/**
 * AerodynamicsCalculator.ts - Calcul des forces aérodynamiques
 *
 * Responsabilité : Calculer les forces et couples aérodynamiques sur le cerf-volant
 */

import * as THREE from 'three';
import { KiteGeometry } from '../geometry/KiteGeometry';
import { PhysicsConstants } from './PhysicsConstants';
import { PHYSICS_CONFIG } from '../config/PhysicsConfig';

export class AerodynamicsCalculator {
  // Cache des normales locales pré-calculées (optimisation performance)
  private static _localNormals: THREE.Vector3[] | null = null;

  // Pool d'objets Vector3 réutilisables pour éviter le GC
  private static _vectorPool: THREE.Vector3[] = [];
  private static _poolInitialized: boolean = false;

  // Vecteurs statiques pour retours (évite allocations)
  private static _zeroVector = new THREE.Vector3(0, 0, 0);
  private static _tempWindDir = new THREE.Vector3();
  
  private static initializeVectorPool(): void {
    if (this._poolInitialized) return;

    // Créer un pool de 30 Vector3 pré-alloués (augmenté pour plus d'objets)
    for (let i = 0; i < 30; i++) {
      this._vectorPool.push(new THREE.Vector3());
    }
    this._poolInitialized = true;
  }

  private static getPooledVector(index: number): THREE.Vector3 {
    if (!this._poolInitialized) this.initializeVectorPool();
    return this._vectorPool[index % this._vectorPool.length].set(0, 0, 0);
  }

  private static computeLocalNormals(): THREE.Vector3[] {
    if (this._localNormals) return this._localNormals;

    // Temporaires pour calcul (une seule fois au démarrage)
    const tempEdge1 = new THREE.Vector3();
    const tempEdge2 = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();

    this._localNormals = KiteGeometry.SURFACES.map(surface => {
      tempEdge1.subVectors(surface.vertices[1], surface.vertices[0]);
      tempEdge2.subVectors(surface.vertices[2], surface.vertices[0]);
      tempNormal.crossVectors(tempEdge1, tempEdge2).normalize();
      return tempNormal.clone(); // Clone nécessaire pour stockage
    });

    return this._localNormals;
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
    kiteOrientation: THREE.Quaternion
  ): {
    lift: THREE.Vector3;
    drag: THREE.Vector3;
    torque: THREE.Vector3;
    leftForce?: THREE.Vector3;
    rightForce?: THREE.Vector3;
  } {
    const windSpeed = apparentWind.length();
    if (windSpeed < 0.1) {
      return {
        lift: this._zeroVector,
        drag: this._zeroVector,
        torque: this._zeroVector,
      };
    }

    // Réutiliser _tempWindDir pour éviter allocation
    this._tempWindDir.copy(apparentWind).normalize();
    const dynamicPressure =
      0.5 * PHYSICS_CONFIG.physics.airDensity * windSpeed * windSpeed;

    // Forces séparées pour gauche et droite (utilise le pool)
    const leftForce = this.getPooledVector(5);
    const rightForce = this.getPooledVector(6);
    const totalForce = this.getPooledVector(7);
    const totalTorque = this.getPooledVector(8);

    // Optimisation : Utiliser les normales pré-calculées
    const localNormals = this.computeLocalNormals();
    
    // Utiliser le pool de Vector3 réutilisables pour éviter le GC
    const tempNormal = this.getPooledVector(0);
    const tempForce = this.getPooledVector(1);
    const tempCenter = this.getPooledVector(2);
    const tempEdge1 = this.getPooledVector(3);
    const tempEdge2 = this.getPooledVector(4);
    
    // On examine chaque triangle du cerf-volant un par un
    KiteGeometry.SURFACES.forEach((surface, index) => {
      // Réutiliser la normale pré-calculée et la transformer
      tempNormal.copy(localNormals[index]).applyQuaternion(kiteOrientation);

      // Maintenant on vérifie sous quel angle le vent frappe ce triangle
      // C'est comme mettre votre main par la fenêtre de la voiture :
      // - Main à plat face au vent = beaucoup de force
      // - Main de profil = peu de force
      const facing = this._tempWindDir.dot(tempNormal);
      const cosIncidence = Math.max(0, Math.abs(facing));

      // Si le vent glisse sur le côté (angle = 0), pas de force
      if (cosIncidence <= PhysicsConstants.EPSILON) {
        return;
      }

      // 4. Force perpendiculaire à la surface (pression aérodynamique)
      const normalDir = this.getPooledVector(9);
      if (facing >= 0) {
        normalDir.copy(tempNormal);
      } else {
        normalDir.copy(tempNormal).negate();
      }

      // 5. Intensité = pression dynamique × surface × cos(angle)
      const forceMagnitude = dynamicPressure * surface.area * cosIncidence;
      tempForce.copy(normalDir).multiplyScalar(forceMagnitude);

      // 6. Centre de pression = centre géométrique du triangle (réutiliser tempCenter)
      tempCenter.copy(surface.vertices[0])
        .add(surface.vertices[1])
        .add(surface.vertices[2])
        .divideScalar(3);

      // On note si cette force est sur le côté gauche ou droit
      const isLeft = tempCenter.x < 0; // Négatif = gauche, Positif = droite

      if (isLeft) {
        leftForce.add(tempForce);
      } else {
        rightForce.add(tempForce);
      }

      totalForce.add(tempForce);

      // Le couple (réutiliser tempCenter comme centreWorld)
      tempCenter.applyQuaternion(kiteOrientation);
      totalTorque.addScaledVector(tempCenter.cross(tempForce), 1);
    });

    // PHYSIQUE ÉMERGENTE : Le couple vient de la différence G/D
    // Si leftForce > rightForce → rotation vers la droite
    // Si rightForce > leftForce → rotation vers la gauche
    // AUCUN facteur artificiel nécessaire!

    // 9. Pour un cerf-volant, on retourne directement les forces totales
    // La décomposition lift/drag classique n'est pas adaptée car le kite
    // peut voler dans toutes les orientations (looping, vrilles, etc.)
    // Les forces émergent naturellement de la pression sur chaque surface

    const lift = totalForce.clone().multiplyScalar(PHYSICS_CONFIG.aero.liftScale);
    const drag = new THREE.Vector3(); // Traînée intégrée dans les forces totales

    // Mise à l'échelle du couple
    const baseTotalMag = Math.max(
      PhysicsConstants.EPSILON,
      totalForce.length()
    );
    const scaledTotalMag = lift.clone().add(drag).length();
    const torqueScale = Math.max(
      0.1,
      Math.min(3, scaledTotalMag / baseTotalMag)
    );

    return {
      lift,
      drag,
      torque: totalTorque.multiplyScalar(torqueScale),
      leftForce, // Exposer les forces pour analyse
      rightForce, // Permet de voir l'asymétrie émergente
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