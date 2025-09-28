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
  private windSpeedMs: number;
  private windDirection: THREE.Vector3; // Direction du vent (vecteur unitaire)

  // ✅ Cache pour éviter allocations dans boucle
  private _baseWindCache = new THREE.Vector3();
  private _turbulenceCache = new THREE.Vector3();
  private _realWindCache = new THREE.Vector3();
  private _kiteVelCache = new THREE.Vector3();

  constructor() {
    this.params = {
      speed: CONFIG.wind.defaultSpeed,
      direction: 0, // Direction en degrés (0 = Nord, 90 = Est)
      turbulence: CONFIG.wind.defaultTurbulence,
    };
    this.windSpeedMs = this.params.speed / 3.6;
    this.windDirection = new THREE.Vector3();
    this.updateWindInternals();
    this.time = 0;
  }

  private updateWindInternals(): void {
    this.windSpeedMs = this.params.speed / 3.6;
    // Convertir l'angle en radians et créer le vecteur de direction
    const angleRad = (this.params.direction * Math.PI) / 180;
    // Convention: 0° = Nord (-Z), 90° = Est (+X)
    this.windDirection.set(
      Math.sin(angleRad), // X composant
      0,                   // Y composant (pas de vent vertical de base)
      -Math.cos(angleRad)  // Z composant
    ).normalize();
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

    // Vent de base dans la direction configurée (ZÉRO allocation)
    this._baseWindCache.copy(this.windDirection).multiplyScalar(this.windSpeedMs);

    // Turbulence légère temporelle uniforme (réutilise cache)
    const turbIntensity = (this.params.turbulence / 100) * 0.1; // Légère
    const freq = 0.2; // Fréquence lente
    this._turbulenceCache.set(
      Math.sin(this.time * freq) * this.windSpeedMs * turbIntensity * 0.8, // Principalement XZ
      Math.sin(this.time * freq * 1.3) * this.windSpeedMs * turbIntensity * 0.2, // Vert faible
      Math.cos(this.time * freq * 0.7) * this.windSpeedMs * turbIntensity * 0.8
    );

    // Vent réel uniforme = base + turbulence temporelle
    this._realWindCache.copy(this._baseWindCache).add(this._turbulenceCache);

    // Vent apparent = vent réel - vitesse kite (relativité)
    this._kiteVelCache.copy(kiteVelocity).multiplyScalar(0.8);
    this._realWindCache.sub(this._kiteVelCache);

    // Pas de variation d'altitude pour uniformité
    return this._realWindCache;
  }

  /**
   * Obtient le vecteur de vent à une position donnée
   */
  getWindAt(position: THREE.Vector3): THREE.Vector3 {
    // Ignorer position pour uniformité
    this.time += 0.016; // Delta fixe pour cohérence

    // Même calcul que getApparentWind sans soustraction vitesse (ZÉRO allocation)
    this._baseWindCache.copy(this.windDirection).multiplyScalar(this.windSpeedMs);

    const turbIntensity = (this.params.turbulence / 100) * 0.1;
    const freq = 0.2;
    this._turbulenceCache.set(
      Math.sin(this.time * freq) * this.windSpeedMs * turbIntensity * 0.8,
      Math.sin(this.time * freq * 1.3) * this.windSpeedMs * turbIntensity * 0.2,
      Math.cos(this.time * freq * 0.7) * this.windSpeedMs * turbIntensity * 0.8
    );

    return this._baseWindCache.add(this._turbulenceCache);
  }

  setParams(params: Partial<WindParams>): void {
    Object.assign(this.params, params);
    this.updateWindInternals();
  }

  getParams(): WindParams {
    return { ...this.params };
  }
}
