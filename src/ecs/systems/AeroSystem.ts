/**
 * AeroSystem.ts - Calcul des forces aérodynamiques (lift, drag, moment)
 * 
 * MODÈLE PHYSIQUE : Formules NASA pour cerfs-volants
 * ===================================================
 * Basé sur les équations officielles NASA pour plaques planes à faible aspect ratio.
 * Source: https://www.grc.nasa.gov/www/k-12/airplane/kiteaero.html
 * 
 * Pour chaque panneau (face triangulaire) du cerf-volant :
 * 
 * 1. LIFT (Portance) :
 *    CL₀ = 2π × α  (théorie plaque plane, α en radians)
 *    CL = CL₀ / (1 + CL₀ / (π × AR))  (correction faible aspect ratio)
 * 
 * 2. DRAG (Traînée) :
 *    CD₀ = 1.28 × sin(α)  (traînée de forme)
 *    CD = CD₀ + CL² / (0.7 × π × AR)  (traînée induite incluse)
 * 
 * 3. Aspect Ratio : AR = span² / area
 * 
 * Le vent venant de l'arrière d'une face ne génère aucune force.
 * Les forces sont appliquées au centroïde de chaque face pour créer
 * un couple réaliste autour du centre de masse.
 * 
 * Priorité 30 (après WindSystem, avant ConstraintSystem).
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
  private debugFaces = true;  // ✨ ACTIVÉ pour diagnostic
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

      // 🔍 DEBUG: Compter combien de faces génèrent des forces
      let activeFacesCount = 0;

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
        // Debug: Afficher l'orientation du kite (1 fois par seconde, 1ère face seulement)
        if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0 && index === 0) {
          const euler = new THREE.Euler().setFromQuaternion(transform.quaternion, 'XYZ');
          console.log(`\n[AeroSystem] 🪁 Orientation kite: pitch=${(euler.x * 180/Math.PI).toFixed(1)}° yaw=${(euler.y * 180/Math.PI).toFixed(1)}° roll=${(euler.z * 180/Math.PI).toFixed(1)}°`);
          console.log(`[AeroSystem] 🌬️  Vent ambiant: (${wind.ambient.x.toFixed(2)}, ${wind.ambient.y.toFixed(2)}, ${wind.ambient.z.toFixed(2)}) | Vitesse: ${wind.ambient.length().toFixed(2)} m/s`);
          console.log(`[AeroSystem] 📊 Total faces: ${surfaceSamples.length}\n`);
        }
        
        // 1. Vitesse locale du centroïde (translation + rotation)
        const leverArm = sample.centroid.clone().sub(transform.position);
        const rotationVelocity = new THREE.Vector3().crossVectors(physics.angularVelocity, leverArm);
        const localVelocity = physics.velocity.clone().add(rotationVelocity);

        // 🔒 SÉCURITÉ: Détecter vitesses aberrantes (>1000 m/s = problème numérique)
        if (localVelocity.length() > 1000) {
          console.error(`[AeroSystem] ⚠️ Vitesse excessive détectée: ${localVelocity.length().toFixed(2)} m/s - RESET PHYSIQUE`);
          // Réinitialiser la physique pour éviter divergence
          physics.velocity.set(0, 0, 0);
          physics.angularVelocity.set(0, 0, 0);
          return;
        }

        // 2. Vent apparent local pour cette face
        const localApparentWind = wind.ambient.clone().sub(localVelocity);
        const localWindSpeed = localApparentWind.length();

        // 🔒 SÉCURITÉ: Limiter vent apparent à 100 m/s max (360 km/h)
        const localWindSpeed_clamped = Math.min(localWindSpeed, 100);
        
        if (localWindSpeed_clamped < 0.01) return;

        const localWindDir = localApparentWind.clone().normalize();

        // 3. Angle d'attaque pour plaque plane (cerf-volant)
        // CONVENTION: Le vecteur vent pointe OÙ LE VENT VA (velocity vector)
        // dot = normale · vent
        // - dot < 0 : normale opposée au vent → face CAPTE le vent → génère une force ✅
        // - dot > 0 : normale dans le sens du vent → vent par derrière → PAS de force ❌
        // - dot ≈ -1 : vent perpendiculaire à la face (impact frontal maximal)
        // - dot = 0 : vent parallèle à la surface (pas d'impact)
        let surfaceNormal = sample.normal.clone();
        const dotNW = surfaceNormal.dot(localWindDir);
        
        // Si le vent vient de derrière (normale et vent dans même sens), pas de force aéro
        if (dotNW > 0) {
          // 🔍 DEBUG: Logger les faces éliminées
          if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0) {
            console.log(`[AeroSystem] ❌ Face ${sample.descriptor.name}: dotNW=${dotNW.toFixed(3)} > 0 → ÉLIMINÉE (vent de derrière)`);
          }
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

        // 4. ✨ MODÈLE NASA : Coefficients aérodynamiques pour cerfs-volants
        // Source: https://www.grc.nasa.gov/www/k-12/airplane/kiteaero.html
        
        // Angle d'attaque α (angle entre normale et vent)
        // Utiliser |dotNW| car dot < 0 quand face capte le vent (normale opposée au vent)
        const cosAlpha = Math.abs(dotNW);
        const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
        const alpha = Math.acos(Math.min(1, Math.max(0, cosAlpha))); // En radians, dans [0, π/2]
        
        // 🔒 SÉCURITÉ: Limiter l'angle d'attaque pour éviter divergence numérique
        // NASA assume "low angle of attack" - limiter à 30° (0.52 rad) max
        const alpha_clamped = Math.min(alpha, 0.52); // 30° max
        
        // === LIFT COEFFICIENT (NASA) ===
        // CL₀ = 2π × α (théorie plaque plane, valide pour petits angles)
        const CL0 = 2.0 * Math.PI * alpha_clamped;
        
        // Correction pour faible aspect ratio (effet downwash aux extrémités)
        // CL = CL₀ / (1 + CL₀ / (π × AR))
        const AR = Math.max(kiteComp.aspectRatio, 0.5); // AR min = 0.5 pour stabilité
        const CL_raw = CL0 / (1.0 + CL0 / (Math.PI * AR));
        
        // 🔒 SÉCURITÉ: Clamp CL entre -2.0 et 2.0 (valeurs physiquement réalistes)
        const CL = Math.max(-2.0, Math.min(2.0, CL_raw));
        
        // === DRAG COEFFICIENT (NASA) ===
        // CD₀ = 1.28 × sin(α) (traînée de forme pour plaque plane)
        const CD0 = 1.28 * sinAlpha;
        
        // Traînée induite (due à la portance, tourbillons marginaux)
        // CD = CD₀ + CL² / (0.7 × π × AR)
        // où 0.7 est le facteur d'efficacité pour aile rectangulaire
        const CD_induced = (CL * CL) / (0.7 * Math.PI * AR);
        const CD_raw = CD0 + CD_induced;
        
        // 🔒 SÉCURITÉ: Clamp CD entre 0.1 et 3.0
        const CD = Math.max(0.1, Math.min(3.0, CD_raw));

        // 5. Pression dynamique locale (avec vitesse clampée)
        const q = AeroConfig.DYNAMIC_PRESSURE_COEFF * aero.airDensity * localWindSpeed_clamped * localWindSpeed_clamped;

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

        // Compter face active
        activeFacesCount++;

        // 7. Forces locales avec orientation correcte + application des scales UI
        const panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area * liftScale);
        const panelDrag = dragDir.clone().multiplyScalar(CD * q * sample.area * dragScale);

        // Debug: Logger les informations de chaque face (1 fois par seconde)
        if (this.debugFaces && this.debugFrameCounter % DebugConfig.FRAME_LOG_INTERVAL === 0) {
          const alphaDeg = alpha * 180 / Math.PI;
          console.log(`[AeroSystem] ✅ Face: ${sample.descriptor.name}`);
          console.log(`  Normal (monde): (${surfaceNormal.x.toFixed(2)}, ${surfaceNormal.y.toFixed(2)}, ${surfaceNormal.z.toFixed(2)})`);
          console.log(`  Wind: (${localWindDir.x.toFixed(2)}, ${localWindDir.y.toFixed(2)}, ${localWindDir.z.toFixed(2)})`);
          console.log(`  Dot product: ${dotNW.toFixed(3)} (cos α) ✓ VENT DE DEVANT`);
          console.log(`  Lift dir: (${liftDir.x.toFixed(2)}, ${liftDir.y.toFixed(2)}, ${liftDir.z.toFixed(2)})`);
          console.log(`  📐 NASA Model: α=${alphaDeg.toFixed(1)}° (clamped=${(alpha_clamped*180/Math.PI).toFixed(1)}°) | AR=${AR.toFixed(2)} | CL=${CL.toFixed(3)} | CD=${CD.toFixed(3)} (CD₀=${CD0.toFixed(3)} + induced=${CD_induced.toFixed(3)})`);
          console.log(`  💪 Forces: Lift=${panelLift.length().toFixed(2)}N Drag=${panelDrag.length().toFixed(2)}N\n`);
        }

        // 🔒 VALIDATION: Vérifier que les forces sont finies (pas NaN/Infinity)
        if (!isFinite(panelLift.length()) || !isFinite(panelDrag.length())) {
          console.error(`[AeroSystem] ⚠️ Forces non-finies détectées sur ${sample.descriptor.name}:`, {
            panelLift: panelLift.length(),
            panelDrag: panelDrag.length(),
            CL, CD, q, area: sample.area,
            alpha: alpha * 180 / Math.PI,
            windSpeed: localWindSpeed
          });
          return; // Ignorer cette face si forces invalides
        }

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
   * - L'intensité est déterminée par le coefficient CL (modèle NASA)
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
