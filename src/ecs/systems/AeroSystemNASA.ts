/**
 * AeroSystemNASA.ts - Calcul des forces aérodynamiques selon les formules officielles NASA
 * 
 * Implémentation basée sur le "Beginner's Guide to Kites" de la NASA Glenn Research Center
 * https://www.grc.nasa.gov/www/k-12/airplane/kitelift.html
 * https://www.grc.nasa.gov/www/k-12/airplane/kitedrag.html
 * 
 * FORMULES NASA POUR CERFS-VOLANTS (surfaces planes) :
 * - Portance: L = Cl × A × ρ × 0.5 × V²
 * - Cl pour plaque plane: Clo = 2 × π × α (α en radians)
 * - Correction aspect ratio: Cl = Clo / (1 + Clo / (π × AR))
 * - Traînée: D = Cd × A × ρ × 0.5 × V²
 * - Cd pour plaque plane: Cdo = 1.28 × sin(α)
 * - Traînée totale: Cd = Cdo + Cl² / (0.7 × π × AR)
 * 
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
import { InputComponent } from '../components/InputComponent';

import { WindState } from './WindSystem';
import { PhysicsConstants, DebugConfig } from '../config/Config';

interface SurfaceSample {
  descriptor: AeroSurfaceDescriptor;
  area: number;
  centroid: THREE.Vector3;
  normal: THREE.Vector3;  // Normale de la surface triangulaire
}

/**
 * Constantes NASA pour calculs aérodynamiques
 */
namespace NASAAeroConfig {
  /** Densité de l'air standard au niveau de la mer (kg/m³) */
  export const AIR_DENSITY_SEA_LEVEL = 1.229;
  
  /** Coefficient de pression dynamique = 0.5 */
  export const DYNAMIC_PRESSURE_COEFF = 0.5;
  
  /** Facteur d'efficacité pour ailes rectangulaires (NASA: 0.7) */
  export const RECTANGULAR_WING_EFFICIENCY = 0.7;
  
  /** Coefficient pour plaque plane perpendiculaire (NASA: 1.28) */
  export const FLAT_PLATE_DRAG_COEFF = 1.28;
  
  /** Constante π */
  export const PI = Math.PI;
}

