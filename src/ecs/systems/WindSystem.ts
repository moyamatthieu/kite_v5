/**
 * WindSystem.ts - Calcul du vent apparent
 * 
 * === DESCRIPTION ===
 * Ce système calcule le vent apparent ressenti par le cerf-volant en fonction :
 * - Du vent ambiant (vitesse et direction configurables)
 * - De la vitesse du cerf-volant (vent relatif)
 * - De la turbulence (variations aléatoires)
 * 
 * === FORMULE DU VENT APPARENT ===
 * Vent_apparent = Vent_ambiant - Vitesse_kite + Turbulence
 * 
 * Cette formule est fondamentale en aérodynamique : un objet en mouvement "ressent"
 * un vent d'autant plus fort qu'il se déplace dans la direction du vent.
 * 
 * === SYSTÈME DE COORDONNÉES ===
 * Le vent est défini dans le plan horizontal XZ (Y = vertical dans Three.js) :
 * - Direction 0° = axe +X (Est)
 * - Direction 90° = axe +Z (Sud)
 * - Direction 180° = axe -X (Ouest)
 * - Direction 270° = axe -Z (Nord)
 * 
 * === INTÉGRATION ECS ===
 * Priorité : 20 (exécuté avant AeroSystem qui a la priorité 30)
 * 
 * INPUT :
 * - InputComponent : windSpeed, windDirection, windTurbulence (depuis l'UI)
 * - PhysicsComponent : velocity (vitesse du cerf-volant)
 * 
 * OUTPUT :
 * - context.windCache : Map<entityId, WindState> contenant le vent apparent pour chaque kite
 * 
 * === SYNCHRONISATION AVEC L'UI ===
 * Le système lit automatiquement les paramètres de InputComponent toutes les 100ms
 * et met à jour le vent ambiant en conséquence. Cela permet un contrôle en temps réel
 * depuis l'interface utilisateur.
 * 
 * === TURBULENCE ===
 * La turbulence ajoute des variations aléatoires au vent apparent :
 * - Turbulence 0% = vent stable
 * - Turbulence 100% = variations jusqu'à ±100% de la vitesse du vent
 * - La turbulence verticale est réduite (x0.3) pour plus de réalisme
 * 
 * @see AeroSystem - Utilise les données de ce système pour calculer les forces aéro
 * @see InputComponent - Source des paramètres de vent
 * @see WindState - Interface décrivant l'état du vent stocké dans le cache
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { InputComponent } from '../components/InputComponent';
import { TransformComponent } from '../components/TransformComponent';
import { WindConfig } from '../config/Config';

/**
 * État du vent stocké dans le contexte
 */
export interface WindState {
  ambient: THREE.Vector3;        // Vent ambiant
  apparent: THREE.Vector3;       // Vent apparent (ambiant - velocityKite)
  speed: number;                 // Vitesse du vent apparent (m/s)
  direction: THREE.Vector3;      // Direction normalisée
}

export class WindSystem extends System {
  private ambientWind!: THREE.Vector3; // Initialisé dans updateAmbientWind()
  private windSpeed: number; // m/s
  private windDirection: number; // degrés (0 = +X, 90 = +Z)
  private turbulence: number; // %
  private lastWindUpdate = 0; // Timestamp de la dernière mise à jour depuis InputComponent

  // State for temporally correlated turbulence
  private currentTurbulenceX: number = 0;
  private currentTurbulenceY: number = 0;
  private currentTurbulenceZ: number = 0;
  
