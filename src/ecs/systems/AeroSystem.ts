/**
 * AeroSystem.ts - Calcul des forces aérodynamiques selon les formules NASA
 *
 * Implémentation basée sur le "Beginner's Guide to Kites" de la NASA Glenn Research Center
 * https://www.grc.nasa.gov/www/k-12/airplane/kitelift.html
 * https://www.grc.nasa.gov/www/k-12/airplane/kitedrag.html
 *
 * FORMULES NASA POUR PLAQUES PLANES :
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
import { PhysicsConstants, NASAAeroConfig } from '../config/Config';
import { MathUtils } from '../utils/MathUtils';
import { Logger } from '../utils/Logging';

import { WindState } from './WindSystem';

interface SurfaceSample {
  descriptor: AeroSurfaceDescriptor;
  area: number;
  centroid: THREE.Vector3;
  centerOfPressure: THREE.Vector3;  // Centre de pression (point d'application des forces aéro)
  normal: THREE.Vector3;  // Normale de la surface triangulaire
}

/**
 * Constantes NASA pour calculs aérodynamiques (importées depuis Config.ts)
 */

export class AeroSystem extends System {
  private readonly gravity = new THREE.Vector3(0, -PhysicsConstants.GRAVITY, 0);
  private readonly logger = Logger.getInstance();

  // Debug: activer pour logger les informations sur chaque face
  private debugFaces = false;
  private debugFrameCounter = 0;
  private debugSurfaceIndex = 0; // Surface à déboguer (-1 = toutes)

  // Lissage temporel des forces (stabilité numérique)
  private previousForces: Map<string, THREE.Vector3> = new Map();
  private previousTorques: Map<string, THREE.Vector3> = new Map();

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
    const forceSmoothing = inputComp?.forceSmoothing ?? 0.3;

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
      if (!wind) {
        this.logger.warn('Pas de vent dans le cache', 'AeroSystem');
        return;
      }

      const surfaceSamples = this.getSurfaceSamples(aero, geometry, kite);
        // console.warn(`⚠️ [AeroSystemNASA] Aucune surface détectée`);
      
      // 🔍 DEBUG: Log le vent ambiant (uniquement si CONFIG.debug.enabled)
      if (this.debugFaces && this.debugFrameCounter % 60 === 0) {
        const logger = (globalThis as any).__kiteLogger;
        if (logger?.enabled) {
          logger.log(`💨 [AeroSystem] Vent ambiant: (${wind.ambient.x.toFixed(2)}, ${wind.ambient.y.toFixed(2)}, ${wind.ambient.z.toFixed(2)}) | vitesse=${wind.ambient.length().toFixed(2)} m/s`);
        }
      }

