/**
 * KiteController.ts - Contrôleur du cerf-volant pour la simulation Kite
 *
 * Rôle :
 *   - Gère l'état physique et le mouvement du cerf-volant
 *   - Applique les forces, met à jour la position, la vitesse et l'orientation
 *   - Détecte les situations extrêmes (accélération, vitesse, rotation)
 *
 * Dépendances principales :
 *   - Kite.ts : Modèle 3D du cerf-volant
 *   - PhysicsConstants.ts, SimulationConfig.ts : Paramètres et limites physiques
 *   - ConstraintSolver.ts : Applique les contraintes de ligne
 *   - Types : KiteState, HandlePositions pour typer l'état
 *   - Three.js : Pour la géométrie et le calcul
 *
 * Relation avec les fichiers adjacents :
 *   - Utilisé par PhysicsEngine pour manipuler le kite
 *   - Interagit avec ControlBarManager pour la gestion des lignes
 *
 * Utilisation typique :
 *   - Instancié par PhysicsEngine, appelé à chaque frame pour mettre à jour l'état du kite
 *   - Sert à la visualisation et au contrôle du kite
 *
 * Voir aussi :
 *   - src/objects/organic/Kite.ts
 *   - src/simulation/physics/PhysicsEngine.ts
 *   - src/simulation/controllers/ControlBarManager.ts
 */
import * as THREE from "three";
import { Kite } from "../../objects/organic/Kite";
import { KiteState, HandlePositions } from "../types";
import { PhysicsConstants } from "../config/PhysicsConstants";
import { CONFIG } from "../config/SimulationConfig";
import { ConstraintSolver } from "../physics/ConstraintSolver";

/**
 * Contrôleur du cerf-volant
 *
 * Gère l'état physique et le mouvement du cerf-volant
 */
export class KiteController {
  private kite: Kite;
  private state: KiteState;
  private previousPosition: THREE.Vector3;
  // États pour les warnings
  private hasExcessiveAccel: boolean = false;
  private hasExcessiveVelocity: boolean = false;
  private hasExcessiveAngular: boolean = false;
  private lastAccelMagnitude: number = 0;
  private lastVelocityMagnitude: number = 0;

  // Lissage temporel des forces
  private smoothedForce: THREE.Vector3;
  private smoothedTorque: THREE.Vector3;
  // CORRECTION AUDIT #10 : Taux de lissage augmenté de 5.0 à 20.0 (1/s)
  // Réduit le lag de 200ms à 50ms pour meilleure réactivité aux rafales
  // Objectif long terme : supprimer complètement après stabilisation PBD
  private forceSmoothingRate: number = 20.0; // Taux de lissage en 1/s (plus élevé = lissage plus rapide)