  constructor(options: {
    windSpeed?: number;      // m/s
    windDirection?: number;  // degrés
    turbulence?: number;     // %
  } = {}) {
    super('WindSystem', WindConfig.PRIORITY);
    
    // Paramètres initiaux
    this.windSpeed = options.windSpeed ?? WindConfig.DEFAULT_WIND_SPEED_MS;
    this.windDirection = options.windDirection ?? WindConfig.DEFAULT_WIND_DIRECTION;
    this.turbulence = options.turbulence ?? WindConfig.DEFAULT_TURBULENCE;
    
    // Calculer vecteur vent ambiant dans le plan horizontal XZ
    const DEG_TO_RAD = Math.PI / 180;
    const dirRad = this.windDirection * DEG_TO_RAD;
    
    // Plan horizontal XZ : X = cos(angle), Y = 0 (horizontal), Z = sin(angle)
    // Correction: z = sin(dirRad) * speed pour cohérence directions
    const x = Math.cos(dirRad) * this.windSpeed;
    const z = Math.sin(dirRad) * this.windSpeed;
    
    // 🛡️ Vérification finale que les valeurs calculées sont valides
    if (!isFinite(x) || !isFinite(z)) {
      console.error('[WindSystem] NaN detected in calculated wind vector:', { x, z, dirRad });
      this.ambientWind = new THREE.Vector3(0, 0, 0);
      return;
    }
    
    this.ambientWind = new THREE.Vector3(x, 0, z);
  }
  
  update(context: SimulationContext): void {
    const currentTime = performance.now();
    const { entityManager } = context;
    
    // Synchroniser avec InputComponent si disponible
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0 && currentTime - this.lastWindUpdate > WindConfig.UPDATE_INTERVAL) {
      const inputComp = inputEntities[0].getComponent<InputComponent>('Input');
      if (inputComp) {
        // 🛡️ Vérifier que les valeurs de InputComponent sont valides
        const newSpeed = isFinite(inputComp.windSpeed) ? inputComp.windSpeed : this.windSpeed;
        const newDirection = isFinite(inputComp.windDirection) ? inputComp.windDirection : this.windDirection;
        const newTurbulence = isFinite(inputComp.windTurbulence) ? inputComp.windTurbulence : this.turbulence;
        
        // Vérifier si les paramètres de vent ont changé depuis la dernière mise à jour
        const windSpeedChanged = Math.abs(newSpeed - this.windSpeed) > WindConfig.SPEED_CHANGE_THRESHOLD;
        const windDirectionChanged = Math.abs(newDirection - this.windDirection) > WindConfig.DIRECTION_CHANGE_THRESHOLD;
        const turbulenceChanged = Math.abs(newTurbulence - this.turbulence) > WindConfig.TURBULENCE_CHANGE_THRESHOLD;

        if (windSpeedChanged || windDirectionChanged || turbulenceChanged) {
          this.windSpeed = newSpeed;
          this.windDirection = newDirection;
          this.turbulence = newTurbulence;
          this.updateAmbientWindVector();
          this.lastWindUpdate = performance.now();
        }
      }
    }
    
    // Calculer le vent apparent
    // Vent_apparent = Vent_ambiant - Vitesse_kite + Turbulence
    const kites = entityManager.query(['transform', 'physics']);
    const windCache = new Map<string, WindState>();

    kites.forEach(kite => {
      const transform = kite.getComponent<TransformComponent>('transform')!;
      const physics = kite.getComponent<PhysicsComponent>('physics')!;

      // Ignorer les objets cinématiques (fixes)
      if (physics.isKinematic) {
        return;
      }

      // Vent apparent = vent ambiant - vitesse du point
      const pointVelocity = physics.velocity.clone(); // Simplification: utiliser la vitesse du CoM
      const localApparentWind = this.ambientWind.clone().sub(pointVelocity);
      const localWindSpeed = localApparentWind.length();
      const localWindDir = localWindSpeed > WindConfig.MINIMUM_WIND_SPEED
        ? localApparentWind.clone().normalize()
        : new THREE.Vector3(0, 0, 0);

      // Ajouter la turbulence
      const turbulenceEffect = this.calculateTurbulence(localWindSpeed, this.turbulence);
      localApparentWind.add(turbulenceEffect);

      const finalSpeed = localApparentWind.length();
      const finalDirection = finalSpeed > WindConfig.MINIMUM_WIND_SPEED
        ? localApparentWind.clone().normalize()
        : localWindDir;

      windCache.set(kite.id, {
        ambient: this.ambientWind.clone(),
        apparent: localApparentWind,
        speed: finalSpeed,
        direction: finalDirection
      });
    });

