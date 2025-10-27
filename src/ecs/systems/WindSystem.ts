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
    this.updateAmbientWind();
  }
  
  /**
   * Met à jour le vecteur de vent ambiant selon la vitesse et direction courantes
   * Le vent est dans le plan horizontal XZ (Y = 0)
   */
  private updateAmbientWind(): void {
    // 🛡️ Protection NaN: Vérifier que les paramètres sont valides
    if (!isFinite(this.windSpeed) || !isFinite(this.windDirection)) {
      console.error('[WindSystem] Invalid wind parameters detected:', {
        windSpeed: this.windSpeed,
        windDirection: this.windDirection
      });
      // Valeurs par défaut sécurisées
      this.windSpeed = WindConfig.DEFAULT_WIND_SPEED_MS;
      this.windDirection = WindConfig.DEFAULT_WIND_DIRECTION;
    }

    const DEG_TO_RAD = Math.PI / 180;
    const dirRad = this.windDirection * DEG_TO_RAD;
    
    // Plan horizontal XZ : X = cos(angle), Y = 0 (horizontal), Z = sin(angle)
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
        
        const speedChanged = Math.abs(newSpeed - this.windSpeed) > WindConfig.SPEED_CHANGE_THRESHOLD;
        const directionChanged = Math.abs(newDirection - this.windDirection) > WindConfig.DIRECTION_CHANGE_THRESHOLD;
        const turbulenceChanged = Math.abs(newTurbulence - this.turbulence) > WindConfig.TURBULENCE_CHANGE_THRESHOLD;
        
        if (speedChanged || directionChanged || turbulenceChanged) {
          this.windSpeed = newSpeed;
          this.windDirection = newDirection;
          this.turbulence = newTurbulence;
          this.updateAmbientWind();
        }
        this.lastWindUpdate = currentTime;
      }
    }
    
    // Pour chaque kite
    const kites = entityManager.query(['kite', 'transform', 'physics']);
    
    kites.forEach(kite => {
      const physics = kite.getComponent<PhysicsComponent>('physics')!;
      
      // Protection contre les NaN dans velocity
      if (isNaN(physics.velocity.x) || isNaN(physics.velocity.y) || isNaN(physics.velocity.z)) {
        console.error('[WindSystem] NaN detected in velocity for kite:', kite.id);
        physics.velocity.set(0, 0, 0); // Reset à zéro
      }
      
      // Vent apparent = vent ambiant - vitesse kite
      // (Le vent "vu" par le kite dépend de sa propre vitesse)
      const apparentWindBase = this.ambientWind.clone().sub(physics.velocity);
      
      // Ajouter de la turbulence si configurée
      if (this.turbulence > 0) {
        const TURBULENCE_SCALE = this.turbulence / 100;
        const turbulenceVector = new THREE.Vector3(
          (Math.random() - 0.5) * this.windSpeed * TURBULENCE_SCALE,
          (Math.random() - 0.5) * this.windSpeed * TURBULENCE_SCALE * WindConfig.VERTICAL_TURBULENCE_FACTOR, // Moins de turbulence verticale
          (Math.random() - 0.5) * this.windSpeed * TURBULENCE_SCALE
        );
        apparentWindBase.add(turbulenceVector);
      }
      
      const apparentWind = apparentWindBase;
      const speed = apparentWind.length();
      const direction = speed > WindConfig.MINIMUM_WIND_SPEED ? apparentWind.clone().normalize() : new THREE.Vector3(1, 0, 0);
      
      // Stocker dans un cache temporaire du contexte
      // (AeroSystem le lira ensuite)
      if (!context.windCache) {
        context.windCache = new Map();
      }
      
      context.windCache.set(kite.id, {
        ambient: this.ambientWind.clone(),
        apparent: apparentWind,
        speed,
        direction
      } as WindState);
    });
  }
  
  /**
   * Change le vent ambiant manuellement
   * @param speedMs - Vitesse du vent en m/s
   * @param directionDeg - Direction en degrés (0 = +X, 90 = +Z)
   */
  setWind(speedMs: number, directionDeg: number): void {
    this.windSpeed = speedMs;
    this.windDirection = directionDeg;
    this.updateAmbientWind();
    
    console.log('💨 [WindSystem] Wind manually set to:', {
      speed: speedMs.toFixed(1) + ' m/s',
      direction: directionDeg.toFixed(0) + '°',
      vector: this.ambientWind
    });
  }
  
  /**
   * Récupère les paramètres actuels du vent
   */
  getWindParameters(): { speed: number; direction: number; turbulence: number } {
    return {
      speed: this.windSpeed,
      direction: this.windDirection,
      turbulence: this.turbulence
    };
  }
}
