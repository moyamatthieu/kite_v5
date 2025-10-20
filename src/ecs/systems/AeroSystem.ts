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

  // Lissage temporel des forces (pour éviter les oscillations brusques)
  private previousForces = new Map<string, THREE.Vector3>(); // entityId -> force lissée
  private previousTorques = new Map<string, THREE.Vector3>(); // entityId -> couple lissé

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
    const forceSmoothing = inputComp?.forceSmoothing ?? 0.0;

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

        // 3. Angle d'attaque local (basé sur la normale du panneau)
        // Pour un cerf-volant : alpha = arccos(|normale · vent|)
        // Cela donne alpha=90° quand le vent frappe frontalement (surface perpendiculaire au vent)
        let surfaceNormal = sample.normal.clone();
        const dotProduct = Math.abs(surfaceNormal.dot(localWindDir));
        const alpha = Math.acos(Math.max(-1, Math.min(1, dotProduct))) * 180 / Math.PI;

        // 4. Coefficients aéro locaux
        const CL = this.calculateCL(aero, alpha);
        const CD = this.calculateCD(aero, CL, kiteComp.aspectRatio);

        // 5. Pression dynamique locale
        const q = DYNAMIC_PRESSURE_COEFF * aero.airDensity * localWindSpeed * localWindSpeed;

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

        // Debug: Logger les informations de chaque face (1 fois par seconde)
        if (this.debugFaces && this.debugFrameCounter % 60 === 0) {
          const dotNW = surfaceNormal.dot(localWindDir);
          const isFlipped = dotNW < 0;
          console.log(`[AeroSystem] Face: ${sample.descriptor.name}`);
          console.log(`  Normal: (${surfaceNormal.x.toFixed(2)}, ${surfaceNormal.y.toFixed(2)}, ${surfaceNormal.z.toFixed(2)})`);
          console.log(`  Wind: (${localWindDir.x.toFixed(2)}, ${localWindDir.y.toFixed(2)}, ${localWindDir.z.toFixed(2)})`);
          console.log(`  Dot product: ${dotNW.toFixed(3)} ${isFlipped ? '(FLIPPED)' : '(OK)'}`);
          console.log(`  Lift dir: (${liftDir.x.toFixed(2)}, ${liftDir.y.toFixed(2)}, ${liftDir.z.toFixed(2)})`);
          console.log(`  Alpha: ${alpha.toFixed(1)}° | CL: ${CL.toFixed(3)} | CD: ${CD.toFixed(3)}`);
        }

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
      // LISSAGE TEMPOREL DES FORCES (optionnel, contrôlé par forceSmoothing)
      // ========================================================================
      if (forceSmoothing > 0) {
        const prevForce = this.previousForces.get(kite.id) ?? physics.forces.clone();
        const prevTorque = this.previousTorques.get(kite.id) ?? physics.torques.clone();

        // Interpolation linéaire : newValue = (1-α) × newValue + α × oldValue
        // forceSmoothing = α (0 = pas de lissage, 1 = lissage maximal)
        physics.forces.lerp(prevForce, forceSmoothing);
        physics.torques.lerp(prevTorque, forceSmoothing);

        // Stocker pour la prochaine frame
        this.previousForces.set(kite.id, physics.forces.clone());
        this.previousTorques.set(kite.id, physics.torques.clone());
      }

      // ========================================================================
      // (Gravité n'est plus appliquée globalement - elle l'est par face ci-dessus)
      // ========================================================================
    });

    // Incrémenter le compteur debug pour le logging périodique
    this.debugFrameCounter++;
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
   * Calcule la direction de la portance (lift) correctement orientée
   * ✨ CERF-VOLANT PHYSIQUE: Pour une surface plane, la portance est normale à la face
   * 
   * Pour un cerf-volant (surface plane sans profil aérodynamique):
   * - La force aérodynamique principale est perpendiculaire à la surface
   * - Lift = force normale à la face (orientée face au vent)
   * - Drag = composante parallèle au vent
   * - Les coefficients CL et CD dosent l'intensité de chaque force
   * 
   * Cette méthode fonctionne pour TOUTES les faces du cerf-volant:
   * - leftUpper et rightUpper (faces supérieures gauche/droite)
   * - leftLower et rightLower (faces inférieures gauche/droite)
   * 
   * L'orientation automatique (dot product) garantit que la normale pointe
   * toujours face au vent, quelle que soit l'orientation initiale de la face.
   * 
   * @param surfaceNormal - Normale de la surface (unitaire)
   * @param windDir - Direction du vent apparent (unitaire)
   * @returns Direction du lift = normale orientée face au vent
   */
  private calculateLiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
    // S'assurer que la normale pointe face au vent
    // Si normale·vent < 0, la normale pointe dans le sens opposé au vent → inverser
    // Cela fonctionne automatiquement pour toutes les faces (internes et externes)
    const dotNW = surfaceNormal.dot(windDir);
    return dotNW < 0 ? surfaceNormal.clone().negate() : surfaceNormal.clone();
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
