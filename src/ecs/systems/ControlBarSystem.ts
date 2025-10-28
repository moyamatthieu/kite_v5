/**
 * ControlBarSystem.ts - Système ECS pour la gestion de la barre de contrôle
 *
 * NOUVELLES RESPONSABILITÉS :
 *   - Gère l'entité de la barre de contrôle (position, rotation, visuel)
 *   - La barre est contrôlée directement par les inputs utilisateur (flèches)
 *   - Pivot central fixe avec rotation horizontale selon les commandes
 *   - Les poignées sont positionnées aux extrémités de la barre
 *
 * NOUVELLE ARCHITECTURE :
 *   - Opère sur une ControlBarEntity avec TransformComponent et MeshComponent
 *   - Lecture directe des inputs depuis InputSystem (pas de calcul basé sur le kite)
 *   - Rotation directe selon les commandes fléchées (-1 à +1)
 *   - Position centrale fixe devant le pilote
 */

// External libraries
import * as THREE from 'three';
import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';
import { Entity } from '@base/Entity';
import { HandlePositions } from '@mytypes/PhysicsTypes';
import { Logger } from '@utils/Logging';
import { CONFIG } from '@config/SimulationConfig';

import { TransformComponent } from '@/ecs/components/TransformComponent';
import { MeshComponent } from '@/ecs/components/MeshComponent';
import { InputSystem } from '@/ecs/systems/InputSystem';


export class ControlBarSystem extends BaseSimulationSystem {
  private logger: Logger;
  private controlBarEntity: Entity | null = null;
  private inputSystem: InputSystem | null = null;
  private currentRotation: number = 0;
  private smoothingFactor: number = CONFIG.defaults.smoothingFactor;

  constructor() {
    // Priorité moyenne (après Input, avant Render)
    super('ControlBarSystem', 5);
    this.logger = Logger.getInstance();
  }

  initialize(): Promise<void> {
    this.logger.info('ControlBarSystem initialized', 'ControlBarSystem');
    
    // Synchroniser la position initiale de la barre avec le mesh Three.js
    if (this.controlBarEntity) {
      const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
      const mesh = this.controlBarEntity.getComponent<MeshComponent>('mesh');

      if (mesh && transform) {
        mesh.syncToObject3D({
          position: transform.position,
          quaternion: transform.quaternion,
          scale: transform.scale
        });
      }
    }
    
    return Promise.resolve();
  }

  reset(): void {
    this.currentRotation = 0;
    if (this.controlBarEntity) {
      const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
      if (transform) {
        transform.quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
      }
    }
  }

  dispose(): void {
    this.controlBarEntity = null;
    this.inputSystem = null;
  }

  setControlBarEntity(entity: Entity): void {
    if (!entity.getComponent<TransformComponent>('transform')) {
      throw new Error('ControlBarEntity must have Transform component');
    }
    this.controlBarEntity = entity;
  }

  /**
   * Définit la référence au système d'inputs
   */
  setInputSystem(inputSystem: InputSystem): void {
    this.inputSystem = inputSystem;
  }

  /**
   * Calcule la rotation physique de la barre vers le kite
   */
  private computePhysicalRotation(): number {
    const toKite = this.computeToKiteVector();
    if (toKite.length() < 1e-4) return 0;
    toKite.normalize();
    // Angle entre l'axe X local de la barre et le vecteur vers le kite
    const angle = Math.atan2(toKite.z, toKite.x); // Angle dans le plan XZ
    return angle;
  }

  /**
   * Calcule le vecteur du centre de la barre vers le kite (plan horizontal)
   */
  private computeToKiteVector(): THREE.Vector3 {
    if (!this.controlBarEntity) return new THREE.Vector3();
    const barTransform = this.controlBarEntity.getComponent<TransformComponent>('transform');
    if (!barTransform) return new THREE.Vector3();
    // Vecteur du centre de la barre vers le kite (plan horizontal)
    const toKite = new THREE.Vector3(0, 0, 0); // Remplacer par la position du kite
    toKite.sub(barTransform.position);
    toKite.y = 0; // Garder dans le plan horizontal
    return toKite;
  }

  update(context: SimulationContext): void {
    if (!this.controlBarEntity || !this.inputSystem) return;

    const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
    const mesh = this.controlBarEntity.getComponent<MeshComponent>('mesh');
    if (!transform || !mesh) return;

    // Input utilisateur (-1 à +1)
    const inputState = this.inputSystem.getInputState();
    // Inverser le signe : ArrowLeft (-1) doit donner rotation positive (vers la gauche quand on regarde depuis le pilote)
    const targetRotation = -inputState.barPosition * CONFIG.input.maxRotation;
    this.currentRotation = THREE.MathUtils.lerp(
      this.currentRotation,
      targetRotation,
      this.smoothingFactor * (60 * context.deltaTime) // Rendre le lissage indépendant du framerate
    );

    // Appliquer la rotation au transform
    transform.quaternion.setFromEuler(new THREE.Euler(0, this.currentRotation, 0));

    // Synchroniser avec le mesh Three.js
    mesh.syncToObject3D({
      position: transform.position,
      quaternion: transform.quaternion,
      scale: transform.scale
    });
  }

  /**
   * Obtient les positions des poignées (pour le rendu des lignes)
   * Les poignées sont aux extrémités de la barre et suivent la rotation
   */
  getHandlePositions(): HandlePositions | null {
    if (!this.controlBarEntity) return null;

    const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
    if (!transform) return null;

    // Les poignées sont positionnées relativement à la barre
    const halfWidth = CONFIG.controlBar.width / 2;
    const handleLeftLocal = new THREE.Vector3(-halfWidth, 0, 0);
    const handleRightLocal = new THREE.Vector3(halfWidth, 0, 0);

    // Appliquer la rotation de la barre aux positions locales des poignées
    handleLeftLocal.applyQuaternion(transform.quaternion);
    handleRightLocal.applyQuaternion(transform.quaternion);

    // Ajouter la position de la barre (déjà en coordonnées monde)
    handleLeftLocal.add(transform.position);
    handleRightLocal.add(transform.position);

    return {
      left: handleLeftLocal,
      right: handleRightLocal,
    };
  }
}