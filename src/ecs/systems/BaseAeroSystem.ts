/**
 * BaseAeroSystem.ts - Classe abstraite pour les systèmes aérodynamiques
 *
 * Factorise le code commun entre AeroSystem et AeroSystemNASA:
 * - Calcul de vitesse locale (translation + rotation)
 * - Calcul du vent apparent local
 * - Détection du vent de derrière
 * - Application des forces par face
 * - Gestion de la gravité
 *
 * Les sous-classes doivent uniquement implémenter le calcul des coefficients CL/CD.
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import type { Entity } from '../core/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { KiteComponent } from '../components/KiteComponent';
import { AerodynamicsComponent, AeroSurfaceDescriptor } from '../components/AerodynamicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { InputComponent } from '../components/InputComponent';

import { WindState } from './WindSystem';
import { PhysicsConstants } from '../config/Config';

/**
 * Interface pour une surface échantillonnée
 */
export interface SurfaceSample {
  descriptor: AeroSurfaceDescriptor;
  area: number;
  centroid: THREE.Vector3;
  normal: THREE.Vector3;
}

/**
 * Résultat du calcul de vent local
 */
export interface LocalWindResult {
  windVector: THREE.Vector3;
  windSpeed: number;
  windDirection: THREE.Vector3;
}

/**
 * Coefficients aérodynamiques calculés
 */
export interface AeroCoefficients {
  CL: number; // Coefficient de portance
  CD: number; // Coefficient de traînée
}

/**
 * Classe abstraite pour systèmes aérodynamiques
 */
