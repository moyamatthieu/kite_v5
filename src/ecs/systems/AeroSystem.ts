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
import { InputComponent } from '../components/InputComponent';

import { WindState } from './WindSystem';
import { PhysicsConstants, AeroConfig, DebugConfig } from '../config/Config';

interface SurfaceSample {
  descriptor: AeroSurfaceDescriptor;
  area: number;
  centroid: THREE.Vector3;
  normal: THREE.Vector3;  // Normale de la surface triangulaire
}

export class AeroSystem extends System {
  private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0); // Y est vertical dans Three.js

  // Debug: activer pour logger les informations sur chaque face
  private debugFaces = false;
  private debugFrameCounter = 0;

  constructor() {
    const PRIORITY = 30;
    super('AeroSystem', PRIORITY);
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    const windCache = context.windCache as Map<string, WindState> | undefined;

    if (!windCache) return;

    // Récupérer les paramètres UI (liftScale, dragScale, forceSmoothing)
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
      // CALCUL PAR FACE - Application directe des forces au niveau des faces
      // ========================================================================
      // Traitement des 4 faces du cerf-volant (leftUpper, leftLower, rightUpper, rightLower)
      // Chaque face reçoit ses propres forces aérodynamiques basées sur:
      // - Sa normale (orientation de la surface)
      // - Son angle d'attaque local (selon le vent apparent local)
      // - Sa position (pour le calcul du couple)
      // 
      // L'orientation automatique de la portance (via dot product) garantit
      // que toutes les faces contribuent correctement, qu'elles soient initialement
      // orientées vers l'avant ou vers l'arrière.
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

        // 3. Angle d'attaque pour plaque plane (cerf-volant)
        // dot = normale · vent
        // - dot > 0 : vent frappe la face de devant → génère une force
        // - dot < 0 : vent frappe de derrière → PAS de force
        // - dot = 1 : vent perpendiculaire à la face (impact frontal maximal)
        // - dot = 0 : vent parallèle à la surface (pas d'impact)
        let surfaceNormal = sample.normal.clone();
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
          return; // Pas de force si vent de derrière
        }

        // 4. Coefficient normal pour plaque plane (formule de Rayleigh)
        // C_N = 2 × sin(α) × cos(α) = sin(2α)
        // où α est l'angle entre la normale et le vent
        // dot = cos(α) donc sin(α) = sqrt(1 - dot²)
        const cosAlpha = dotNW; // déjà calculé
        const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
        
        // Coefficient normal pour plaque plane
        const CN = 2.0 * sinAlpha * cosAlpha;
        
        // Pour compatibilité avec le reste du code, on utilise CN comme "CL"
        // et on calcule CD de manière cohérente
        const CL = CN * aero.coefficients.CLAlpha; // Facteur d'échelle pour tuning
        const CD = this.calculateCD(aero, CL, kiteComp.aspectRatio);

        // 5. Pression dynamique locale
        const q = AeroConfig.DYNAMIC_PRESSURE_COEFF * aero.airDensity * localWindSpeed * localWindSpeed;

        // 6. ✨ CERF-VOLANT PHYSICS: Forces pour surface plane
        // Pour un cerf-volant (surface plane sans profil aérodynamique):
        // - Lift (portance) = normale à la face (orientée face au vent)
        // - Drag (traînée) = parallèle au vent apparent
        //
        // Les coefficients CL et CD dosent l'intensité selon l'angle d'attaque
        
        // === LIFT (Portance) : normale à la face ===
        // Pour une surface plane, la force principale est perpendiculaire à la surface
        const liftDir = this.calculateLiftDirection(surfaceNormal, localWindDir);
        
        // === DRAG (Traînée) : parallèle au vent ===
        // Tire le kite dans la direction du vent apparent
        const dragDir = localWindDir.clone();

        // Debug: Logger les informations de chaque face (1 fois par seconde) - désactivé
        // if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0) { ... }

        // 7. Forces locales avec orientation correcte + application des scales UI
        const panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area * liftScale);
        const panelDrag = dragDir.clone().multiplyScalar(CD * q * sample.area * dragScale);

        // 8. ✨ GRAVITÉ DISTRIBUÉE PAR FACE ===
        // La gravité est répartie sur chaque face proportionnellement à son aire
        const gravityPerFace = this.gravity.clone().multiplyScalar((physics.mass * sample.area) / kiteComp.surfaceArea);

        // 9. ✨ APPLICATION DISTRIBUÉE : Appliquer forces directement par face
        // Chaque face génère son propre couple via le bras de levier
        const panelForce = panelLift.clone().add(panelDrag).add(gravityPerFace);
        
        this.addForce(physics, panelLift);
        this.addForce(physics, panelDrag);
        this.addForce(physics, gravityPerFace);
        
        // Couple = bras de levier × force (déjà calculé au début pour la vitesse)
        const panelTorque = leverArm.clone().cross(panelForce);
        this.addTorque(physics, panelTorque);

        // 10. Stockage pour visualisation debug
        physics.faceForces.push({
          name: sample.descriptor.name, // Nom de la face (ex: "leftUpper")
          centroid: sample.centroid.clone(),
          lift: panelLift.clone(),
          drag: panelDrag.clone(),
          gravity: gravityPerFace.clone(),
          apparentWind: localApparentWind.clone(),
          normal: liftDir.clone()  // Stocker la normale orientée pour debug visuel
        });
      });

      // ========================================================================
      // (Gravité n'est plus appliquée globalement - elle l'est par face ci-dessus)
      // ========================================================================
    });

    // Incrémenter le compteur debug pour le logging périodique (seulement si debug activé)
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
   * 
   * IMPORTANT: L'orientation de la normale dépend de l'ordre des vertices:
   * - Sens anti-horaire vu de face → normale pointe vers l'avant
   * - Sens horaire vu de face → normale pointe vers l'arrière
   * 
   * Pour le cerf-volant, toutes les 4 faces (leftUpper, leftLower, rightUpper, rightLower)
   * doivent avoir leurs vertices ordonnés de manière cohérente pour que leurs normales
   * pointent toutes vers l'avant (face au vent) initialement.
   */
  private computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    return new THREE.Vector3().crossVectors(ab, ac).normalize();
  }
  
  /**
   * Calcule la direction de la portance (lift) pour cerf-volant
   * ✨ CERF-VOLANT PHYSIQUE: Pour une surface plane (plaque), la force est normale à la face
   * 
   * Pour un cerf-volant:
   * - La force aérodynamique est perpendiculaire à la surface (normale)
   * - L'intensité est déterminée par le coefficient normal C_N = 2×sin(α)×cos(α)
   * - Seules les faces "face au vent" (dot > 0) génèrent une force
   * 
   * @param surfaceNormal - Normale de la surface (unitaire)
   * @param windDir - Direction du vent apparent (non utilisée, gardée pour compatibilité)
   * @returns Direction du lift = normale de la surface
   */
  private calculateLiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
    // Pour une plaque plane, la force est simplement normale à la surface
    // Le filtrage "face au vent" est fait avant l'appel (dotNW < 0 → return)
    return surfaceNormal.clone();
  }
  
  /**
   * Calcule CD depuis CL (formule polaire parabolique)
   * Formule : CD = CD0 + k × CL² où k = 1 / (π × AR × e)
   */
  private calculateCD(aero: AerodynamicsComponent, CL: number, aspectRatio: number): number {
    const CD0 = aero.coefficients.CD;
    const safeAspectRatio = Math.max(aspectRatio, 0.1);
    const k = 1 / (Math.PI * safeAspectRatio * AeroConfig.OSWALD_EFFICIENCY);
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
