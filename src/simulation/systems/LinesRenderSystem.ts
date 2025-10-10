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

import * as THREE from 'three';

import { BaseSimulationSystem, SimulationContext } from '../../base/BaseSimulationSystem';
import { Entity } from '../entities/Entity';
import { MeshComponent } from '../components/MeshComponent';
import { Kite } from '../../objects/Kite';
import { CONFIG } from '../config/SimulationConfig';
import { Logger } from '../../utils/Logging';

import { ControlBarSystem } from './ControlBarSystem';

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

  update(context: SimulationContext): void {
    if (!this.kite || !this.controlBarSystem) return;

    // Récupérer les positions des poignées
    const handles = this.controlBarSystem.getHandlePositions();
    if (!handles) return;

    // Récupérer les points de contrôle du kite
    const ctrlLeft = this.kite.getPoint('CTRL_GAUCHE');
    const ctrlRight = this.kite.getPoint('CTRL_DROIT');

    if (!ctrlLeft || !ctrlRight) return;

    const ctrlLeftWorld = this.kite.toWorldCoordinates(ctrlLeft);
    const ctrlRightWorld = this.kite.toWorldCoordinates(ctrlRight);

    // Mettre à jour chaque ligne
    this.lineEntities.forEach((entity, id) => {
      const lineData = entity.getComponent<any>('line');
      const mesh = entity.getComponent<MeshComponent>('mesh');

      if (!lineData || !mesh) return;

      // Déterminer les points de départ et d'arrivée selon le côté
      const start = lineData.side === 'left' ? ctrlLeftWorld : ctrlRightWorld;
      const end = lineData.side === 'left' ? handles.left : handles.right;

      // Mettre à jour la géométrie
      this.updateLineGeometry(
        mesh.object3D as THREE.Line,
        start,
        end,
        lineData.segments
      );
    });
  }

  /**
   * Met à jour la géométrie d'une ligne avec une courbe réaliste
   */
  private updateLineGeometry(
    line: THREE.Line,
    start: THREE.Vector3,
    end: THREE.Vector3,
    segments: number
  ): void {
    const geometry = line.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;

    if (!positions) return;

    // Calculer la distance et la direction
    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();

    // Facteur de courbure (simule la gravité et la tension)
    const sagFactor = 0.02; // 2% de la longueur
    const sag = distance * sagFactor;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;

      // Interpolation linéaire de base
      const x = start.x + direction.x * t;
      const y = start.y + direction.y * t;
      const z = start.z + direction.z * t;

      // Ajouter une courbure parabolique (caténaire simplifiée)
      // Maximum au milieu (t = 0.5)
      const curvature = -sag * 4 * t * (1 - t);

      positions.setXYZ(i, x, y + curvature, z);
    }

    positions.needsUpdate = true;
  }

  /**
   * Crée une entité de ligne
   */
  createLineEntity(
    id: string,
    side: 'left' | 'right',
    scene: THREE.Scene
  ): Entity {
    const entity = new Entity(id);

    // Créer la géométrie
    const segments = 20;
    const points = new Array(segments + 1).fill(0).map(() => new THREE.Vector3());
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Créer le matériau
    const material = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: CONFIG.visualization.lineWidth || 1
    });

    // Créer la ligne THREE.js
    const line = new THREE.Line(geometry, material);
    line.name = `${side}ControlLine`;

    // Ajouter à la scène
    scene.add(line);

    // Ajouter le composant Mesh
    const meshComponent = new MeshComponent(line, { visible: true });
    entity.addComponent(meshComponent);

    // Enregistrer l'entité
    this.registerLineEntity(id, entity, {
      segments,
      color: 0x333333,
      linewidth: CONFIG.visualization.lineWidth || 1,
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