    context.windCache = windCache;
  }

  /**
   * Met à jour le vecteur de vent ambiant selon la vitesse et direction courantes
   * Le vent est dans le plan horizontal XZ (Y = 0)
   */
  private updateAmbientWindVector(): void {
    // 🛡️ Protection NaN: Vérifier que les paramètres sont valides
    if (!isFinite(this.windSpeed) || !isFinite(this.windDirection)) {
      console.error('[WindSystem] Invalid wind parameters detected:', {
        windSpeed: this.windSpeed,
        windDirection: this.windDirection
      });
      // Valeurs par défaut sécurisées
      this.ambientWind = new THREE.Vector3(0, 0, 0);
      return;
    }

    // Convertir la direction en radians
    const angleRad = THREE.MathUtils.degToRad(this.windDirection);

    // Calculer le vecteur vent ambiant dans le plan horizontal XZ
    // Correction: z = sin(angleRad) * speed (sans le -) pour cohérence
    // Direction 0° = +X (Est), 90° = +Z (Sud), 180° = -X (Ouest), 270° = -Z (Nord)
    // Vent direction = provenance, vector = -direction pour poussée
    this.ambientWind = new THREE.Vector3(
      Math.cos(angleRad) * this.windSpeed,
      0, // Pas de vent vertical
      Math.sin(angleRad) * this.windSpeed // Corrigé: sans inversé pour Z+ = Sud
    );
  }

  /**
   * Calcule l'effet de turbulence sur le vent.
   * @param baseWindSpeed La vitesse de base du vent.
   * @param turbulenceLevel Le niveau de turbulence (0-100%).
   * @returns Un vecteur de perturbation aléatoire.
   */
  private calculateTurbulence(baseWindSpeed: number, turbulenceLevel: number): THREE.Vector3 {
    if (turbulenceLevel === 0) {
      // Reset turbulence state if level is 0
      this.currentTurbulenceX = 0;
      this.currentTurbulenceY = 0;
      this.currentTurbulenceZ = 0;
      return new THREE.Vector3();
    }

    // Générer une perturbation aléatoire avec corrélation temporelle (random walk)
    const maxTurbulence = baseWindSpeed * (turbulenceLevel / 100);
    // Approximate time step based on update interval
    const timeStep = 1.0 / WindConfig.UPDATE_INTERVAL;
    // Limit the change per step to avoid extreme jumps, scale factor for turbulence update
    const turbulenceFactor = Math.min(1.0, timeStep * 5);

    // X component
    const randomX = (Math.random() - 0.5) * 2;
    this.currentTurbulenceX += randomX * maxTurbulence * turbulenceFactor;
    this.currentTurbulenceX = Math.max(Math.min(this.currentTurbulenceX, maxTurbulence), -maxTurbulence);

    // Y component (vertical turbulence reduced)
    const randomY = (Math.random() - 0.5) * 2;
    this.currentTurbulenceY += randomY * maxTurbulence * WindConfig.VERTICAL_TURBULENCE_FACTOR * turbulenceFactor;
    this.currentTurbulenceY = Math.max(Math.min(this.currentTurbulenceY, maxTurbulence * WindConfig.VERTICAL_TURBULENCE_FACTOR), -maxTurbulence * WindConfig.VERTICAL_TURBULENCE_FACTOR);

    // Z component
    const randomZ = (Math.random() - 0.5) * 2;
    this.currentTurbulenceZ += randomZ * maxTurbulence * turbulenceFactor;
    this.currentTurbulenceZ = Math.max(Math.min(this.currentTurbulenceZ, maxTurbulence), -maxTurbulence);

    return new THREE.Vector3(this.currentTurbulenceX, this.currentTurbulenceY, this.currentTurbulenceZ);
  }
}
