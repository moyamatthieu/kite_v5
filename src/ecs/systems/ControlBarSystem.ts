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

import * as THREE from 'three';

import { BaseSystem } from '@/ecs/BaseSystem';
import { Entity } from '@/ecs/Entity';
import { TransformComponent } from '@/ecs/components/TransformComponent';
import { MeshComponent } from '@/ecs/components/MeshComponent';
import { InputSystem } from '@/ecs/systems/InputSystem';
import { HandlePositions } from '@mytypes/PhysicsTypes';

import { Logger } from '@utils/Logging';
import { CONFIG } from '@config/SimulationConfig';

export class ControlBarSystem extends BaseSystem {
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
    return Promise.resolve();
  }

  /**
   * Enregistre l'entité de la barre de contrôle
   */
  setControlBarEntity(entity: Entity): void {
    if (!entity.getComponent<TransformComponent>('transform') || !entity.getComponent<MeshComponent>('mesh')) {
      throw new Error('ControlBarEntity must have Transform and Mesh components');
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

  update(entities: Entity[], deltaTime: number): void {
    if (!this.controlBarEntity || !this.inputSystem) return;

    const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
    if (!transform) return;

    // Input utilisateur (-1 à +1)
    const inputState = this.inputSystem.getInputState();
    // Inverser le signe : ArrowLeft (-1) doit donner rotation positive (vers la gauche quand on regarde depuis le pilote)
    const targetRotation = -inputState.barPosition * CONFIG.input.maxRotation;
    this.currentRotation = THREE.MathUtils.lerp(
      this.currentRotation,
      targetRotation,
      this.smoothingFactor
    );

    // Rotation physique vers le kite (si kiteEntity disponible)
    const physicalRotation = this.computePhysicalRotation();

    // Pondération entre input et physique (80% input, 20% physique)
    const finalRotation = this.currentRotation * 0.8 + physicalRotation * 0.2;

    // Calculer l'axe de rotation : perpendiculaire au plan défini par l'axe X de la barre et le vecteur vers le kite
    // Cela permet une rotation "dans l'axe" en regardant le kite
    const barDirection = new THREE.Vector3(1, 0, 0); // Axe X local de la barre
    const toKite = this.computeToKiteVector();
    const rotationAxis = new THREE.Vector3().crossVectors(barDirection, toKite);

    // Gestion du cas dégénéré (axe quasi-nul)
    if (rotationAxis.length() < 0.01) { // PhysicsConstants.CONTROL_DEADZONE
      rotationAxis.set(0, 1, 0); // Fallback vers axe Y vertical
    } else {
      rotationAxis.normalize();
    }

    // Appliquer la rotation autour de cet axe (rotation dans l'axe du regard)
    transform.quaternion.setFromAxisAngle(rotationAxis, finalRotation);

    // Synchroniser avec le mesh Three.js
    const mesh = this.controlBarEntity.getComponent<MeshComponent>('mesh');
    if (mesh) {
      mesh.syncToObject3D({
        position: transform.position,
        quaternion: transform.quaternion,
        scale: transform.scale
      });
    }
  }


  /**
   * Obtient les positions des poignées (pour le rendu des lignes)
   * Les poignées sont aux extrémités de la barre et suivent la rotation combinée
   * Puisque la barre est un enfant du pilote, on doit calculer les positions dans le monde
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

    // Ajouter la position relative de la barre
    handleLeftLocal.add(transform.position);
    handleRightLocal.add(transform.position);

    // Maintenant convertir en coordonnées monde : ajouter la position du pilote
    // (puisque la barre est enfant du pilote)
    const pilotPosition = CONFIG.pilot.position;
    handleLeftLocal.add(pilotPosition);
    handleRightLocal.add(pilotPosition);

    return {
      left: handleLeftLocal,
      right: handleRightLocal,
    };
  }

  reset(): void {
    this.currentRotation = 0;

    if (this.controlBarEntity) {
      const transform = this.controlBarEntity.getComponent<TransformComponent>('transform');
      if (transform) {
        // Position relative par rapport au pilote (la barre est enfant du pilote)
        transform.position.set(
          0, // Même X que le pilote
          CONFIG.controlBar.offsetY, // Au-dessus du pilote
          CONFIG.controlBar.offsetZ  // Devant le pilote
        );
        // Orientation horizontale par défaut vers l'avant (axe Z)
        const defaultAxis = new THREE.Vector3(0, 0, 1);
        transform.quaternion.setFromAxisAngle(defaultAxis, CONFIG.controlBar.barRotation);
      }
    }

    this.logger.info('ControlBarSystem reset', 'ControlBarSystem');
  }

  dispose(): void {
    this.controlBarEntity = null;
    this.inputSystem = null;
    this.logger.info('ControlBarSystem disposed', 'ControlBarSystem');
  }
}