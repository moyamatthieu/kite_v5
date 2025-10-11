/**
 * LinesRenderSystem.ts - Système ECS pour le rendu des lignes de contrôle
 *
 * Responsabilités :
 *   - Gère les entités de lignes de contrôle (gauche et droite)
 *   - Met à jour la géométrie des lignes en fonction des positions du kite et de la barre
 *   - Applique une courbure réaliste aux lignes (caténaire)
 *
 * Architecture ECS :
 *   - Opère sur des LineEntity avec TransformComponent et MeshComponent
 *   - Lit les positions depuis ControlBarSystem et Kite
 *   - Met à jour les BufferGeometry THREE.js pour le rendu
 */

// External libraries
import * as THREE from 'three';

import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Logger } from '../../utils/Logging';
import { CONFIG } from '../config/SimulationConfig';
import { Kite } from '../../objects/Kite';
import { MeshComponent } from '../components/MeshComponent';
import { Entity } from '../entities/Entity';
import { LineEntity } from '../entities/LineEntity';

import { ControlBarSystem } from './ControlBarSystem';
import { KitePhysicsSystem } from './KitePhysicsSystem';

/**
 * Composant spécifique aux lignes pour stocker leurs paramètres
 */
export interface LineComponentData {
  segments: number;
  color: number;
  linewidth: number;
  side: 'left' | 'right';
}

export class LinesRenderSystem extends BaseSimulationSystem {
  private logger: Logger;
  private lineEntities: Map<string, Entity> = new Map();
  private kite: Kite | null = null;
  private controlBarSystem: ControlBarSystem | null = null;
  private kitePhysicsSystem: KitePhysicsSystem | null = null;

  constructor() {
    super('LinesRenderSystem', 6); // Après ControlBarSystem, avant RenderSystem
    this.logger = Logger.getInstance();
  }

  async initialize(): Promise<void> {
    this.logger.info('LinesRenderSystem initialized', 'LinesRenderSystem');
  }

  /**
   * Enregistre une entité de ligne
   */
  registerLineEntity(id: string, entity: Entity, data: LineComponentData): void {
    if (!entity.hasComponent('mesh')) {
      throw new Error('LineEntity must have a Mesh component');
    }

    // Stocker les données de ligne dans l'entité
    entity.addComponent({
      type: 'line',
      ...data
    });

    this.lineEntities.set(id, entity);
  }

  /**
   * Définit la référence au kite (temporaire)
   */
  setKite(kite: Kite): void {
    this.kite = kite;
  }

  /**
   * Définit la référence au système de barre de contrôle
   */
  setControlBarSystem(system: ControlBarSystem): void {
    this.controlBarSystem = system;
  }

  /**
   * Définit la référence au système de physique du kite (pour accéder aux tensions)
   */
  setKitePhysicsSystem(system: KitePhysicsSystem): void {
    this.kitePhysicsSystem = system;
  }

  update(_context: SimulationContext): void {
    if (!this.kite || !this.controlBarSystem) {
      console.warn('🔴 LinesRenderSystem: kite ou controlBarSystem manquant');
      return;
    }

    // Récupérer les positions des poignées
    const handles = this.controlBarSystem.getHandlePositions();
    if (!handles) {
      console.warn('🔴 LinesRenderSystem: handles manquants');
      return;
    }

    // Récupérer les points de contrôle du kite
    const ctrlLeft = this.kite.getPoint('CTRL_GAUCHE');
    const ctrlRight = this.kite.getPoint('CTRL_DROIT');

    if (!ctrlLeft || !ctrlRight) {
      console.warn('🔴 LinesRenderSystem: points de contrôle kite manquants');
      return;
    }

    const ctrlLeftWorld = this.kite.toWorldCoordinates(ctrlLeft);
    const ctrlRightWorld = this.kite.toWorldCoordinates(ctrlRight);

    // 🔍 DEBUG : Log une fois toutes les 60 frames (1 fois par seconde à 60fps)
    if (_context.totalTime % 1 < 0.016) {
      console.log('✅ LinesRenderSystem update:', {
        lineCount: this.lineEntities.size,
        handleLeft: handles.left.toArray(),
        handleRight: handles.right.toArray(),
        ctrlLeft: ctrlLeftWorld.toArray(),
        ctrlRight: ctrlRightWorld.toArray()
      });
    }

    // Mettre à jour chaque ligne
    this.lineEntities.forEach((entity) => {
      const lineData = entity.getComponent<any>('line');
      const mesh = entity.getComponent<MeshComponent>('mesh');

      if (!lineData || !mesh) return;

      // Déterminer les points de départ et d'arrivée selon le côté
      // Les lignes partent de la barre de contrôle vers le kite
      const start = lineData.side === 'left' ? handles.left : handles.right;
      const end = lineData.side === 'left' ? ctrlLeftWorld : ctrlRightWorld;

      // Mettre à jour la géométrie
      this.updateLineGeometry(
        mesh.object3D as THREE.Mesh,
        start,
        end,
        lineData.segments
      );

      // Mettre à jour la couleur basée sur les tensions physiques émergentes
      this.updateLineColorFromTension(mesh.object3D as THREE.Mesh, lineData.side);
    });
  }

  /**
   * Met à jour la géométrie d'une ligne avec une courbe réaliste
   */
  private updateLineGeometry(
    line: THREE.Mesh,
    start: THREE.Vector3,
    end: THREE.Vector3,
    segments: number
  ): void {
    const tubeMesh = line as THREE.Mesh;

    // Créer une nouvelle courbe pour le tube
    const points: THREE.Vector3[] = [];

    // Calculer la distance et la direction
    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();

    // Facteur de courbure (simule la gravité et la tension)
    const sag = distance * CONFIG.defaults.catenarySagFactor;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Interpolation linéaire de base
      const x = start.x + direction.x * t;
      const y = start.y + direction.y * t;
      const z = start.z + direction.z * t;

      // Ajouter une courbure parabolique (caténaire simplifiée)
      // Maximum au milieu (t = 0.5)
      const curvature = -sag * 4 * t * (1 - t);

      points.push(new THREE.Vector3(x, y + curvature, z));
    }