  constructor(kite: Kite) {
    this.kite = kite;
    this.state = {
      position: kite.position.clone(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      orientation: kite.quaternion.clone(),
    };
    this.previousPosition = kite.position.clone();
    this.kite.userData.lineLength = CONFIG.lines.defaultLength;

    // Initialiser les forces lissées
    this.smoothedForce = new THREE.Vector3();
    this.smoothedTorque = new THREE.Vector3();
  }

  /**
   * Met à jour la position et l'orientation du cerf-volant
   */
  update(
    forces: THREE.Vector3,
    torque: THREE.Vector3,
    handles: HandlePositions,
    deltaTime: number
  ): void {
    // Valider les forces brutes
    const validForces = this.validateForces(forces);
    const validTorque = this.validateTorque(torque);

    // Lissage exponentiel des forces (indépendant du framerate)
    // smoothingFactor = 1 - e^(-rate × dt)
    const smoothingFactor = 1 - Math.exp(-this.forceSmoothingRate * deltaTime);
    this.smoothedForce.lerp(validForces, smoothingFactor);
    this.smoothedTorque.lerp(validTorque, smoothingFactor);

    // Utiliser les forces lissées pour la physique
    const newPosition = this.integratePhysics(this.smoothedForce, deltaTime);

    // Appliquer les contraintes de lignes (Position-Based Dynamics)
    // Le solveur peut modifier newPosition ainsi que state.velocity / state.angularVelocity
    try {
      ConstraintSolver.enforceLineConstraints(
        this.kite,
        newPosition,
        { velocity: this.state.velocity, angularVelocity: this.state.angularVelocity },
        handles
      );
    } catch (err) {
      // Ne pas laisser une exception du solveur casser la boucle principale
      console.error("⚠️ Erreur dans ConstraintSolver.enforceLineConstraints:", err);
    }

    // Appliquer les contraintes des brides (Position-Based Dynamics)
    // Les brides sont des contraintes INTERNES qui lient les points du kite entre eux
    try {
      ConstraintSolver.enforceBridleConstraints(
        this.kite,
        newPosition,
        { velocity: this.state.velocity, angularVelocity: this.state.angularVelocity },
        this.kite.getBridleLengths()
      );
    } catch (err) {
      console.error("⚠️ Erreur dans ConstraintSolver.enforceBridleConstraints:", err);
    }

    // Gérer la collision avec le sol - corrige newPosition et vitesse si nécessaire
    try {
      ConstraintSolver.handleGroundCollision(this.kite, newPosition, this.state.velocity);
    } catch (err) {
      console.error("⚠️ Erreur dans ConstraintSolver.handleGroundCollision:", err);
    }

    // Valider la position finale
    this.validatePosition(newPosition);

    // Appliquer la position et l'orientation
    this.kite.position.copy(newPosition);
    this.updateOrientation(this.smoothedTorque, deltaTime); // Utiliser le torque lissé
    this.previousPosition.copy(newPosition);
  }
  /**
   * Valide les forces appliquées au cerf-volant
   */
  private validateForces(forces: THREE.Vector3): THREE.Vector3 {
    if (
      !forces ||
      forces.length() > PhysicsConstants.MAX_FORCE ||
      isNaN(forces.length())
    ) {
      console.error(
        `⚠️ Forces invalides: ${forces ? forces.toArray() : "undefined"}`
      );
      return new THREE.Vector3();
    }
    return forces;
  }

  /**
   * Valide le couple
   */
  private validateTorque(torque: THREE.Vector3): THREE.Vector3 {
    if (!torque || isNaN(torque.length())) {
      console.error(
        `⚠️ Couple invalide: ${torque ? torque.toArray() : "undefined"}`
      );
      return new THREE.Vector3();
    }
    return torque;
  }

  /**
   * Intègre les forces pour calculer la nouvelle position (méthode d'Euler)
   * Implémente la 2ème loi de Newton : F = ma → a = F/m
   */
  private integratePhysics(
    forces: THREE.Vector3,
    deltaTime: number
  ): THREE.Vector3 {
    // Newton : accélération = Force / masse
    // IMPORTANT: clone() pour ne pas modifier le vecteur forces en place!
    const acceleration = forces.clone().divideScalar(CONFIG.kite.mass);
    this.lastAccelMagnitude = acceleration.length();

    // Sécurité : limiter pour éviter l'explosion numérique
    this.hasExcessiveAccel = acceleration.length() > PhysicsConstants.MAX_ACCELERATION;
    if (this.hasExcessiveAccel) {
      acceleration
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ACCELERATION);
    }

    // Intégration d'Euler : v(t+dt) = v(t) + a·dt
    // IMPORTANT: clone() avant multiplyScalar pour ne pas modifier acceleration!
    this.state.velocity.add(acceleration.clone().multiplyScalar(deltaTime));

    // CORRECTION AUDIT #4 : Amortissement linéaire SUPPRIMÉ
    // L'amortissement est géré par la traînée aérodynamique dans AerodynamicsCalculator
    // Pas besoin d'amortissement supplémentaire ici (évite double pénalité)
    // const linearDampingFactor = Math.exp(-CONFIG.physics.linearDampingCoeff * deltaTime);
    // this.state.velocity.multiplyScalar(linearDampingFactor);
    this.lastVelocityMagnitude = this.state.velocity.length();

    // Garde-fou vitesse max (réalisme physique)
    this.hasExcessiveVelocity = this.state.velocity.length() > PhysicsConstants.MAX_VELOCITY;
    if (this.hasExcessiveVelocity) {
      this.state.velocity
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_VELOCITY);
    }