      // ========================================================================
      // CALCULS NASA - Application des formules officielles pour cerfs-volants
      // ========================================================================
      // Référence: NASA Glenn Research Center - Beginner's Guide to Kites
      // Les cerfs-volants sont traités comme des "thin flat plates" avec
      // des formules spécifiques validées expérimentalement.
      surfaceSamples.forEach((sample, index) => {
        // === GRAVITÉ - TOUJOURS APPLIQUÉE (indépendante du vent) ===
        const gravityPerFace = this.gravity.clone().multiplyScalar((physics.mass * sample.area) / kiteComp.surfaceArea);
        this.addForce(physics, gravityPerFace);

        // Calcul du vent apparent local avec validation
        const centerOfMass = transform.position; // CoM ≈ centre géométrique pour kite delta
        const leverArm = sample.centerOfPressure.clone().sub(centerOfMass);
        
        // Vitesse au point d'application (CP) due à la rotation du kite
        // v_rotation = ω × r
        const rotationVelocity = new THREE.Vector3().crossVectors(physics.angularVelocity, leverArm);

        // Vitesse totale du point d'application dans l'espace monde
        // v_total = v_CoM + v_rotation
        const pointVelocity = physics.velocity.clone().add(rotationVelocity);

        // Validation avec MathUtils
        if (!MathUtils.ensureFinite(wind.ambient, `wind.ambient for ${sample.descriptor.name}`)) {
          this.logger.error(`Invalid wind.ambient for ${sample.descriptor.name}`, 'AeroSystem');
          return;
        }
        if (!MathUtils.ensureFinite(pointVelocity, `pointVelocity for ${sample.descriptor.name}`)) {
          this.logger.error(`Invalid pointVelocity for ${sample.descriptor.name}`, 'AeroSystem');
          return;
        }

        // Vent apparent = vent ambiant - vitesse du point
        const localApparentWind = wind.ambient.clone().sub(pointVelocity);
        let localWindSpeed = localApparentWind.length();

        if (localWindSpeed > NASAAeroConfig.MAX_APPARENT_WIND_SPEED) {
          localApparentWind.setLength(NASAAeroConfig.MAX_APPARENT_WIND_SPEED);
          localWindSpeed = NASAAeroConfig.MAX_APPARENT_WIND_SPEED;
        }

        // Si pas de vent apparent, seules les forces gravitationnelles s'appliquent
        const MIN_APPARENT_WIND_SPEED = 0.01;
        if (localWindSpeed < MIN_APPARENT_WIND_SPEED) {
          // Stocker pour debug même sans vent
          physics.faceForces.push({
            name: sample.descriptor.name,
            centroid: sample.centerOfPressure.clone(),
            lift: new THREE.Vector3(),
            drag: new THREE.Vector3(),
            gravity: gravityPerFace.clone(),
            apparentWind: localApparentWind.clone(),
            normal: sample.normal.clone()
          });
          return; // Pas de forces aérodynamiques
        }

        // ✅ Normaliser le vent APRÈS vérifier que sa longueur est non-nulle
        // Sinon normalize() sur un vecteur ~0 crée des NaN
        const localWindDir = localApparentWind.clone().normalize();
        if (!MathUtils.ensureFinite(localWindDir, `localWindDir for ${sample.descriptor.name}`)) {
          return;
        }

        // 3. Calcul de l'angle d'attaque selon NASA
        //
        // ✅ DÉFINITION NASA DE L'ANGLE D'ATTAQUE (pour plaques planes) ✅
        // Source: NASA Glenn Research Center - "Beginner's Guide to Aerodynamics"
        // https://www.grc.nasa.gov/www/k-12/airplane/incline.html
        //
        // Pour une plaque plane inclinée:
        // - α = angle entre la NORMALE et la direction du vent
        // - α = 0° : normale alignée avec le vent (plaque perpendiculaire, traînée max)
        // - α = 90° : normale perpendiculaire au vent (plaque parallèle, portance nulle)
        //
        // Les formules NASA CL = 2π×α utilisent cet angle directement
        let surfaceNormal = sample.normal.clone();
        let dotNW = surfaceNormal.dot(localWindDir);

        // ✅ AUTO-CORRECTION DE L'ORIENTATION DE LA NORMALE ✅
        // Si dotNW < 0, la normale pointe "à l'envers" par rapport au vent
        // (ordre des vertices défini dans la géométrie)
        // Solution: inverser la normale pour qu'elle pointe toujours vers le vent
        // Ainsi la portance sera calculée du bon côté automatiquement
        if (dotNW < 0) {
          surfaceNormal.negate();
          dotNW = -dotNW; // Recalculer avec normale inversée
          // console.warn(`⚠️ [AeroSystemNASA] ${sample.descriptor.name}: Normale inversée (vent de l'autre côté)`);
        }

        // Angle d'attaque (toujours positif maintenant car dotNW >= 0)
        const alphaRad = Math.acos(Math.max(0.0, Math.min(1.0, dotNW)));
        const alphaDeg = alphaRad * 180 / Math.PI;

        const aspectRatio = Math.max(kiteComp.aspectRatio, 0.1);

        // === FORMULES NASA POUR PLAQUES PLANES ===
        const { CL, Clo } = this.computeLiftCoefficient(alphaRad, aspectRatio);
        const { CD, Cdo } = this.computeDragCoefficient(alphaRad, aspectRatio, CL);

        // 5. Pression dynamique selon NASA
        const airDensity = aero.airDensity || NASAAeroConfig.AIR_DENSITY_SEA_LEVEL;
        const q = NASAAeroConfig.DYNAMIC_PRESSURE_COEFF * airDensity * localWindSpeed * localWindSpeed;

        // 6. Directions des forces NASA
  const liftDir = this.calculateNASALiftDirection(surfaceNormal, localWindDir);
        const dragDir = localWindDir.clone();

        // 7. Forces selon équations NASA
        let panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area * liftScale);
        let panelDrag = dragDir.clone().multiplyScalar(CD * q * sample.area * dragScale);

        // Validation NaN avec MathUtils
        if (!MathUtils.ensureFinite(panelLift, `panelLift for ${sample.descriptor.name}`)) {
          this.logger.error(`NaN detected in panelLift calculation for ${sample.descriptor.name}`, 'AeroSystem');
          panelLift.set(0, 0, 0);
        }

        if (!MathUtils.ensureFinite(panelDrag, `panelDrag for ${sample.descriptor.name}`)) {
          this.logger.error(`NaN detected in panelDrag calculation for ${sample.descriptor.name}`, 'AeroSystem');
          panelDrag.set(0, 0, 0);
        }

        // 🛡️ SAFETY CAP: Limiter les forces par surface pour éviter instabilité
        const liftMag = panelLift.length();
        const dragMag = panelDrag.length();

        if (liftMag > NASAAeroConfig.MAX_FORCE_PER_SURFACE) {
          panelLift.normalize().multiplyScalar(NASAAeroConfig.MAX_FORCE_PER_SURFACE);
          this.logger.warn(`${sample.descriptor.name}: Portance excessive ${liftMag.toFixed(1)}N → plafonnée à ${NASAAeroConfig.MAX_FORCE_PER_SURFACE}N`, 'AeroSystem');
        }

        if (dragMag > NASAAeroConfig.MAX_FORCE_PER_SURFACE) {
          panelDrag.normalize().multiplyScalar(NASAAeroConfig.MAX_FORCE_PER_SURFACE);
          this.logger.warn(`${sample.descriptor.name}: Traînée excessive ${dragMag.toFixed(1)}N → plafonnée à ${NASAAeroConfig.MAX_FORCE_PER_SURFACE}N`, 'AeroSystem');
        }

        // console.warn(`⚠️ [AeroSystemNASA] ${sample.descriptor.name}: Portance excessive ${liftMag.toFixed(1)}N → plafonnée à ${NASAAeroConfig.MAX_FORCE_PER_SURFACE}N`);

        // console.warn(`⚠️ [AeroSystemNASA] ${sample.descriptor.name}: Traînée excessive ${dragMag.toFixed(1)}N → plafonnée à ${NASAAeroConfig.MAX_FORCE_PER_SURFACE}N`);

        // 🔍 DEBUG DÉTAILLÉ - Afficher tous les calculs intermédiaires
        if (this.debugFaces && (this.debugSurfaceIndex === -1 || this.debugSurfaceIndex === index) && this.debugFrameCounter % 60 === 0) {
          this.logDetailedAeroCalculations(
            index, sample, alphaDeg, localWindSpeed, leverArm, 
            Clo, CL, Cdo, CD, q, liftDir, dragDir,
            panelLift, panelDrag, gravityPerFace
          );
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 9. APPLICATION DES FORCES AU CENTRE DE PRESSION (CP)
        // ═══════════════════════════════════════════════════════════════════════
        //
        // PHYSIQUE DES CORPS RIGIDES:
        // ──────────────────────────────
        // Une force F appliquée à un point P (CP) est équivalente à:
        //   1. Force au CoM: F_CoM = F
        //   2. Torque: τ = r × F, où r = vecteur (CoM → CP)
        //
        // ARCHITECTURE ECS:
        // ─────────────────
        // • Forces stockées dans physics.forces (accumulateur)
        // • PhysicsSystem les intègre en vélocité puis position
        // • Torques stockés dans physics.torques (accumulateur)
        // • PhysicsSystem les intègre en vélocité angulaire puis quaternion
        //
        // CE QUI EST FAIT ICI:
        // ────────────────────
        // ✅ leverArm = CP - CoM (calculé ligne 157)
        // ✅ Forces ajoutées à l'accumulateur (translation)
        // ✅ Torque généré et ajouté (rotation)
        // ✅ RÉSULTAT: Force appliquée AU CENTRE DE PRESSION ✅
        //
        const panelForce = panelLift.clone().add(panelDrag).add(gravityPerFace);

        // ═══════════════════════════════════════════════════════════════════════
        // LISSAGE TEMPOREL DES FORCES (Temporal Smoothing)
        // ═══════════════════════════════════════════════════════════════════════
        // Pour éviter les explosions numériques, on lisse les forces entre frames :
        // F_smooth = (1 - α) × F_previous + α × F_current
        // où α = forceSmoothing (configurable via UI, par défaut 0.3 = 30% nouveau, 70% ancien)
        //
        const surfaceKey = `${kite.id}_${sample.descriptor.name}`;
        const smoothedForce = this.smoothForce(surfaceKey, panelForce, forceSmoothing);

        // Décomposer en lift/drag/gravity pour application
        // ✅ PROTECTION NaN: Éviter division par zéro si panelForce est nul
        const panelForceLength = panelForce.length();
        const forceRatio = panelForceLength > 0.001 
          ? smoothedForce.length() / panelForceLength 
          : 1.0; // Si force originale nulle, ratio = 1 (pas de changement)
          
        const smoothedLift = panelLift.clone().multiplyScalar(forceRatio);
        const smoothedDrag = panelDrag.clone().multiplyScalar(forceRatio);
        const smoothedGravity = gravityPerFace.clone(); // Gravité ne change pas

        // Ajouter forces lissées (translation du CoM)
        this.addForce(physics, smoothedLift);
        this.addForce(physics, smoothedDrag);
        this.addForce(physics, smoothedGravity);

        // Générer torque: τ = (CP - CoM) × Force (utilise MathUtils centralisé)
        // C'est ce qui fait que la force appliquée au CP crée une rotation
        let panelTorque = MathUtils.computeTorque(sample.centerOfPressure, centerOfMass, smoothedForce);

        // Lisser le torque également
        panelTorque = this.smoothTorque(surfaceKey, panelTorque, forceSmoothing);

        // 🛡️ SAFETY CAP: Limiter le couple par surface
        const torqueMag = panelTorque.length();
        if (torqueMag > NASAAeroConfig.MAX_TORQUE_PER_SURFACE) {
          this.logger.warn(`${sample.descriptor.name}: Couple excessif ${torqueMag.toFixed(1)}N·m → plafonné à ${NASAAeroConfig.MAX_TORQUE_PER_SURFACE}N·m`, 'AeroSystem');
          panelTorque.normalize().multiplyScalar(NASAAeroConfig.MAX_TORQUE_PER_SURFACE);
        }

        if (!MathUtils.ensureFinite(panelTorque, `panelTorque for ${sample.descriptor.name}`)) {
          panelTorque.set(0, 0, 0);
        }

  this.addTorque(physics, panelTorque);

        // 10. Stockage pour visualisation debug
        // Note: 'centroid' stocke en réalité le centre de pression (CP), pas le centroïde géométrique
        // C'est le point d'application des forces aérodynamiques (portance + traînée)
        physics.faceForces.push({
          name: sample.descriptor.name,
          centroid: sample.centerOfPressure.clone(), // ⚠️ Nom hérité: contient CP, pas centroïde
          lift: panelLift.clone(),
          drag: panelDrag.clone(),
          gravity: gravityPerFace.clone(),
          apparentWind: localApparentWind.clone(),
          normal: surfaceNormal.clone() // ✅ Normale de surface (auto-corrigée si nécessaire)
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
      
      // === Calcul du centre de pression (CP) - Version simplifiée ===
      // Pour une plaque plane triangulaire, nous utilisons le CENTROÏDE comme point d'application.
      //
      // Raisons:
      // 1. Le CP réel varie avec l'angle d'attaque (25%-50% selon α)
      // 2. Pour un delta, le centroïde est une excellente approximation moyenne
      // 3. Simplifie le calcul sans perte significative de précision physique
      // 4. Évite les instabilités numériques du CP mobile
      //
      // Source: Pour plaques planes à angles modérés, CP ≈ centroïde géométrique
      const centerOfPressure = centroid.clone();
      
      samples.push({ descriptor, area, centroid, centerOfPressure, normal });
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
    return MathUtils.computeTriangleArea(a, b, c);
  }

  private computeTriangleCentroid(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return MathUtils.computeTriangleCentroid(a, b, c);
  }
  
  /**
   * Calcule la normale d'un triangle selon la règle de la main droite
   * IMPORTANT: L'ordre des vertices détermine l'orientation de la normale
   */
  private computeTriangleNormal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return MathUtils.computeTriangleNormal(a, b, c);
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
   * Méthode: Double produit vectoriel AVEC correction de signe
   * liftDir = (normale × vent) × vent
   * Si liftDir · normale < 0, inverser liftDir (doit pointer du même côté que normale)
   *
   * @param surfaceNormal - Normale de la surface (unitaire, après auto-correction)
   * @param windDir - Direction du vent apparent (unitaire)
   * @returns Direction de la portance (unitaire, perpendiculaire au vent, même côté que normale)
   */
  private computeLiftCoefficient(alphaRad: number, aspectRatio: number): { CL: number; Clo: number } {
    const absAlpha = Math.abs(alphaRad);
    const stall = NASAAeroConfig.STALL_ANGLE_RAD;
    const transition = NASAAeroConfig.STALL_TRANSITION_WIDTH_RAD;

    const Clo = 2.0 * NASAAeroConfig.PI * alphaRad;
    const clLinearDenom = 1.0 + Math.abs(Clo) / (NASAAeroConfig.PI * aspectRatio);
    const clLinear = clLinearDenom !== 0 ? Clo / clLinearDenom : 0;

    const clFlatPlate = NASAAeroConfig.CL_POST_STALL_COEFF * Math.sin(2 * alphaRad);
    const blend = this.smoothTransition(absAlpha, stall, stall + transition);
    const CL = (1 - blend) * clLinear + blend * clFlatPlate;

    return { CL, Clo };
  }

  private computeDragCoefficient(alphaRad: number, aspectRatio: number, CL: number): { CD: number; Cdo: number } {
    const absAlpha = Math.abs(alphaRad);
    const stall = NASAAeroConfig.STALL_ANGLE_RAD;
    const transition = NASAAeroConfig.STALL_TRANSITION_WIDTH_RAD;
    const sinAlpha = Math.sin(alphaRad);

    const Cdo = NASAAeroConfig.FLAT_PLATE_DRAG_COEFF * Math.abs(sinAlpha);
    const induced = (CL * CL) / (NASAAeroConfig.RECTANGULAR_WING_EFFICIENCY * NASAAeroConfig.PI * aspectRatio);
    const cdLaminar = NASAAeroConfig.CD_BASE + Cdo + induced;

    const cdPost = NASAAeroConfig.CD_STALL + NASAAeroConfig.CD_POST_STALL_FACTOR * sinAlpha * sinAlpha;
    const blend = this.smoothTransition(absAlpha, stall, stall + transition);
    const CD = (1 - blend) * cdLaminar + blend * cdPost;

    return { CD, Cdo };
  }

  private smoothTransition(value: number, start: number, end: number): number {
    if (end <= start) {
      return value >= end ? 1 : 0;
    }
    const normalized = (value - start) / (end - start);
    const clamped = Math.max(0, Math.min(1, normalized));
    return clamped * clamped * (3 - 2 * clamped);
  }

  private calculateNASALiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
    // ✅ CORRECTION CRITIQUE : Double produit vectoriel
    // liftDir = (normale × vent) × vent
    // Cela garantit que la portance est perpendiculaire au vent
    const crossProduct = new THREE.Vector3().crossVectors(surfaceNormal, windDir);
    let liftDir = new THREE.Vector3().crossVectors(crossProduct, windDir);

    // Protection contre les vecteurs nuls (si normale parallèle au vent)
    const ZERO_VECTOR_THRESHOLD = 0.0001;
    if (liftDir.lengthSq() < ZERO_VECTOR_THRESHOLD) {
      // Si la normale est parallèle au vent, pas de portance
      // Retourner direction arbitraire vers le haut (Cl sera ~0 de toute façon)
      return new THREE.Vector3(0, 1, 0);
    }

    liftDir.normalize();

    // ✅ CORRECTION DE SIGNE : La portance doit pointer du MÊME CÔTÉ que la normale
    // Si liftDir pointe du côté opposé (dot < 0), l'inverser
    const dotProduct = liftDir.dot(surfaceNormal);
    if (dotProduct < 0) {
      liftDir.negate();
    }

    return liftDir;
  }
  
  /**
   * Vérifie qu'un vecteur est valide (pas de NaN, pas d'Infinity)
   */
  private isValidVector(v: THREE.Vector3): boolean {
    return isFinite(v.x) && isFinite(v.y) && isFinite(v.z);
  }
  
  /**
   * Ajoute une force au PhysicsComponent avec protection NaN
   */
  private addForce(physics: PhysicsComponent, force: THREE.Vector3): void {
    if (isNaN(force.x) || isNaN(force.y) || isNaN(force.z)) {
      console.error('[AeroSystem] Attempted to add NaN force:', force);
      return;
    }
    physics.forces.add(force);
  }
  
  /**
   * Ajoute un couple au PhysicsComponent avec protection NaN
   */
  private addTorque(physics: PhysicsComponent, torque: THREE.Vector3): void {
    if (isNaN(torque.x) || isNaN(torque.y) || isNaN(torque.z)) {
      console.error('[AeroSystem] Attempted to add NaN torque:', torque);
      return;
    }
    physics.torques.add(torque);
  }

  /**
   * Log détaillé de tous les calculs aérodynamiques pour une surface
   * Utilisé pour déboguer les positions et orientations des vecteurs de force
   */
  private logDetailedAeroCalculations(
    index: number,
    sample: SurfaceSample,
    alphaDeg: number,
    windSpeed: number,
    leverArm: THREE.Vector3,
    Clo: number,
    CL: number,
    Cdo: number,
    CD: number,
    q: number,
    liftDir: THREE.Vector3,
    dragDir: THREE.Vector3,
    panelLift: THREE.Vector3,
    panelDrag: THREE.Vector3,
    gravityPerFace: THREE.Vector3
  ): void {
    console.group(`🎯 [AeroSystemNASA] Surface ${index}: ${sample.descriptor.name}`);

    // 1. Géométrie
    console.log(`📐 GÉOMÉTRIE:`);
    console.log(`   - Surface: ${sample.descriptor.name}`);
    console.log(`   - Centre de pression (CP): (${sample.centerOfPressure.x.toFixed(3)}, ${sample.centerOfPressure.y.toFixed(3)}, ${sample.centerOfPressure.z.toFixed(3)})`);
    console.log(`   - Centroïde géométrique: (${sample.centroid.x.toFixed(3)}, ${sample.centroid.y.toFixed(3)}, ${sample.centroid.z.toFixed(3)})`);
    console.log(`   - Bras de levier (CP - CoM): (${leverArm.x.toFixed(3)}, ${leverArm.y.toFixed(3)}, ${leverArm.z.toFixed(3)}) [mag=${leverArm.length().toFixed(3)} m]`);
    console.log(`   - Aire: ${sample.area.toFixed(4)} m²`);

    // 2. Vent et angle d'attaque
    console.log(`💨 VENT:`);
    console.log(`   - Vitesse apparente: ${windSpeed.toFixed(2)} m/s`);
    console.log(`   - Direction vent: (${dragDir.x.toFixed(3)}, ${dragDir.y.toFixed(3)}, ${dragDir.z.toFixed(3)})`);
    console.log(`   - Normale surface: (${sample.normal.x.toFixed(3)}, ${sample.normal.y.toFixed(3)}, ${sample.normal.z.toFixed(3)})`);
    console.log(`   - Angle d'attaque (α): ${alphaDeg.toFixed(1)}°`);

    // 3. Coefficients aérodynamiques
    console.log(`📊 COEFFICIENTS AÉRO:`);
    console.log(`   - CL théorique: ${Clo.toFixed(4)} → CL corrigé: ${CL.toFixed(4)}`);
    console.log(`   - CD parasite: ${Cdo.toFixed(4)}`);
    console.log(`   - CD induit: ${(CD - Cdo).toFixed(4)}`);
    console.log(`   - CD total: ${CD.toFixed(4)}`);
    console.log(`   - Pression dynamique (q): ${q.toFixed(2)} Pa`);

    // 4. Directions des forces
    console.log(`🎲 DIRECTIONS:`);
    console.log(`   - Direction portance: (${liftDir.x.toFixed(3)}, ${liftDir.y.toFixed(3)}, ${liftDir.z.toFixed(3)}) [perpendiculaire au vent]`);
    console.log(`   - Direction traînée: (${dragDir.x.toFixed(3)}, ${dragDir.y.toFixed(3)}, ${dragDir.z.toFixed(3)}) [parallèle au vent]`);

    // 5. Forces finales
    console.log(`💪 FORCES FINALES:`);
    console.log(`   - Portance: (${panelLift.x.toFixed(3)}, ${panelLift.y.toFixed(3)}, ${panelLift.z.toFixed(3)}) [mag=${panelLift.length().toFixed(3)} N]`);
    console.log(`   - Traînée: (${panelDrag.x.toFixed(3)}, ${panelDrag.y.toFixed(3)}, ${panelDrag.z.toFixed(3)}) [mag=${panelDrag.length().toFixed(3)} N]`);
    console.log(`   - Gravité: (${gravityPerFace.x.toFixed(3)}, ${gravityPerFace.y.toFixed(3)}, ${gravityPerFace.z.toFixed(3)}) [mag=${gravityPerFace.length().toFixed(3)} N]`);

    const totalForce = panelLift.clone().add(panelDrag).add(gravityPerFace);
    console.log(`   - ∑ Force totale: (${totalForce.x.toFixed(3)}, ${totalForce.y.toFixed(3)}, ${totalForce.z.toFixed(3)}) [mag=${totalForce.length().toFixed(3)} N]`);

    console.groupEnd();
  }

  /**
   * Active/désactive le debug des faces avec possibilité de cibler une surface
   * @param enabled Activer le debug
   * @param surfaceIndex Index de la surface à déboguer (-1 pour toutes)
   */
  public setDebugFaces(enabled: boolean, surfaceIndex: number = -1): void {
    this.debugFaces = enabled;
    this.debugSurfaceIndex = surfaceIndex;
    if (enabled) {
      console.log(`🔍 [AeroSystemNASA] Debug activé${surfaceIndex >= 0 ? ` pour surface ${surfaceIndex}` : ` pour TOUTES les surfaces`}`);
    }
  }

  /**
   * Lisse une force entre le frame précédent et le frame actuel en utilisant MathUtils.exponentialSmoothing.
   * @param key Identifiant unique de la surface.
   * @param currentForce Force calculée ce frame.
   * @param smoothingFactor Facteur de lissage (0-1).
   * @returns Force lissée.
   */
  private smoothForce(key: string, currentForce: THREE.Vector3, smoothingFactor: number): THREE.Vector3 {
    const previousForce = this.previousForces.get(key);
    return MathUtils.exponentialSmoothing(currentForce, previousForce || null, smoothingFactor);
  }

  /**
   * Lisse un torque entre le frame précédent et le frame actuel en utilisant MathUtils.exponentialSmoothing.
   * @param key Identifiant unique de la surface.
   * @param currentTorque Torque calculé ce frame.
   * @param smoothingFactor Facteur de lissage (0-1).
   * @returns Torque lissé.
   */
  private smoothTorque(key: string, currentTorque: THREE.Vector3, smoothingFactor: number): THREE.Vector3 {
    const previousTorque = this.previousTorques.get(key);
    return MathUtils.exponentialSmoothing(currentTorque, previousTorque || null, smoothingFactor);
  }
}

