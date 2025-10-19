/**
 * AeroSystem.ts - Calcul des forces aérodynamiques (lift, drag, moment)
 * 
 * Utilise le vent apparent (de WindSystem) pour calculer les forces aéro.
 * Les forces de portance/traînée sont réparties sur chaque panneau de la toile
 * pour générer un couple réaliste autour du centre de masse.
 * Priorité 30 (après vent, avant contraintes).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import type { Entity } from '../core/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { KiteComponent } from '../components/KiteComponent';
import { AerodynamicsComponent, AeroSurfaceDescriptor } from '../components/AerodynamicsComponent';
import { GeometryComponent } from '../components/GeometryComponent';

import { WindState } from './WindSystem';

// Constantes physiques
const GRAVITY_ACCELERATION = -9.81; // m/s² (vers le bas)
const DYNAMIC_PRESSURE_COEFF = 0.5; // Coefficient de pression dynamique
const OSWALD_EFFICIENCY = 0.8; // Efficacité typique profil delta

interface SurfaceSample {
  descriptor: AeroSurfaceDescriptor;
  area: number;
  centroid: THREE.Vector3;
  normal: THREE.Vector3;  // Normale de la surface triangulaire
}

export class AeroSystem extends System {
  private readonly gravity = new THREE.Vector3(0, GRAVITY_ACCELERATION, 0); // Y est vertical dans Three.js
  
  constructor() {
    const PRIORITY = 30;
    super('AeroSystem', PRIORITY);
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    const windCache = context.windCache as Map<string, WindState> | undefined;

    if (!windCache) return;

    // Pour chaque kite
    const kites = entityManager.query(['kite', 'transform', 'physics', 'aerodynamics', 'geometry']);

    kites.forEach(kite => {
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

      // ========================================================================
      // CALCUL PAR FACE - Application directe des forces au niveau des faces
      // ========================================================================
      // NOTE : Les forces ne sont plus accumulées dans physics.forces ici
      // Chaque face génère un couple via son bras de levier depuis le centre de masse
      surfaceSamples.forEach(sample => {
        // 1. Vitesse locale du centroïde (translation + rotation)
        const leverArm = sample.centroid.clone().sub(transform.position);
        const rotationVelocity = new THREE.Vector3().crossVectors(physics.angularVelocity, leverArm);
        const localVelocity = physics.velocity.clone().add(rotationVelocity);

        // 2. Vent apparent local pour cette face
        const localApparentWind = wind.ambient.clone().sub(localVelocity);
        const localWindSpeed = localApparentWind.length();

        const MINIMUM_WIND_SPEED = 0.01;
        if (localWindSpeed < MINIMUM_WIND_SPEED) return;

        const localWindDir = localApparentWind.clone().normalize();

        // 3. Angle d'attaque local
        const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
        const dotProduct = chord.dot(localWindDir);
        const alpha = Math.asin(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;

        // 4. Coefficients aéro locaux
        const CL = this.calculateCL(aero, alpha);
        const CD = this.calculateCD(aero, CL, kiteComp.aspectRatio);

        // 5. Pression dynamique locale
        const q = DYNAMIC_PRESSURE_COEFF * aero.airDensity * localWindSpeed * localWindSpeed;

        // 6. ✨ MAKANI-INSPIRED: Directions de portance et traînée
        // En aérodynamique standard :
        // - Drag = parallèle au vent (direction du vent apparent)
        // - Lift = perpendiculaire au vent, déterminé par la surface normale
        // 
        // Formule vectorielle (règle de la main droite) :
        // dragDir = vent normalisé
        // liftDir = vent × normale (perpendiculaire au plan vent-normale)
        const dragDir = localWindDir.clone();
        
        // Calculer lift perpendiculaire au vent, utilisant la normale réelle de la surface
        // lift = (wind × normal) × wind = composante de normal perpendiculaire au wind
        // Variante plus claire : lift est dans la direction perpendiculaire au wind, 
        // dans le plan défini par (wind, normal)
        const liftDirRaw = new THREE.Vector3().crossVectors(dragDir, sample.normal);
        const liftDir = liftDirRaw.lengthSq() > 0.0001 
          ? liftDirRaw.normalize() 
          : sample.normal.clone().sub(dragDir.clone().multiplyScalar(dragDir.dot(sample.normal))).normalize();

        // 7. Forces locales avec orientation correcte
        const panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area);
        const panelDrag = dragDir.clone().multiplyScalar(CD * q * sample.area);

        // 8. ✨ APPLICATION DISTRIBUÉE : Appliquer forces directement par face
        // Chaque face génère son propre couple via le bras de levier
        const panelForce = panelLift.clone().add(panelDrag);
        
        this.addForce(physics, panelLift);
        this.addForce(physics, panelDrag);
        
        // Couple = bras de levier × force (déjà calculé au début pour la vitesse)
        const panelTorque = leverArm.clone().cross(panelForce);
        this.addTorque(physics, panelTorque);

        // 9. Stockage pour visualisation debug
        physics.faceForces.push({
          centroid: sample.centroid.clone(),
          lift: panelLift.clone(),
          drag: panelDrag.clone()
        });
      });

      // ========================================================================
      // GRAVITÉ - Force globale appliquée au centre de masse
      // ========================================================================
      const gravityForce = this.gravity.clone().multiplyScalar(physics.mass);
      this.addForce(physics, gravityForce);
    });
  }

  private getSurfaceSamples(aero: AerodynamicsComponent, geometry: GeometryComponent, entity: Entity): SurfaceSample[] {
    const descriptors = this.getSurfaceDescriptors(aero, geometry);
    const samples: SurfaceSample[] = [];

    descriptors.forEach(descriptor => {
      const worldPoints = descriptor.points.map(name => geometry.getPointWorld(name, entity));
      if (worldPoints.some(point => !point)) {
        return;
      }

      const [p1, p2, p3] = worldPoints as THREE.Vector3[];
      const area = this.computeTriangleArea(p1, p2, p3);
      if (area <= 0) {
        return;
      }

      const centroid = this.computeTriangleCentroid(p1, p2, p3);
      const normal = this.computeTriangleNormal(p1, p2, p3);  // ✨ Calculer normale
      
      samples.push({ descriptor, area, centroid, normal });
    });

    return samples;
  }

  private getSurfaceDescriptors(aero: AerodynamicsComponent, geometry: GeometryComponent): AeroSurfaceDescriptor[] {
    if (aero.surfaces.length > 0) {
      return aero.surfaces;
    }

    return geometry.surfaces
      .filter(surface => surface.points.length >= 3)
      .map((surface, index) => ({
        name: surface.points.join('-') || `surface_${index}`,
        points: [surface.points[0], surface.points[1], surface.points[2]] as [string, string, string]
      }));
  }

  private computeTriangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    const cross = new THREE.Vector3().crossVectors(ab, ac);
    return 0.5 * cross.length();
  }

  private computeTriangleCentroid(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return a.clone().add(b).add(c).multiplyScalar(1 / 3);
  }
  
  /**
   * Calcule la normale d'un triangle (règle de la main droite : (b-a) × (c-a))
   * ✨ MAKANI-INSPIRED: Utilisée pour l'orientation des forces aérodynamiques
   */
  private computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    return new THREE.Vector3().crossVectors(ab, ac).normalize();
  }
  
  /**
   * Calcule CL pour un angle d'attaque donné (approximation linéaire)
   * Formule : CL = CLAlpha × (alpha - alpha0)
   */
  private calculateCL(aero: AerodynamicsComponent, alphaDeg: number): number {
    const { CLAlpha, alpha0, alphaOptimal } = aero.coefficients;
    const alphaRelative = alphaDeg - alpha0;
    const sign = Math.sign(alphaRelative);
    const absRelative = Math.abs(alphaRelative);
    const optimal = Math.max(alphaOptimal, 1);
    const stallMargin = 15; // marge après alphaOptimal avant décrochage complet
    const stallLimit = optimal + stallMargin;

    if (absRelative <= optimal) {
      return CLAlpha * alphaRelative;
    }

    const clAtOptimal = CLAlpha * optimal * sign;
    if (absRelative >= stallLimit) {
      return 0;
    }

    const attenuation = 1 - (absRelative - optimal) / Math.max(1, stallLimit - optimal);
    return clAtOptimal * Math.max(attenuation, 0);
  }
  
  /**
   * Calcule CD depuis CL (formule polaire parabolique)
   * Formule : CD = CD0 + k × CL² où k = 1 / (π × AR × e)
   */
  private calculateCD(aero: AerodynamicsComponent, CL: number, aspectRatio: number): number {
    const CD0 = aero.coefficients.CD;
    const safeAspectRatio = Math.max(aspectRatio, 0.1);
    const k = 1 / (Math.PI * safeAspectRatio * OSWALD_EFFICIENCY);
    return CD0 + k * CL * CL;
  }
  
  /**
   * Ajoute une force au PhysicsComponent (remplace l'ancienne méthode du component)
   */
  private addForce(physics: PhysicsComponent, force: THREE.Vector3): void {
    // Protection contre les NaN
    if (isNaN(force.x) || isNaN(force.y) || isNaN(force.z)) {
      console.error('[AeroSystem] Attempted to add NaN force:', force);
      return;
    }
    physics.forces.add(force);
  }
  
  /**
   * Ajoute un couple au PhysicsComponent (remplace l'ancienne méthode du component)
   */
  private addTorque(physics: PhysicsComponent, torque: THREE.Vector3): void {
    // Protection contre les NaN
    if (isNaN(torque.x) || isNaN(torque.y) || isNaN(torque.z)) {
      console.error('[AeroSystem] Attempted to add NaN torque:', torque);
      return;
    }
    physics.torques.add(torque);
  }
}
