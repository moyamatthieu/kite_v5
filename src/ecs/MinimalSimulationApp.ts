/**
 * MinimalSimulationApp.ts - Test minimal pour diagnostiquer les erreurs
 */

import * as THREE from 'three';
import { EntityManager } from './core/EntityManager';
import { SystemManager } from './core/SystemManager';
import { SimplePhysicsSystem } from './systems/SimplePhysicsSystem';
import { RenderSystem } from './systems/RenderSystem';
import { Logger } from './utils/Logging';

export class MinimalSimulationApp {
  private entityManager: EntityManager;
  private systemManager: SystemManager;
  private logger = Logger.getInstance();

  constructor(private canvas: HTMLCanvasElement) {
    this.entityManager = new EntityManager();
    this.systemManager = new SystemManager();
  }

  async initialize(): Promise<void> {
    this.logger.info('🚀 Initializing minimal simulation...');

    // Créer un système de rendu minimal
    const renderSystem = new RenderSystem(this.canvas);
    this.systemManager.add(renderSystem);

    // Créer le système de physique simplifié
    const physicsSystem = new SimplePhysicsSystem();
    this.systemManager.add(physicsSystem);

    // Créer des entités minimales pour test
    this.createMinimalEntities();

    await this.systemManager.initializeAll(this.entityManager);
    this.logger.info('✅ Minimal simulation initialized');
  }

  private createMinimalEntities(): void {
    // Créer un kite minimal pour test
    const kiteEntity = {
      id: 'kite',
      components: new Map()
    };

    // Composants minimaux
    const transform = {
      type: 'transform',
      position: new THREE.Vector3(0, 8, -11),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    };

    const physics = {
      type: 'physics',
      velocity: new THREE.Vector3(0, 0, 0),
      mass: 2.5,
      invMass: 1/2.5,
      angularVelocity: new THREE.Vector3(0, 0, 0),
      inertia: new THREE.Matrix3().identity(),
      invInertia: new THREE.Matrix3().identity(),
      forces: new THREE.Vector3(0, 0, 0),
      torques: new THREE.Vector3(0, 0, 0),
      faceForces: [],
      linearDamping: 0.99,
      angularDamping: 0.99,
      isKinematic: false
    };

    kiteEntity.components.set('transform', transform);
    kiteEntity.components.set('physics', physics);

    this.entityManager.register(kiteEntity as any);
    this.logger.info('✅ Minimal kite entity created');
  }

  start(): void {
    this.logger.info('🎮 Starting minimal simulation');
    // Boucle de test simple
    const update = () => {
      const context = {
        entityManager: this.entityManager,
        deltaTime: 1/60,
        totalTime: Date.now() / 1000
      };
      this.systemManager.updateAll(context);
      requestAnimationFrame(update);
    };
    update();
  }

  dispose(): void {
    this.systemManager.disposeAll();
    this.entityManager.clear();
  }
}