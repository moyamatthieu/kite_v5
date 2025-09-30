/**
 * WindSimulator.ts - Simulateur de vent et turbulences pour la simulation Kite
 *
 * Rôle :
 *   - Génère le vent et ses variations (direction, vitesse, turbulence)
 *   - Fournit le vent apparent ressenti par le cerf-volant
 *   - Sert de source d'environnement pour la physique et le rendu
 *
 * Dépendances principales :
 *   - SimulationConfig.ts : Paramètres de vent et turbulence
 *   - Types/WindTypes.ts : Typage des paramètres de vent
 *
 * Relation avec les fichiers adjacents :
 *   - PhysicsEngine.ts : Utilise WindSimulator pour obtenir le vent à chaque frame
 *   - Les autres modules du dossier 'physics' utilisent le vent pour calculer les forces
 *
 * Utilisation typique :
 *   - Instancié par PhysicsEngine, appelé pour obtenir le vent local ou global
 *
 * Voir aussi :
 *   - src/simulation/physics/PhysicsEngine.ts
 *   - src/simulation/config/SimulationConfig.ts
 */
import * as THREE from "three";
import { WindParams } from "../types";
import { CONFIG } from "../config/SimulationConfig";

/**
 * Simulateur de vent et turbulences
 *
 * Gère le vent et ses variations pour créer des conditions réalistes
 */
export class WindSimulator {
  private params: WindParams;
  private time: number = 0; // Compteur de temps pour faire varier les turbulences
  private windSpeedMs: number = 0;
  private windRad: number = 0;

  constructor() {
    // On démarre avec les réglages par défaut du vent
    this.params = {
      speed: CONFIG.wind.defaultSpeed,
      direction: CONFIG.wind.defaultDirection,
      turbulence: CONFIG.wind.defaultTurbulence,
    };
    this.updateWindInternals();
  }

  private updateWindInternals(): void {
    this.windSpeedMs = this.params.speed / 3.6;
    this.windRad = (this.params.direction * Math.PI) / 180;
  }

  /**
   * Calcule le vent que "ressent" le cerf-volant
   * C'est comme quand vous mettez la main par la fenêtre d'une voiture :
   * - Si la voiture roule vite, vous sentez plus de vent
   * - Si vous allez contre le vent, il est plus fort
   * - Si vous allez avec le vent, il est plus faible
   */
  getApparentWind(
    kiteVelocity: THREE.Vector3,
    deltaTime: number
  ): THREE.Vector3 {
    this.time += deltaTime;

    const windVector = new THREE.Vector3(
      Math.sin(this.windRad) * this.windSpeedMs,
      0,
      -Math.cos(this.windRad) * this.windSpeedMs
    );

    // Ajouter des rafales aléatoires mais réalistes
    // Les turbulences font bouger le vent de façon imprévisible
    // Comme les tourbillons qu'on sent parfois dehors
    if (this.params.turbulence > 0) {
      const turbIntensity =
        (this.params.turbulence / 100) * CONFIG.wind.turbulenceScale;
      const freq = CONFIG.wind.turbulenceFreqBase; // Fréquence des changements

      // On utilise des sinus pour créer des variations douces et naturelles
      windVector.x +=
        Math.sin(this.time * freq) *
        this.windSpeedMs *
        turbIntensity *
        CONFIG.wind.turbulenceIntensityXZ;
      windVector.y +=
        Math.sin(this.time * freq * CONFIG.wind.turbulenceFreqY) *
        this.windSpeedMs *
        turbIntensity *
        CONFIG.wind.turbulenceIntensityY;
      windVector.z +=
        Math.cos(this.time * freq * CONFIG.wind.turbulenceFreqZ) *
        this.windSpeedMs *
        turbIntensity *
        CONFIG.wind.turbulenceIntensityXZ;
    }

    // Le vent apparent = vent réel - vitesse du kite
    // Si le kite va vite vers l'avant, il "crée" du vent de face
    const apparent = windVector.clone().sub(kiteVelocity);

    return apparent;
  }

  /**
   * Obtient le vecteur de vent à une position donnée
   */
  getWindAt(_position: THREE.Vector3): THREE.Vector3 {
    const windVector = new THREE.Vector3(
      Math.sin(this.windRad) * this.windSpeedMs,
      0,
      -Math.cos(this.windRad) * this.windSpeedMs
    );

    if (this.params.turbulence > 0) {
      const turbIntensity =
        (this.params.turbulence / 100) * CONFIG.wind.turbulenceScale;
      const freq = 0.5;

      windVector.x +=
        Math.sin(this.time * freq) * this.windSpeedMs * turbIntensity;
      windVector.y +=
        Math.sin(this.time * freq * 1.3) *
        this.windSpeedMs *
        turbIntensity *
        0.3;
      windVector.z +=
        Math.cos(this.time * freq * 0.7) * this.windSpeedMs * turbIntensity;
    }

    return windVector;
  }

  setParams(params: Partial<WindParams>): void {
    Object.assign(this.params, params);
    this.updateWindInternals();
  }

  getParams(): WindParams {
    return { ...this.params };
  }
}