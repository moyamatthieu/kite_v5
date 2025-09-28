/**
 * 📊 PerformanceMonitor.ts - Monitoring des performances et mémoire
 *
 * 🎯 Objectifs :
 * - Surveiller l'utilisation mémoire des géométries
 * - Détecter les fuites mémoire (objets qui ne sont pas libérés)
 * - Fournir des stats sur les triangles et objets
 * - Alertes automatiques en cas de problème
 */

import * as THREE from "three";
import { logger } from "./Logger";

export interface MemoryStats {
  geometries: number;
  textures: number;
  materials: number;
  triangles: number;
  vertices: number;
  memoryUsageMB: number;
}

export interface SceneStats {
  objects: number;
  meshes: number;
  lines: number;
  groups: number;
  triangles: number;
}

/**
 * 🔍 Moniteur de performance ultra-optimisé
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private lastMemoryCheck = 0;
  private memoryCheckInterval = 5000; // 5 secondes
  private initialMemoryBaseline: MemoryStats | null = null;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 📈 Analyse de l'utilisation mémoire Three.js
   */
  getMemoryStats(): MemoryStats {
    const info = (THREE as any).WebGLRenderer?.info || {};
    const memory = info.memory || {};
    const render = info.render || {};

    const baseStats = {
      geometries: memory.geometries || 0,
      textures: memory.textures || 0,
      materials: render.materials || 0,
      triangles: render.triangles || 0,
      vertices: render.vertices || 0,
      memoryUsageMB: 0, // Calculé après
    };

    // Calculer l'estimation mémoire sans récursion
    baseStats.memoryUsageMB = this.estimateMemoryUsageMB(baseStats);
    return baseStats;
  }

  /**
   * 🏗️ Analyse d'une scène Three.js
   */
  analyzeScene(scene: THREE.Scene): SceneStats {
    const stats: SceneStats = {
      objects: 0,
      meshes: 0,
      lines: 0,
      groups: 0,
      triangles: 0,
    };

    scene.traverse((child) => {
      stats.objects++;

      if (child instanceof THREE.Mesh) {
        stats.meshes++;
        if (child.geometry) {
          const geometry = child.geometry;
          if (geometry.index) {
            stats.triangles += geometry.index.count / 3;
          } else {
            const positions = geometry.attributes.position;
            if (positions) {
              stats.triangles += positions.count / 3;
            }
          }
        }
      } else if (child instanceof THREE.Line) {
        stats.lines++;
      } else if (child instanceof THREE.Group) {
        stats.groups++;
      }
    });

    return stats;
  }

  /**
   * 🚨 Surveillance automatique des performances
   */
  checkPerformance(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
    const now = performance.now();

    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return; // Throttling
    }

    this.lastMemoryCheck = now;

    const memoryStats = this.getMemoryStats();
    const sceneStats = this.analyzeScene(scene);

    // Établir la baseline au premier appel
    if (!this.initialMemoryBaseline) {
      this.initialMemoryBaseline = { ...memoryStats };
      logger.info(
        `🎯 Baseline mémoire établie: ${memoryStats.memoryUsageMB.toFixed(
          1
        )}MB, ${memoryStats.triangles} triangles`
      );
      return;
    }

    // Détecter les fuites mémoire
    const memoryGrowth =
      memoryStats.memoryUsageMB - this.initialMemoryBaseline.memoryUsageMB;
    const triangleGrowth =
      memoryStats.triangles - this.initialMemoryBaseline.triangles;

    if (memoryGrowth > 50) {
      // Plus de 50MB de croissance
      logger.error(
        `🚨 Fuite mémoire détectée! Croissance: +${memoryGrowth.toFixed(1)}MB`
      );
    } else if (memoryGrowth > 20) {
      logger.warn(
        `⚠️ Croissance mémoire notable: +${memoryGrowth.toFixed(1)}MB`
      );
    }

    if (triangleGrowth > 1000) {
      // Plus de 1000 triangles de croissance
      logger.error(
        `🚨 Explosion de triangles! Croissance: +${triangleGrowth} triangles`
      );
    } else if (triangleGrowth > 500) {
      logger.warn(`⚠️ Augmentation triangles: +${triangleGrowth} triangles`);
    }

    // Log périodique optimisé
    logger.periodic(
      `📊 Stats: ${sceneStats.objects} objets, ${sceneStats.triangles} triangles, ` +
        `${memoryStats.memoryUsageMB.toFixed(1)}MB (${
          memoryGrowth > 0 ? "+" : ""
        }${memoryGrowth.toFixed(1)}MB)`,
      undefined,
      15000 // Toutes les 15 secondes
    );
  }

  /**
   * 🧮 Estimation de l'utilisation mémoire (approximative)
   */
  private estimateMemoryUsageMB(stats: Partial<MemoryStats>): number {
    // Estimation très approximative basée sur les stats Three.js

    // Estimation grossière :
    // - Géométries : ~100KB chacune
    // - Textures : ~1MB chacune
    // - Matériaux : ~10KB chacun
    const estimatedBytes =
      (stats.geometries || 0) * 100 * 1024 +
      (stats.textures || 0) * 1024 * 1024 +
      (stats.materials || 0) * 10 * 1024;

    return estimatedBytes / (1024 * 1024); // Convertir en MB
  }

  /**
   * 🧹 Nettoyage forcé des ressources inutilisées
   */
  cleanupUnusedResources(): void {
    // Note: Three.js ne permet pas de nettoyer automatiquement
    // Cette méthode peut être étendue pour forcer le garbage collection
    logger.info("🧹 Nettoyage des ressources Three.js...");

    if ((window as any).gc) {
      (window as any).gc();
      logger.info("♻️ Garbage collection forcé");
    }
  }

  /**
   * 📋 Rapport détaillé de performance
   */
  generateReport(scene: THREE.Scene): string {
    const memoryStats = this.getMemoryStats();
    const sceneStats = this.analyzeScene(scene);

    return `
🔍 RAPPORT DE PERFORMANCE
=======================
Scène:
  • Objets: ${sceneStats.objects}
  • Meshes: ${sceneStats.meshes}
  • Lignes: ${sceneStats.lines} 
  • Groupes: ${sceneStats.groups}
  • Triangles: ${sceneStats.triangles}

Mémoire:
  • Géométries: ${memoryStats.geometries}
  • Textures: ${memoryStats.textures}
  • Matériaux: ${memoryStats.materials}
  • Usage estimé: ${memoryStats.memoryUsageMB.toFixed(1)}MB
  • Triangles rendus: ${memoryStats.triangles}
    `.trim();
  }
}

// 🌟 Instance globale
export const performanceMonitor = PerformanceMonitor.getInstance();
