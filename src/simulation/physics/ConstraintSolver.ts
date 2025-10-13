/**
 * ConstraintSolver.ts - Solveur de contraintes pour les lignes du cerf-volant
 *
 * Rôle :
 *   - Applique les contraintes de distance sur les lignes via l'algorithme Position-Based Dynamics (PBD)
 *   - Garantit la stabilité géométrique du kite et le respect des longueurs de ligne
 *   - Permet la rotation naturelle et le décrochage du kite
 *
 * Dépendances principales :
 *   - Kite.ts : Accès à la géométrie et points du cerf-volant
 *   - PhysicsConstants.ts : Constantes physiques pour la tolérance et la gestion des contraintes
 *   - SimulationConfig.ts : Paramètres de configuration
 *   - Types : Utilise HandlePositions pour typer les poignées
 *
 * Relation avec les fichiers adjacents :
 *   - LineSystem.ts : Utilise ConstraintSolver pour appliquer les contraintes sur les lignes
 *   - PhysicsEngine.ts : Orchestration de l'appel au solveur
 *
 * Utilisation typique :
 *   - Appelé par LineSystem ou PhysicsEngine pour maintenir la contrainte de distance
 *
 * Voir aussi :
 *   - src/simulation/physics/LineSystem.ts
 *   - src/simulation/physics/PhysicsEngine.ts
 *   - src/objects/organic/Kite.ts
 */
import * as THREE from "three";

import { Kite } from "../../objects/Kite";
import { HandlePositions } from "../types";
import { BridleLengths } from "../types/BridleTypes";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Interface décrivant la sphère de vol du kite
 *
 * PRINCIPE FONDAMENTAL :
 * Le kite évolue sur une sphère de rayon R = L_lignes + L_brides
 * Cette sphère définit la "fenêtre de vol" (wind window) avec :
 * - Équateur : Zone de puissance maximale (surfaces ⊥ vent)
 * - Zénith : Zone de puissance minimale (surfaces ∥ vent)
 * - Le kite se déplace tangentiellement sur cette sphère
 */
export interface FlightSphere {
  /** Centre de la sphère (position du pilote/barre) */
  center: THREE.Vector3;
  /** Rayon = longueur_lignes + longueur_bridles (principe fondamental) */
  radius: number;
  /** Position actuelle du kite sur la sphère */
  kitePosition: THREE.Vector3;
  /** Distance actuelle du centre à la position du kite */
  currentDistance: number;
  /** Facteur de tension (0 = complètement relâché, 1 = tendu) */
  tensionFactor: number;

  // === GÉOMÉTRIE DE LA FENÊTRE DE VOL ===
  /** Position du zénith (sommet de la sphère) : center + (0, radius, 0) */
  zenithPosition: THREE.Vector3;
  /** Distance actuelle au zénith (0 = au zénith, 2*radius = opposé) */
  distanceToZenith: number;
  /** Facteur de puissance (0 = zénith/puissance min, 1 = équateur/puissance max) */
  powerFactor: number;

  // === DIRECTION DU VENT ===
  /** Direction du vent (normalisée) */
  windDirection: THREE.Vector3;
  /** Angle entre kite et direction vent (0° = face au vent, 180° = dos au vent) */
  windAngleDeg: number;

  // === ZONES DE LA FENÊTRE ===
  /** Zone actuelle : 'zenith' | 'power' | 'edge' | 'transition' */
  currentZone: 'zenith' | 'power' | 'edge' | 'transition';
}

/**
 * Solveur de contraintes pour les lignes et brides du cerf-volant
 *
 * Implémente l'algorithme Position-Based Dynamics (PBD) pour maintenir
 * les contraintes géométriques selon les principes physiques décrits :
 *
 * SPHÈRE DE VOL : R = longueur_lignes + longueur_bridles
 * - Le kite évolue sur la surface d'une sphère centrée sur le pilote
 * - Toute force aérodynamique latérale produit un déplacement tangentiel
 * - Les contraintes radiales sont satisfaites géométriquement
 *
 * POINT D'ÉQUILIBRE ZÉNITH :
 * - Quand la barre est relâchée, le kite tend vers le zénith
 * - Position de stabilité relative avec traction minimale
 *
 * MÉCANISME DE DIRECTION :
 * - Asymétrie des lignes produit un couple aérodynamique
 * - Modification différentielle de longueur effective des lignes
 * - Twist de l'aile → changement d'angle d'attaque → rotation
 */