    // Créer une nouvelle courbe et géométrie de tube
    const curve = new THREE.CatmullRomCurve3(points);
    const newTubeGeometry = new THREE.TubeGeometry(
      curve,
      segments,
      CONFIG.defaults.tubeRadius, // Utilise la valeur de config (0.015)
      CONFIG.defaults.tubeRadialSegments,
      false
    );

    // Remplacer la géométrie
    if (tubeMesh.geometry) {
      tubeMesh.geometry.dispose();
    }
    tubeMesh.geometry = newTubeGeometry;
  }

  /**
   * Met à jour la couleur de la ligne basée sur les tensions physiques émergentes
   * Respecte le principe : vert (molle) → jaune (moyenne) → rouge (tendue)
   */
  private updateLineColorFromTension(line: THREE.Mesh, side: 'left' | 'right'): void {
    if (!this.kitePhysicsSystem) return;

    // Récupérer les informations de debug du système physique
    const debugInfo = this.kitePhysicsSystem.getDebugInfo?.();
    if (!debugInfo || !debugInfo.lineTensions) return;

    // Calculer la tension pour ce côté (émergente des contraintes physiques)
    const tension = side === 'left' ? debugInfo.lineTensions.left : debugInfo.lineTensions.right;

    // Calculer la couleur basée sur les seuils physiques définis dans CONFIG
    const color = this.calculateTensionColor(tension);

    // Appliquer la couleur au matériau du tube
    const material = line.material as THREE.MeshStandardMaterial;
    if (material && material.color) {
      material.color.setHex(color);
    }
  }

  /**
   * Calcule la couleur basée sur la tension selon les principes physiques
   * Vert (faible tension) → Jaune (tension moyenne) → Rouge (forte tension)
   */
  private calculateTensionColor(tension: number): number {
    const { bridleTensionMedium, bridleTensionHigh } = CONFIG.debug;

    // Normaliser la tension entre 0 et 1
    const normalizedTension = Math.min(tension / bridleTensionHigh, 1);

    if (normalizedTension <= 0) {
      return 0x00ff00; // Vert - tension nulle/mollesse
    } else if (normalizedTension < bridleTensionMedium / bridleTensionHigh) {
      // Interpolation vert → jaune pour tensions faibles à moyennes
      const t = normalizedTension / (bridleTensionMedium / bridleTensionHigh);
      const r = Math.round(255 * t);     // 0 → 255 (vert → jaune)
      const g = 255;                    // 255 → 255 (vert → jaune)
      const b = 0;                      // 0 → 0 (vert → jaune)
      return (r << 16) | (g << 8) | b;
    } else {
      // Interpolation jaune → rouge pour tensions moyennes à élevées
      const t = (normalizedTension - bridleTensionMedium / bridleTensionHigh) /
                (1 - bridleTensionMedium / bridleTensionHigh);
      const r = 255;                    // 255 → 255 (jaune → rouge)
      const g = Math.round(255 * (1 - t)); // 255 → 0 (jaune → rouge)
      const b = 0;                      // 0 → 0 (jaune → rouge)
      return (r << 16) | (g << 8) | b;
    }
  }

  /**
   * Crée une entité de ligne
   */
  createLineEntity(
    id: string,
    side: 'left' | 'right',
    scene: THREE.Scene
  ): LineEntity {
    const entity = new LineEntity(side);

    // Récupérer le mesh créé par LineEntity et l'ajouter à la scène
    const mesh = entity.getComponent<MeshComponent>('mesh');
    if (mesh) {
      scene.add(mesh.object3D);
      const tubeMesh = mesh.object3D as THREE.Mesh;
      const material = tubeMesh.material as THREE.MeshStandardMaterial;
      console.log(`✅ Ligne ${side} ajoutée à la scène:`, {
        id,
        position: mesh.object3D.position.toArray(),
        visible: mesh.object3D.visible,
        geometry: tubeMesh.geometry.type,
        material: material.type,
        color: material.color.getHexString()
      });
    } else {
      console.error(`🔴 Ligne ${side}: mesh component manquant!`);
    }

    // Enregistrer l'entité
    this.registerLineEntity(id, entity, {
      segments: CONFIG.defaults.meshSegments,
      color: CONFIG.colors.controlBar,
      linewidth: CONFIG.rendering.lineWidth,
      side
    });

    return entity;
  }

  /**
   * Supprime une entité de ligne
   */
  removeLineEntity(id: string, scene: THREE.Scene): void {
    const entity = this.lineEntities.get(id);
    if (!entity) return;

    const mesh = entity.getComponent<MeshComponent>('mesh');
    if (mesh) {
      scene.remove(mesh.object3D);
      mesh.dispose();
    }

    this.lineEntities.delete(id);
  }

  reset(): void {
    // Les lignes n'ont pas d'état à réinitialiser
    // La géométrie sera recalculée au prochain update
    this.logger.info('LinesRenderSystem reset', 'LinesRenderSystem');
  }

  dispose(): void {
    this.lineEntities.forEach((entity) => {
      const mesh = entity.getComponent<MeshComponent>('mesh');
      if (mesh) {
        mesh.dispose();
      }
    });

    this.lineEntities.clear();
    this.kite = null;
    this.controlBarSystem = null;

    this.logger.info('LinesRenderSystem disposed', 'LinesRenderSystem');
  }
}