export abstract class BaseAeroSystem extends System {
  protected readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);

  constructor(name: string, priority: number) {
    super(name, priority);
  }

  /**
   * Méthode principale - Mise à jour du système
   */
  update(context: SimulationContext): void {
    const { entityManager } = context;
    const windCache = context.windCache as Map<string, WindState> | undefined;

    if (!windCache) return;

    // Récupérer les paramètres UI (liftScale, dragScale)
    const inputEntities = entityManager.query(['Input']);
    const inputComp = inputEntities.length > 0
      ? inputEntities[0].getComponent<InputComponent>('Input')
      : null;

    const liftScale = inputComp?.liftScale ?? 1.0;
    const dragScale = inputComp?.dragScale ?? 1.0;

    // Pour chaque kite
    const kites = entityManager.query(['kite', 'transform', 'physics', 'aerodynamics', 'geometry']);

    kites.forEach(kite => {
      this.processKite(kite, windCache, liftScale, dragScale);
    });
  }

  /**
   * Traite un kite individuel
   */
  private processKite(
    kite: Entity,
    windCache: Map<string, WindState>,
    liftScale: number,
    dragScale: number
  ): void {
    const transform = kite.getComponent<TransformComponent>('transform')!;
    const physics = kite.getComponent<PhysicsComponent>('physics')!;
    const kiteComp = kite.getComponent<KiteComponent>('kite')!;
    const aero = kite.getComponent<AerodynamicsComponent>('aerodynamics')!;
    const geometry = kite.getComponent<GeometryComponent>('geometry')!;

    // Réinitialiser les forces
    physics.faceForces = [];

    const wind = windCache.get(kite.id);
    if (!wind) return;

    const surfaceSamples = this.getSurfaceSamples(aero, geometry, kite);
    if (surfaceSamples.length === 0) return;

    // Traiter chaque face
    surfaceSamples.forEach(sample => {
      this.processSurface(sample, transform, physics, kiteComp, aero, wind, liftScale, dragScale);
    });
  }

  /**
   * Traite une surface individuelle
   */
  private processSurface(
    sample: SurfaceSample,
    transform: TransformComponent,
    physics: PhysicsComponent,
    kiteComp: KiteComponent,
    aero: AerodynamicsComponent,
    wind: WindState,
    liftScale: number,
    dragScale: number
  ): void {
    // 1. Calcul du vent local
    const localWind = this.calculateLocalWind(sample, transform, physics, wind);

    if (localWind.windSpeed < 0.01) {
      // Pas assez de vent, stocker des forces nulles
      this.storeFaceForces(physics, sample, new THREE.Vector3(), new THREE.Vector3(), localWind.windVector);
      return;
    }

    // 2. Vérifier si le vent vient de derrière
    const dotNW = sample.normal.dot(localWind.windDirection);
    if (dotNW < 0) {
      // Vent de derrière, pas de force
      this.storeFaceForces(physics, sample, new THREE.Vector3(), new THREE.Vector3(), localWind.windVector);
      return;
    }

    // 3. Calculer les coefficients (implémentation spécifique à chaque sous-classe)
    const coeffs = this.calculateCoefficients(
      dotNW,
      sample,
      aero,
      kiteComp,
      localWind
    );

    // 4. Calculer les forces aérodynamiques
    const forces = this.calculateAeroForces(
      sample,
      localWind,
      coeffs,
      aero,
      liftScale,
      dragScale
    );

    // 5. Appliquer les forces
    this.applyForces(forces.lift, forces.drag, sample, transform, physics);

    // 6. Stocker pour debug
    this.storeFaceForces(physics, sample, forces.lift, forces.drag, localWind.windVector);
  }

  /**
   * Calcule le vent local pour une surface
   */
  protected calculateLocalWind(
    sample: SurfaceSample,
    transform: TransformComponent,
    physics: PhysicsComponent,
    wind: WindState
  ): LocalWindResult {
    // Vitesse locale du centroïde (translation + rotation)
    const leverArm = sample.centroid.clone().sub(transform.position);
    const rotationVelocity = new THREE.Vector3().crossVectors(physics.angularVelocity, leverArm);
    const localVelocity = physics.velocity.clone().add(rotationVelocity);

    // Vent apparent local
    const windVector = wind.ambient.clone().sub(localVelocity);
    const windSpeed = windVector.length();
    const windDirection = windSpeed > 0.01 ? windVector.clone().normalize() : new THREE.Vector3();

    return { windVector, windSpeed, windDirection };
  }

  /**
   * Calcule les forces aérodynamiques (lift et drag)
   */
  protected calculateAeroForces(
    sample: SurfaceSample,
    localWind: LocalWindResult,
    coeffs: AeroCoefficients,
    aero: AerodynamicsComponent,
    liftScale: number,
    dragScale: number
  ): { lift: THREE.Vector3; drag: THREE.Vector3 } {
    // Pression dynamique: q = 0.5 × ρ × V²
    const q = 0.5 * aero.airDensity * localWind.windSpeed * localWind.windSpeed;

    // Magnitudes des forces
    const liftMagnitude = coeffs.CL * sample.area * q * liftScale;
    const dragMagnitude = coeffs.CD * sample.area * q * dragScale;

    // Direction de portance: perpendiculaire au vent (selon la normale)
    const liftDirection = sample.normal.clone().normalize();

    // Direction de traînée: parallèle au vent
    const dragDirection = localWind.windDirection.clone();

    // Vecteurs de force
    const lift = liftDirection.multiplyScalar(liftMagnitude);
    const drag = dragDirection.multiplyScalar(dragMagnitude);

    return { lift, drag };
  }

  /**
   * Applique les forces au kite
   */
  protected applyForces(
    lift: THREE.Vector3,
    drag: THREE.Vector3,
    sample: SurfaceSample,
    transform: TransformComponent,
    physics: PhysicsComponent
  ): void {
    // Force totale
    const totalForce = lift.clone().add(drag);
    physics.forces.add(totalForce);

    // Calcul du torque (τ = r × F)
    const leverArm = sample.centroid.clone().sub(transform.position);
    const torque = new THREE.Vector3().crossVectors(leverArm, totalForce);
    physics.torques.add(torque);
  }

  /**
   * Stocke les forces pour le debug
   */
  protected storeFaceForces(
    physics: PhysicsComponent,
    sample: SurfaceSample,
    lift: THREE.Vector3,
    drag: THREE.Vector3,
    apparentWind: THREE.Vector3
  ): void {
    physics.faceForces.push({
      lift: lift.clone(),
      drag: drag.clone(),
      gravity: new THREE.Vector3(),
      apparentWind: apparentWind.clone(),
      centroid: sample.centroid.clone(),
      name: sample.descriptor.name,
      normal: sample.normal.clone()
    });
  }

  /**
   * Récupère les échantillons de surface depuis les composants
   */
  protected getSurfaceSamples(
    aero: AerodynamicsComponent,
    geometry: GeometryComponent,
    kite: Entity
  ): SurfaceSample[] {
    return aero.surfaces.map(descriptor => {
      const vertices = descriptor.points.map((vertexName: string) =>
        geometry.getPointWorld(vertexName, kite)!
      );

      if (vertices.some((v: THREE.Vector3 | undefined) => !v)) {
        return null;
      }

      // Calcul aire et centroïde du triangle
      const v1 = vertices[0];
      const v2 = vertices[1];
      const v3 = vertices[2];

      const edge1 = new THREE.Vector3().subVectors(v2, v1);
      const edge2 = new THREE.Vector3().subVectors(v3, v1);
      const cross = new THREE.Vector3().crossVectors(edge1, edge2);

      const area = cross.length() * 0.5;
      const normal = cross.normalize();
      const centroid = new THREE.Vector3()
        .add(v1)
        .add(v2)
        .add(v3)
        .divideScalar(3);

      return {
        descriptor,
        area,
        centroid,
        normal
      };
    }).filter(sample => sample !== null) as SurfaceSample[];
  }

  /**
   * MÉTHODE ABSTRAITE : Calcule les coefficients aérodynamiques (CL, CD)
   *
   * Chaque sous-classe doit implémenter cette méthode avec son propre modèle:
   * - AeroSystem: Formule de Rayleigh pour plaque plane
   * - AeroSystemNASA: Formules NASA officielles avec stall modeling
   *
   * @param dotNW - Produit scalaire entre normale et direction du vent
   * @param sample - Surface échantillonnée
   * @param aero - Composant aérodynamique
   * @param kiteComp - Composant kite
   * @param localWind - Résultat du calcul de vent local
   * @returns Coefficients CL et CD
   */
  protected abstract calculateCoefficients(
    dotNW: number,
    sample: SurfaceSample,
    aero: AerodynamicsComponent,
    kiteComp: KiteComponent,
    localWind: LocalWindResult
  ): AeroCoefficients;
}
