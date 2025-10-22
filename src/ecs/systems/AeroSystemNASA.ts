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

  // === STALL MODELING ===
  /** Angle de décrochage (stall) en radians - ~15° pour plaque plane */
  export const STALL_ANGLE_RAD = (15 * Math.PI) / 180;

  /** Post-stall CL max (coefficient de portance au stall) */
  export const CL_MAX = 1.2;

  /** Post-stall CD (traînée augmentée après stall) */
  export const CD_STALL = 1.8;

  // === MOMENT COEFFICIENTS ===
  /** Coefficient de moment de tangage (pitch) - Négatif = stable */
  export const CM_PITCH = -0.05;

  /** Coefficient de moment de lacet (yaw) dû à l'asymétrie */
  export const CM_YAW = -0.02;

  /** Coefficient de moment de roulis (roll) dû à l'asymétrie */
  export const CM_ROLL = -0.03;

  // === CENTER OF PRESSURE ===
  /** Position du centre de pression par rapport au centre géométrique (% chord) */
  export const CP_POSITION_RATIO = 0.25;
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

        // ✅ CORRECTION NASA: Alpha = angle entre SURFACE et vent
        // NASA: α = 0° → surface parallèle au vent (pas de portance)
        //       α = 90° → surface perpendiculaire au vent (portance max)
        // dotNW = cos(angle entre normale et vent)
        // Alpha = π/2 - angle_normale = asin(dotNW)
        const alphaRad = Math.asin(Math.min(1.0, Math.abs(dotNW)));

        // 4. ✨ FORMULES NASA OFFICIELLES PURES ✨
        // Sources: kitelift.html, kitedrag.html, kitedown.html

        const aspectRatio = Math.max(kiteComp.aspectRatio, 0.1); // Éviter division par 0

        // === FORMULES NASA POUR PLAQUES PLANES ===
        // Note: La NASA ne mentionne PAS de décrochage brutal pour les plaques planes.
        // Les plaques planes ont un comportement linéaire jusqu'à ~30-40° contrairement aux profils aérodynamiques.

        // Coefficient de portance (Source: kitelift.html lignes 173-210)
        const Clo = 2.0 * NASAAeroConfig.PI * alphaRad;  // Formule linéaire théorique
        const CL = Clo / (1.0 + Clo / (NASAAeroConfig.PI * aspectRatio)); // Correction aspect ratio + downwash

        // Coefficient de traînée (Source: kitedrag.html lignes 178-213)
        const Cdo = NASAAeroConfig.FLAT_PLATE_DRAG_COEFF * Math.sin(alphaRad);  // Traînée de forme
        const inducedDrag = (CL * CL) / (NASAAeroConfig.RECTANGULAR_WING_EFFICIENCY * NASAAeroConfig.PI * aspectRatio); // Traînée induite
        const CD = Cdo + inducedDrag;  // Traînée totale

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

        // Debug: Logger les informations de chaque face (1 fois par seconde) - désactivé
        // if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0) { ... }

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

        // === 9b. MOMENTS AERODYNAMIQUES (Pitch, Yaw, Roll) ===
        // Les moments aérodynamiques sont essentiels pour la stabilité
        // M = CM × q × S × chord (pour pitch)

        // Chord du kite (longueur caractéristique)
        const chord = kiteComp.chord || 0.65;

        // // Moment de tangage (pitch) - Stabilité longitudinale
        // const pitchMoment = NASAAeroConfig.CM_PITCH * q * sample.area * chord;
        // const pitchAxis = new THREE.Vector3(1, 0, 0); // Axe X (latéral)
        // const pitchTorque = pitchAxis.multiplyScalar(pitchMoment);
        // this.addTorque(physics, pitchTorque);

        // // Moment de lacet (yaw) - Stabilité directionnelle
        // const yawMoment = NASAAeroConfig.CM_YAW * q * sample.area * chord;
        // const yawAxis = new THREE.Vector3(0, 1, 0); // Axe Y (vertical)
        // const yawTorque = yawAxis.multiplyScalar(yawMoment);
        // this.addTorque(physics, yawTorque);

        // // Moment de roulis (roll) - Stabilité latérale
        // const rollMoment = NASAAeroConfig.CM_ROLL * q * sample.area * chord;
        // const rollAxis = new THREE.Vector3(0, 0, 1); // Axe Z (longitudinal)
        // const rollTorque = rollAxis.multiplyScalar(rollMoment);
        // this.addTorque(physics, rollTorque);

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
   * ✅ CORRECTION NASA (Source: kitelift.html lignes 106-107)
   * NASA: "lift direction is perpendicular to the wind"
   *
   * La force aérodynamique sur une plaque plane est décomposée en:
   * - Portance (lift) : composante PERPENDICULAIRE au vent
   * - Traînée (drag) : composante PARALLÈLE au vent
   *
   * Méthode: Projection de la normale de surface sur le plan perpendiculaire au vent
   * liftDir = normale - (normale · vent) * vent, puis normalisé
   *
   * @param surfaceNormal - Normale de la surface (unitaire)
   * @param windDir - Direction du vent apparent (unitaire)
   * @returns Direction de la portance (unitaire, perpendiculaire au vent)
   */
  private calculateNASALiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
    // Méthode: Projection de la normale sur le plan perpendiculaire au vent
    // liftDir = normale - (normale · vent) * vent
    const projection = surfaceNormal.dot(windDir);
    const liftDir = surfaceNormal.clone()
      .sub(windDir.clone().multiplyScalar(projection))
      .normalize();

    // Protection contre les vecteurs nuls (si normale parallèle au vent)
    if (liftDir.lengthSq() < 0.0001) {
      // Si la normale est parallèle au vent, pas de portance
      // Retourner direction arbitraire vers le haut (Cl sera ~0 de toute façon)
      return new THREE.Vector3(0, 1, 0);
    }

    return liftDir;
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
    // Debug log removed
  }
}