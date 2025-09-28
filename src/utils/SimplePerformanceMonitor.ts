/**
 * 🛡️ SimplePerformanceMonitor.ts - Version ultra-simple sans récursion
 *
 * Version de secours pour remplacer temporairement PerformanceMonitor
 * qui causait des récursions infinies
 */

import * as THREE from "three";
import { logger } from "./Logger";

/**
 * 🎯 Moniteur de performance ultra-simplifié (pas de récursion)
 */
export class SimplePerformanceMonitor {
  private static instance: SimplePerformanceMonitor;
  private lastStatsTime = 0;
  private baselineTriangles = 0;
  private baselineObjects = 0;

  private constructor() {}

  static getInstance(): SimplePerformanceMonitor {
    if (!SimplePerformanceMonitor.instance) {
      SimplePerformanceMonitor.instance = new SimplePerformanceMonitor();
    }
    return SimplePerformanceMonitor.instance;
  }

  /**
   * 📊 Surveillance ultra-simplifiée (15 secondes de throttling)
   */
  checkPerformance(scene: THREE.Scene): void {
    const now = performance.now();

    // Throttling très agressif (15 secondes)
    if (now - this.lastStatsTime < 15000) {
      return;
    }

    this.lastStatsTime = now;

    // Compter objets et triangles de façon simple
    let objects = 0;
    let triangles = 0;

    scene.traverse((child) => {
      objects++;
      if (child instanceof THREE.Mesh && child.geometry) {
        const geometry = child.geometry;
        if (geometry.index) {
          triangles += geometry.index.count / 3;
        } else {
          const positions = geometry.attributes.position;
          if (positions) {
            triangles += positions.count / 3;
          }
        }
      }
    });

    // Établir baseline au premier appel
    if (this.baselineTriangles === 0) {
      this.baselineTriangles = triangles;
      this.baselineObjects = objects;
      logger.info(
        `🎯 Baseline établie: ${triangles} triangles, ${objects} objets`
      );
      return;
    }

    // Calcul de croissance
    const triangleGrowth = triangles - this.baselineTriangles;
    const objectGrowth = objects - this.baselineObjects;

    // Log simplifié
    logger.info(
      `📈 Stats simples: ${objects} objets, ${triangles} triangles (${
        triangleGrowth > 0 ? "+" : ""
      }${triangleGrowth})`
    );

    // Alertes seulement si croissance importante
    if (triangleGrowth > 2000) {
      logger.error(
        `🚨 Explosion triangles: +${triangleGrowth} depuis baseline!`
      );
    }
  }
}

// 🌟 Instance globale
export const simplePerformanceMonitor = SimplePerformanceMonitor.getInstance();
