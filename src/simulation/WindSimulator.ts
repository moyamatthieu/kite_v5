/**
 * WindSimulator.ts - Simulation du vent et des turbulences
 *
 * Responsabilité : Gérer la simulation réaliste du vent avec turbulences
 */

import * as THREE from "three";
import type { WindParams } from "../types/wind";
import { CONFIG } from "../config/GlobalConfig";

export class WindSimulator {
  private params: WindParams;
  private time: number = 0; // Compteur de temps pour faire varier les turbulences
  private windSpeedMs: number; // windRad supprimé (direction ignorée)

  constructor() {
    this.params = {
      speed: CONFIG.wind.defaultSpeed,
      direction: 0, // Ignoré
      turbulence: CONFIG.wind.defaultTurbulence,
    };
    this.windSpeedMs = this.params.speed / 3.6;
    this.time = 0;
  }

  private updateWindInternals(): void {
    this.windSpeedMs = this.params.speed / 3.6;
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

    // Vent base uniforme en -Z (vers le pilote)
    const baseWind = new THREE.Vector3(0, 0, -this.windSpeedMs);

    // Turbulence légère temporelle uniforme (même partout)
    const turbIntensity = (this.params.turbulence / 100) * 0.1; // Légère
    const freq = 0.2; // Fréquence lente
    const turbulence = new THREE.Vector3(
      Math.sin(this.time * freq) * this.windSpeedMs * turbIntensity * 0.8, // Principalement XZ
      Math.sin(this.time * freq * 1.3) * this.windSpeedMs * turbIntensity * 0.2, // Vert faible
      Math.cos(this.time * freq * 0.7) * this.windSpeedMs * turbIntensity * 0.8
    );

    // Vent réel uniforme = base + turbulence temporelle
    const realWind = baseWind.clone().add(turbulence);

    // Vent apparent = vent réel - vitesse kite (relativité)
    const apparentWind = realWind.sub(kiteVelocity.clone().multiplyScalar(0.8)); // Kite sent ~80% de sa vitesse

    // Pas de variation d'altitude pour uniformité
    return apparentWind;
  }

  /**
   * Obtient le vecteur de vent à une position donnée
   */
  getWindAt(position: THREE.Vector3): THREE.Vector3 {
    // Ignorer position pour uniformité
    this.time += 0.016; // Delta fixe pour cohérence

    // Même calcul que getApparentWind sans soustraction vitesse
    const baseWind = new THREE.Vector3(0, 0, -this.windSpeedMs);

    const turbIntensity = (this.params.turbulence / 100) * 0.1;
    const freq = 0.2;
    const turbulence = new THREE.Vector3(
      Math.sin(this.time * freq) * this.windSpeedMs * turbIntensity * 0.8,
      Math.sin(this.time * freq * 1.3) * this.windSpeedMs * turbIntensity * 0.2,
      Math.cos(this.time * freq * 0.7) * this.windSpeedMs * turbIntensity * 0.8
    );

    return baseWind.clone().add(turbulence);
  }

  setParams(params: Partial<WindParams>): void {
    Object.assign(this.params, params);
    this.updateWindInternals();
    if ("direction" in params) {
      console.warn("Direction du vent ignorée : vent uniforme en -Z");
    }
  }

  getParams(): WindParams {
    return { ...this.params };
  }
}