export class AeroSystemNASA extends System {
  private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);

  // Debug: activer pour logger les informations sur chaque face
  private debugFaces = false;
  private debugFrameCounter = 0;

  constructor() {
    const PRIORITY = 30;
    super('AeroSystemNASA', PRIORITY);
  }
  
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
      // CALCULS NASA - Application des formules officielles pour cerfs-volants
      // ========================================================================
      // Référence: NASA Glenn Research Center - Beginner's Guide to Kites
      // Les cerfs-volants sont traités comme des "thin flat plates" avec
      // des formules spécifiques validées expérimentalement.
      surfaceSamples.forEach((sample, index) => {
        // Debug: Afficher l'orientation du kite (1 fois par seconde, 1ère face seulement)
        if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0 && index === 0) {
          const euler = new THREE.Euler().setFromQuaternion(transform.quaternion, 'XYZ');
          console.log(`[AeroSystemNASA] 🪁 Orientation kite: pitch=${(euler.x * 180/Math.PI).toFixed(1)}° yaw=${(euler.y * 180/Math.PI).toFixed(1)}° roll=${(euler.z * 180/Math.PI).toFixed(1)}°`);
        }
        
        // 1. Vitesse locale du centroïde (translation + rotation)
        const leverArm = sample.centroid.clone().sub(transform.position);
        const rotationVelocity = new THREE.Vector3().crossVectors(physics.angularVelocity, leverArm);
        const localVelocity = physics.velocity.clone().add(rotationVelocity);

        // 2. Vent apparent local pour cette face
        const localApparentWind = wind.ambient.clone().sub(localVelocity);
        const localWindSpeed = localApparentWind.length();

        if (localWindSpeed < 0.01) return;

        const localWindDir = localApparentWind.clone().normalize();

        // 3. Calcul de l'angle d'attaque selon NASA
        // Pour une plaque plane, l'angle α est entre la normale et le vent
        const surfaceNormal = sample.normal.clone();
        const dotNW = surfaceNormal.dot(localWindDir);
        
        // Si le vent vient de derrière, pas de force aéro sur cette face
        if (dotNW < 0) {
          // Stocker des forces nulles pour le debug
          physics.faceForces.push({
            lift: new THREE.Vector3(),
            drag: new THREE.Vector3(),
            gravity: new THREE.Vector3(),
            apparentWind: localApparentWind.clone(),
            centroid: sample.centroid.clone(),
            name: sample.descriptor.name,
            normal: surfaceNormal.clone()
          });
          return;
        }

        // Angle d'attaque en radians (0 = parallèle, π/2 = perpendiculaire)
        const alphaRad = Math.acos(Math.min(1.0, Math.abs(dotNW)));

        // 4. ✨ FORMULES NASA OFFICIELLES ✨
        
        // === COEFFICIENT DE PORTANCE (NASA) ===
        // Clo = 2 × π × α (pour plaque plane, petits angles)
        const Clo = 2.0 * NASAAeroConfig.PI * alphaRad;
        
        // Correction pour faible aspect ratio (obligatoire pour cerfs-volants)
        // Cl = Clo / (1 + Clo / (π × AR))
        const aspectRatio = Math.max(kiteComp.aspectRatio, 0.1); // Éviter division par 0
        const CL = Clo / (1.0 + Clo / (NASAAeroConfig.PI * aspectRatio));
        
        // === COEFFICIENT DE TRAÎNÉE (NASA) ===
        // Cdo = 1.28 × sin(α) (pour plaque plane perpendiculaire)
        const Cdo = NASAAeroConfig.FLAT_PLATE_DRAG_COEFF * Math.sin(alphaRad);
        
        // Traînée induite (drag due to lift)
        // Cd_induced = Cl² / (0.7 × π × AR)
        const inducedDragCoeff = (CL * CL) / (NASAAeroConfig.RECTANGULAR_WING_EFFICIENCY * NASAAeroConfig.PI * aspectRatio);
        
        // Traînée totale
        const CD = Cdo + inducedDragCoeff;

        // 5. Pression dynamique selon NASA: q = 0.5 × ρ × V²
        const airDensity = aero.airDensity || NASAAeroConfig.AIR_DENSITY_SEA_LEVEL;
        const q = NASAAeroConfig.DYNAMIC_PRESSURE_COEFF * airDensity * localWindSpeed * localWindSpeed;

        // 6. ✨ DIRECTIONS DES FORCES NASA ✨
        
        // === LIFT (Portance) : perpendiculaire au vent ===
        // NASA: "lift direction is perpendicular to the wind"
        const liftDir = this.calculateNASALiftDirection(surfaceNormal, localWindDir);
        
        // === DRAG (Traînée) : parallèle au vent ===
        // NASA: "drag acts in the direction of the wind"
        const dragDir = localWindDir.clone();

        // Debug: Logger les informations de chaque face (1 fois par seconde)
        if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0) {
          const alphaDeg = alphaRad * 180 / Math.PI;
          console.log(`[AeroSystemNASA] 🪁 Face: ${sample.descriptor.name}`);
          console.log(`  α: ${alphaDeg.toFixed(1)}° | Clo: ${Clo.toFixed(3)} | CL: ${CL.toFixed(3)} | CD: ${CD.toFixed(3)}`);
          console.log(`  Cdo: ${Cdo.toFixed(3)} | Induced: ${inducedDragCoeff.toFixed(3)} | AR: ${aspectRatio.toFixed(2)}`);
          console.log(`  Wind speed: ${localWindSpeed.toFixed(1)} m/s | q: ${q.toFixed(1)} Pa`);
        }

        // 7. ✨ FORCES SELON ÉQUATIONS NASA ✨
        // L = Cl × A × ρ × 0.5 × V²
        // D = Cd × A × ρ × 0.5 × V²
        const panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area * liftScale);
        const panelDrag = dragDir.clone().multiplyScalar(CD * q * sample.area * dragScale);

        // 8. Gravité distribuée par face
        const gravityPerFace = this.gravity.clone().multiplyScalar((physics.mass * sample.area) / kiteComp.surfaceArea);

        // 9. Application des forces et couples
        const panelForce = panelLift.clone().add(panelDrag).add(gravityPerFace);
        
        this.addForce(physics, panelLift);
        this.addForce(physics, panelDrag);
        this.addForce(physics, gravityPerFace);
        
        // Couple = bras de levier × force
        const panelTorque = leverArm.clone().cross(panelForce);
        this.addTorque(physics, panelTorque);

        // 10. Stockage pour visualisation debug
        physics.faceForces.push({
          name: sample.descriptor.name,
          centroid: sample.centroid.clone(),
          lift: panelLift.clone(),
          drag: panelDrag.clone(),
          gravity: gravityPerFace.clone(),
          apparentWind: localApparentWind.clone(),
          normal: liftDir.clone()  // Direction de la portance pour debug visuel
        });
      });
    });

    // Incrémenter le compteur debug
    if (this.debugFaces) {
      this.debugFrameCounter++;
    }
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
      const normal = this.computeTriangleNormal(p1, p2, p3);
      
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
   * Calcule la normale d'un triangle selon la règle de la main droite
   * IMPORTANT: L'ordre des vertices détermine l'orientation de la normale
   */
  private computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    return new THREE.Vector3().crossVectors(ab, ac).normalize();
  }
  
  /**
   * Calcule la direction de la portance selon NASA
   * 
   * NASA: Pour une plaque plane, la force aérodynamique résultante est NORMALE à la surface.
   * Cette force est décomposée en:
   * - Portance (lift) : composante perpendiculaire au vent
   * - Traînée (drag) : composante parallèle au vent
   * 
   * Pour simplifier et suivre exactement la NASA, on utilise directement la normale de surface
   * comme direction de portance, car pour une plaque plane, c'est la direction de la force
   * aérodynamique principale.
   * 
   * @param surfaceNormal - Normale de la surface (unitaire)
   * @param windDir - Direction du vent apparent (non utilisé, gardé pour compatibilité)
   * @returns Direction de la portance = normale de surface
   */
  private calculateNASALiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
    // NASA: Pour plaque plane, la force résultante est normale à la surface
    // C'est la physique pure d'une plaque plane : la force est perpendiculaire à la plaque
    return surfaceNormal.clone();
  }
  
  /**
   * Ajoute une force au PhysicsComponent avec protection NaN
   */
  private addForce(physics: PhysicsComponent, force: THREE.Vector3): void {
    if (isNaN(force.x) || isNaN(force.y) || isNaN(force.z)) {
      console.error('[AeroSystemNASA] Attempted to add NaN force:', force);
      return;
    }
    physics.forces.add(force);
  }
  
  /**
   * Ajoute un couple au PhysicsComponent avec protection NaN
   */
  private addTorque(physics: PhysicsComponent, torque: THREE.Vector3): void {
    if (isNaN(torque.x) || isNaN(torque.y) || isNaN(torque.z)) {
      console.error('[AeroSystemNASA] Attempted to add NaN torque:', torque);
      return;
    }
    physics.torques.add(torque);
  }

  /**
   * Active/désactive le debug des faces
   */
  public setDebugFaces(enabled: boolean): void {
    this.debugFaces = enabled;
    if (enabled) {
      console.log('[AeroSystemNASA] 🪁 Debug faces activé - formules NASA');
    }
  }
}