export class ConstraintSolver {
  /**
   * Calcule la sphère de vol du kite selon le principe fondamental
   * R = longueur_lignes + longueur_bridles
   *
   * ENRICHISSEMENT :
   * - Calcule la position du zénith
   * - Détermine la zone actuelle (zenith, power, edge, transition)
   * - Calcule le facteur de puissance (fonction de la hauteur)
   * - Analyse l'angle avec le vent
   *
   * @param kite - Instance du kite
   * @param pilotPosition - Position du pilote/barre de contrôle
   * @param windDirection - Direction du vent (optionnel, défaut = vent arrière selon +Z)
   * @returns Description complète de la sphère de vol avec zones de puissance
   */
  /**
   * Intègre la contrainte de sphère de vol (PHYSICS_MODEL.md §2)
   * - Le kite évolue sur une sphère de rayon R = longueur_lignes + longueur_bridles
   * - La position du kite est contrainte à la surface de cette sphère lorsque les lignes sont tendues
   * - Permet le déplacement tangentiel et la gestion des zones de puissance/zénith
   */
  static calculateFlightSphere(
    kite: Kite,
    pilotPosition: THREE.Vector3,
    windDirection?: THREE.Vector3
  ): FlightSphere {
    const lineLength = kite.userData.lineLength || CONFIG.lines.defaultLength;

    // Calculer la longueur totale des brides (moyenne des 3 paires)
    const bridleLengths = kite.getBridleLengths();
    const avgBridleLength = (bridleLengths.nez + bridleLengths.inter + bridleLengths.centre) / 3;

    // SPHÈRE DE VOL : R = longueur_lignes + longueur_bridles (principe fondamental)
    const sphereRadius = lineLength + avgBridleLength;

    // Position actuelle du kite
    const kitePosition = kite.position.clone();
    const currentDistance = kitePosition.distanceTo(pilotPosition);

    // Facteur de tension (0 = relâché, 1 = tendu contre la sphère)
    const tensionFactor = Math.min(currentDistance / sphereRadius, 1);

    // === GÉOMÉTRIE DE LA FENÊTRE DE VOL ===

    // Position du zénith (sommet de la sphère)
    const zenithPosition = pilotPosition.clone().add(new THREE.Vector3(0, sphereRadius, 0));

    // Distance au zénith
    const distanceToZenith = kitePosition.distanceTo(zenithPosition);

    // Facteur de puissance basé sur la hauteur relative
    // powerFactor = 0 au zénith (y = radius), = 1 à l'équateur (y = 0)
    const relativeHeight = (kitePosition.y - pilotPosition.y) / sphereRadius;
    const powerFactor = Math.max(0, Math.min(1, 1 - relativeHeight));

    // === DIRECTION DU VENT ===

    // Direction du vent (par défaut : vent arrière selon +Z si non fourni)
    const windDir = windDirection
      ? windDirection.clone().normalize()
      : new THREE.Vector3(0, 0, 1);

    // Vecteur du pilote vers le kite
    const pilotToKite = kitePosition.clone().sub(pilotPosition).normalize();

    // Angle entre kite et vent (produit scalaire)
    const windDot = pilotToKite.dot(windDir);
    const windAngleDeg = Math.acos(Math.max(-1, Math.min(1, windDot))) * (180 / Math.PI);

    // === ZONES DE LA FENÊTRE ===

    let currentZone: 'zenith' | 'power' | 'edge' | 'transition';

    // Critères de classification :
    // - Zenith : hauteur > 80% du rayon ET distance au zénith < 20% du rayon
    // - Power : hauteur entre 20% et 60% (zone équatoriale)
    // - Edge : bords latéraux (angle vent > 60°)
    // - Transition : entre power et zenith

    if (relativeHeight > 0.8 && distanceToZenith < sphereRadius * 0.3) {
      currentZone = 'zenith';
    } else if (relativeHeight < 0.6 && relativeHeight > 0.2) {
      currentZone = 'power';
    } else if (windAngleDeg > 60 && windAngleDeg < 120) {
      currentZone = 'edge';
    } else {
      currentZone = 'transition';
    }

    return {
      center: pilotPosition.clone(),
      radius: sphereRadius,
      kitePosition,
      currentDistance,
      tensionFactor,
      zenithPosition,
      distanceToZenith,
      powerFactor,
      windDirection: windDir,
      windAngleDeg,
      currentZone
    };
  }