    // Position : x(t+dt) = x(t) + v·dt
    return this.kite.position
      .clone()
      .add(this.state.velocity.clone().multiplyScalar(deltaTime));
  }

  /**
   * Valide la position finale
   */
  private validatePosition(newPosition: THREE.Vector3): void {
    if (isNaN(newPosition.x) || isNaN(newPosition.y) || isNaN(newPosition.z)) {
      console.error(`⚠️ Position NaN détectée! Reset à la position précédente`);
      newPosition.copy(this.previousPosition);
      this.state.velocity.set(0, 0, 0);
    }
  }

  /**
   * Met à jour l'orientation du cerf-volant - Dynamique du corps rigide
   */
  private updateOrientation(torque: THREE.Vector3, deltaTime: number): void {
    // Couple d'amortissement (résistance à la rotation dans l'air)
    const dampTorque = this.state.angularVelocity
      .clone()
      .multiplyScalar(-CONFIG.physics.angularDragCoeff);
    const effectiveTorque = torque.clone().add(dampTorque);

    // Dynamique rotationnelle : α = T / I
    // IMPORTANT: clone() pour ne pas modifier effectiveTorque en place!
    const angularAcceleration = effectiveTorque.clone().divideScalar(
      CONFIG.kite.inertia
    );

    // Limiter l'accélération angulaire
    if (
      angularAcceleration.length() > PhysicsConstants.MAX_ANGULAR_ACCELERATION
    ) {
      angularAcceleration
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ANGULAR_ACCELERATION);
    }

    // Mise à jour de la vitesse angulaire
    // IMPORTANT: clone() avant multiplyScalar pour ne pas modifier angularAcceleration!
    this.state.angularVelocity.add(
      angularAcceleration.clone().multiplyScalar(deltaTime)
    );

    // Amortissement angulaire exponentiel : ω(t) = ω₀ × e^(-c×dt)
    const angularDampingFactor = Math.exp(-CONFIG.physics.angularDampingCoeff * deltaTime);
    this.state.angularVelocity.multiplyScalar(angularDampingFactor);

    // Limiter la vitesse angulaire
    this.hasExcessiveAngular = this.state.angularVelocity.length() > PhysicsConstants.MAX_ANGULAR_VELOCITY;
    if (this.hasExcessiveAngular) {
      this.state.angularVelocity
        .normalize()
        .multiplyScalar(PhysicsConstants.MAX_ANGULAR_VELOCITY);
    }

    // Appliquer la rotation
    if (this.state.angularVelocity.length() > PhysicsConstants.EPSILON) {
      const deltaRotation = new THREE.Quaternion();
      const axis = this.state.angularVelocity.clone().normalize();
      const angle = this.state.angularVelocity.length() * deltaTime;
      deltaRotation.setFromAxisAngle(axis, angle);

      this.kite.quaternion.multiply(deltaRotation);
      this.kite.quaternion.normalize();
    }
  }

  getState(): KiteState {
    return { ...this.state };
  }

  getKite(): Kite {
    return this.kite;
  }

  setLineLength(length: number): void {
    this.kite.userData.lineLength = length;
  }

  /**
   * Retourne les états de warning pour l'affichage
   */
  getWarnings(): {
    accel: boolean;
    velocity: boolean;
    angular: boolean;
    accelValue: number;
    velocityValue: number;
  } {
    return {
      accel: this.hasExcessiveAccel,
      velocity: this.hasExcessiveVelocity,
      angular: this.hasExcessiveAngular,
      accelValue: this.lastAccelMagnitude,
      velocityValue: this.lastVelocityMagnitude,
    };
  }

  /**
   * Définit le taux de lissage des forces physiques
   * @param rate - Taux en 1/s (valeurs typiques: 1-10, plus élevé = lissage plus rapide)
   */
  setForceSmoothing(rate: number): void {
    this.forceSmoothingRate = Math.max(0.1, Math.min(20, rate));
  }

  /**
   * Retourne le taux de lissage actuel des forces (en 1/s)
   */
  getForceSmoothing(): number {
    return this.forceSmoothingRate;
  }
}