/**
 * PhysicsSystem.ts - Intégration numérique (Euler semi-implicite)
 * 
 * Intègre les forces/couples en velocité/position.
 * Priorité 50 (après contraintes, avant rendu).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { Entity } from '../core/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { PhysicsConstants } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';
import { PhysicsIntegrator } from '../utils/PhysicsIntegrator';
import { Logger } from '../utils/Logging';

export class PhysicsSystem extends System {
  private readonly logger = Logger.getInstance();
  private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);

  constructor() {
    const PRIORITY = 50;
    super('PhysicsSystem', PRIORITY);
  }
  
  update(context: SimulationContext): void {
    const { deltaTime, entityManager } = context;

    // Pour toutes les entités avec physics
    const entities = entityManager.query(['transform', 'physics']);

    entities.forEach(entity => {
      const transform = entity.getComponent<TransformComponent>('transform')!;
      const physics = entity.getComponent<PhysicsComponent>('physics')!;

      // Vérifier NaN avant calcul
      const posNaN = isNaN(transform.position.x) || isNaN(transform.position.y) || isNaN(transform.position.z);
      if (posNaN) {
        this.logger.error(`${entity.id} position is NaN: (${transform.position.x}, ${transform.position.y}, ${transform.position.z})`, 'PhysicsSystem');
        return;
      }

      // Ignorer les objets cinématiques (fixes)
      if (physics.isKinematic) {
        // Les objets cinématiques n'ont pas de physique dynamique, mais il faut
        // quand même nettoyer les forces qui auraient pu être accumulées
        // par d'autres systèmes (ex: forces de contact non implémentées ici).
        this.clearForces(physics);
        return;
      }

      // Appliquer la gravité (force constante)
      const gravityForce = this.gravity.clone().multiplyScalar(physics.mass);
      physics.forces.add(gravityForce);

      // Utilisation de PhysicsIntegrator pour la logique d'intégration
      PhysicsIntegrator.integrate(transform, physics, deltaTime);

      // === COLLISION AVEC LE SOL ===
      // Vérifier que tous les points du kite restent au-dessus du sol
      this.handleGroundCollision(entity, transform, physics);

      // Réinitialiser les accumulateurs de forces pour la prochaine frame
      this.clearForces(physics);
    });
  }

  /**
   * Multiplie une matrice 3x3 par un vecteur
   */
  private multiplyMatrix3Vector(matrix: THREE.Matrix3, vector: THREE.Vector3): THREE.Vector3 {
    return MathUtils.applyMatrix3ToVector(matrix, vector);
  }

  /**
   * Réinitialise les accumulateurs de forces après intégration
   */
  private clearForces(physics: PhysicsComponent): void {
    physics.forces.set(0, 0, 0);
    physics.torques.set(0, 0, 0);
  }

  /**
   * Gère la collision avec le sol pour une entité
   * Vérifie que tous les points de l'entité restent au-dessus du sol
   */
  private handleGroundCollision(entity: Entity, transform: TransformComponent, physics: PhysicsComponent): void {
    // Pour le kite, vérifier tous les points structurels
    if (entity.id === 'kite') {
      this.handleKiteGroundCollision(entity, transform, physics);
    } else {
      // Pour les autres entités, vérification simple du centre de masse
      this.handleSimpleGroundCollision(transform, physics);
    }
  }

  /**
   * Collision simple pour entités génériques (vérification du centre de masse uniquement)
   */
  private handleSimpleGroundCollision(transform: TransformComponent, physics: PhysicsComponent): void {
    if (transform.position.y < PhysicsConstants.GROUND_Y) {
      transform.position.y = PhysicsConstants.GROUND_Y;
      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.3; // Rebond amorti
      }
    }
  }

  /**
   * Collision spécialisée pour le kite - vérifie tous les points structurels
   */
  private handleKiteGroundCollision(entity: Entity, transform: TransformComponent, physics: PhysicsComponent): void {
    const geometry = entity.getComponent<GeometryComponent>('geometry');
    if (!geometry) {
      // Fallback vers vérification du centre de masse uniquement
      this.handleSimpleGroundCollision(transform, physics);
      return;
    }

    const groundY = PhysicsConstants.GROUND_Y;
    let needsCorrection = false;
    let maxPenetration = 0;
      const correctionVector = new THREE.Vector3();    // Points critiques à vérifier pour un kite delta
    const criticalPoints = [
      'NEZ',           // Pointe avant
      'CTRL_GAUCHE',  // Point d'attache gauche
      'CTRL_DROIT',   // Point d'attache droit
      'SPINE_BAS',    // Base de l'épine
      'QUEUE'         // Queue (si présente)
    ];

    // Vérifier chaque point critique
    for (const pointName of criticalPoints) {
      const worldPoint = geometry.getPointWorld(pointName, entity);
      if (worldPoint && worldPoint.y < groundY) {
        needsCorrection = true;
        const penetration = groundY - worldPoint.y;
        if (penetration > maxPenetration) {
          maxPenetration = penetration;
          // Calculer le vecteur de correction basé sur le point le plus bas
          correctionVector.set(0, penetration, 0);
        }
      }
    }

    // Si collision détectée, corriger
    if (needsCorrection) {
      // Remonter le kite au-dessus du sol
      transform.position.add(correctionVector);

      // Annuler la composante verticale de la vitesse (rebond amorti)
      if (physics.velocity.y < 0) {
        physics.velocity.y *= -0.1; // Rebond très amorti pour stabilité
      }

      // Amortir les rotations pour stabiliser
      physics.angularVelocity.multiplyScalar(0.95); // Réduit l'amortissement pour un rebond plus naturel

      
    }
  }

  /**
   * Vérifie si une matrice 3x3 est valide (pas de NaN ou Infinity)
   */
  private isValidMatrix3(matrix: THREE.Matrix3): boolean {
    const elements = matrix.elements;
    for (let i = 0; i < 9; i++) {
      if (!Number.isFinite(elements[i])) {
        return false;
      }
    }
    return true;
  }
}