  /**
   * Applique le comportement de point d'équilibre zénith
   * Quand la barre est relâchée, le kite tend naturellement vers le zénith
   *
   * @param kite - Instance du kite
   * @param predictedPosition - Position prédite avant contraintes
   * @param barRotation - Rotation actuelle de la barre (-1 à 1)
   * @param flightSphere - Sphère de vol calculée
   * @returns Nouvelle position prédite avec tendance zénith
   */
  static applyZenithEquilibrium(
    kite: Kite,
    predictedPosition: THREE.Vector3,
    barRotation: number,
    flightSphere: FlightSphere
  ): THREE.Vector3 {
    // Si la barre est quasi-neutre (±10%), appliquer la tendance zénith
    if (Math.abs(barRotation) < 0.1) {
      const zenithDirection = new THREE.Vector3(0, 1, 0); // Direction verticale
      const kiteToCenter = flightSphere.center.clone().sub(predictedPosition);

      // Projeter la direction vers le centre sur le plan horizontal
      const horizontalComponent = kiteToCenter.clone();
      horizontalComponent.y = 0;
      horizontalComponent.normalize();

      // Mélanger direction zénith et direction géométrique naturelle
      // Plus on est proche du zénith, plus la tendance est forte
      const zenithFactor = 1 - Math.abs(predictedPosition.y - flightSphere.center.y) / flightSphere.radius;
      const zenithInfluence = Math.max(0, zenithFactor * 0.3); // Max 30% d'influence

      const finalDirection = zenithDirection.clone()
        .multiplyScalar(zenithInfluence)
        .add(horizontalComponent.multiplyScalar(1 - zenithInfluence))
        .normalize();

      // Ajuster légèrement la position prédite vers le zénith
      const adjustment = finalDirection.multiplyScalar(flightSphere.radius * 0.02); // 2% du rayon
      predictedPosition.add(adjustment);
    }

    return predictedPosition;
  }
  /**
   * Applique les contraintes des lignes - Solver PBD (Position-Based Dynamics)
   * Implémente le concept de SPHÈRE DE VOL : R = longueur_lignes + longueur_bridles
   *
   * PRINCIPE PHYSIQUE FONDAMENTAL :
   * - Les lignes définissent une sphère de rayon R autour du pilote
   * - Le kite est constamment poussé contre cette sphère par le vent
   * - Toute force aérodynamique latérale se traduit par un déplacement tangentiel
   * - Le kite "glisse" sur la surface de la sphère (pas de mouvement radial)
   */
  static enforceLineConstraints(
    kite: Kite,
    predictedPosition: THREE.Vector3,
    state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    handles: HandlePositions
  ): void {
    // PRINCIPE PHYSIQUE FONDAMENTAL - Sphère de Vol :
    // R = longueur_lignes + longueur_bridles (somme des contraintes géométriques)
    // Le cerf-volant est constamment plaqué contre cette sphère par la pression du vent
    // Toute force aérodynamique latérale se traduit par un déplacement tangentiel
    // sur la surface de la sphère (pas de mouvement radial = lignes tendues)
    // C'est quand il sort de cette sphère qu'il "décroche"

    const lineLength =
      kite.userData.lineLength || CONFIG.lines.defaultLength;
  // Tolérance gérée implicitement par la logique de contrainte (plus de soustraction de tolérance)

    const ctrlLeft = kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = kite.getPoint("CTRL_DROIT");
    if (!ctrlLeft || !ctrlRight) return;

    const mass = CONFIG.kite.mass;
    const inertia = CONFIG.kite.inertia;

    // Résolution PBD pour chaque ligne
    const solveLine = (ctrlLocal: THREE.Vector3, handle: THREE.Vector3) => {
      // Utiliser position prédite pour transformation locale→monde
      const originalPos = kite.position.clone();
      kite.position.copy(predictedPosition);
      const cpWorld = kite.toWorldCoordinates(ctrlLocal);
      kite.position.copy(originalPos);
      const diff = cpWorld.clone().sub(handle);
      const dist = diff.length();

  // Tolérance PBD: éviter de "raccourcir" la longueur cible.
  // Fix bug critique: ne pas soustraire la tolérance de la longueur.
  if (dist <= lineLength) return; // Ligne molle (aucune correction)

      const n = diff.clone().normalize();
      const C = dist - lineLength;

      const r = cpWorld.clone().sub(predictedPosition);
      const alpha = new THREE.Vector3().crossVectors(r, n);
      const invMass = 1 / mass;
      const invInertia = 1 / Math.max(inertia, PhysicsConstants.EPSILON);
      const denom = invMass + alpha.lengthSq() * invInertia;
      const lambda = C / Math.max(denom, PhysicsConstants.EPSILON);

      // Corrections
      const dPos = n.clone().multiplyScalar(-invMass * lambda);
      predictedPosition.add(dPos);

      const dTheta = alpha.clone().multiplyScalar(-invInertia * lambda);
      const angle = dTheta.length();
      if (angle > PhysicsConstants.EPSILON) {
        const axis = dTheta.normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        kite.quaternion.premultiply(dq).normalize();
      }

      // Correction de vitesse
      kite.position.copy(predictedPosition);
      const cpWorld2 = kite.toWorldCoordinates(ctrlLocal);
      kite.position.copy(originalPos);
      const n2 = cpWorld2.clone().sub(handle).normalize();
      const r2 = cpWorld2.clone().sub(predictedPosition);
      const pointVel = state.velocity
        .clone()
        .add(new THREE.Vector3().crossVectors(state.angularVelocity, r2));
      const radialSpeed = pointVel.dot(n2);

      if (radialSpeed > 0) {
        const rxn = new THREE.Vector3().crossVectors(r2, n2);
        const eff = invMass + rxn.lengthSq() * invInertia;
        const J = -radialSpeed / Math.max(eff, PhysicsConstants.EPSILON);

        state.velocity.add(n2.clone().multiplyScalar(J * invMass));
        const angImpulse = new THREE.Vector3().crossVectors(
          r2,
          n2.clone().multiplyScalar(J)
        );
        state.angularVelocity.add(angImpulse.multiplyScalar(invInertia));
      }
    };

    // Plusieurs passes pour mieux satisfaire les contraintes
    for (let i = 0; i < PhysicsConstants.CONSTRAINT_ITERATIONS; i++) {
      solveLine(ctrlLeft, handles.left);
      solveLine(ctrlRight, handles.right);
    }
  }

  /**
   * 🚫 MÉTHODE DÉPRÉCIÉE - Les brides ne sont PLUS des contraintes dynamiques !
   *
   * NOUVELLE ARCHITECTURE :
   * Les brides définissent la géométrie RIGIDE interne du kite.
   * Les positions CTRL sont calculées une seule fois par trilatération
   * dans PointFactory.calculateControlPoint() et restent FIXES dans
   * le référentiel local du kite.
   *
   * POURQUOI CE CHANGEMENT :
   * - Les brides forment des pyramides tétraédriques rigides
   * - Pas de sur-contrainte : 3 brides → 1 position CTRL unique
   * - Le kite complet bouge comme un corps rigide 6 DOF
   * - Seules les LIGNES sont des contraintes dynamiques (pivot sphérique)
   *
   * @deprecated Utilisez la géométrie rigide définie par PointFactory
   */
  static enforceBridleConstraints(
    _kite: Kite,
    _predictedPosition: THREE.Vector3,
    _state: { velocity: THREE.Vector3; angularVelocity: THREE.Vector3 },
    _bridleLengths: BridleLengths
  ): void {
    // 🔥 REFACTORING ARCHITECTURAL MAJEUR 🔥
    //
    // Cette méthode ne fait plus RIEN car les brides sont maintenant
    // gérées comme structure géométrique RIGIDE du kite.
    //
    // AVANT (PROBLÉMATIQUE) :
    // - PBD tentait de résoudre 4 contraintes sur chaque point CTRL
    // - Conflit entre contraintes de brides et contraintes de lignes
    // - Instabilité numérique et oscillations
    //
    // MAINTENANT (CORRECT) :
    // - Positions CTRL calculées UNE SEULE FOIS par trilatération
    // - Structure pyramidale rigide dans référentiel kite
    // - Le kite entier bouge comme un corps rigide 6 DOF
    // - Seules les lignes sont des contraintes dynamiques
    //
    // La géométrie interne est définie dans PointFactory.calculateControlPoint()
    // et reste fixe dans le référentiel local du kite.
  }

  /**
   * Gère la collision avec le sol
   */
  static handleGroundCollision(
    kite: Kite,
    newPosition: THREE.Vector3,
    velocity: THREE.Vector3
  ): void {
    const groundY = CONFIG.kite.minHeight;
    const pointsMap = kite.getPointsMap?.() as
      | Map<string, [number, number, number]>
      | undefined;

    if (pointsMap && pointsMap.size > 0) {
      let minY = Infinity;
      const q = kite.quaternion;

      pointsMap.forEach(([px, py, pz]) => {
        const world = new THREE.Vector3(px, py, pz)
          .applyQuaternion(q)
          .add(newPosition);
        if (world.y < minY) minY = world.y;
      });

      if (minY < groundY) {
        const lift = groundY - minY;
        newPosition.y += lift;

        if (velocity.y < 0) velocity.y = 0;
        velocity.x *= PhysicsConstants.GROUND_FRICTION;
        velocity.z *= PhysicsConstants.GROUND_FRICTION;
      }
      return;
    }

    // Fallback simple
    if (newPosition.y < groundY) {
      newPosition.y = groundY;
      if (velocity.y < 0) velocity.y = 0;
      velocity.x *= PhysicsConstants.GROUND_FRICTION;
      velocity.z *= PhysicsConstants.GROUND_FRICTION;
    }
  }
}