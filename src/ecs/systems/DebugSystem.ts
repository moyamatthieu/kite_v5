/**
 * DebugSystem.ts - Visualisation du debug (vecteurs de force)
 *
 * Affiche les vecteurs de force appliqués au kite quand debugMode est activé.
 * Priorité 88 (très basse, après le rendu normal).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { Entity } from '../core/Entity';
import { InputComponent } from '../components/InputComponent';
import { DebugComponent } from '../components/DebugComponent';
import { PhysicsComponent } from '../components/PhysicsComponent';
import { TransformComponent } from '../components/TransformComponent';
import { LineComponent } from '../components/LineComponent';
import { GeometryComponent } from '../components/GeometryComponent';
import { DebugFactory } from '../entities/DebugFactory';

import { RenderSystem } from './RenderSystem';

export class DebugSystem extends System {
  private inputComponent: InputComponent | null = null;
  renderSystem: RenderSystem | null = null; // Public pour SimulationApp
  private debugEntity: Entity | null = null;
  private prevDebugMode = false;
  private lastLogTime = 0;

  constructor() {
    super('DebugSystem', 48); // Priority 48 : APRÈS ConstraintSystem (40) mais AVANT PhysicsSystem (50)
  }

  initialize(entityManager: EntityManager): void {
    console.log('🐛 [DebugSystem] Initializing...');
    
    // Chercher l'InputComponent
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0) {
      const comp = inputEntities[0].getComponent('Input');
      if (comp) {
        this.inputComponent = comp as InputComponent;
        console.log('🐛 [DebugSystem] InputComponent found');
      }
    }

    // Récupérer l'entité debug
    const debugEntities = entityManager.query(['debug']);
    console.log('🐛 [DebugSystem] Debug entities found:', debugEntities.length);
    
    let debugEntity = debugEntities.find(e => e.id === 'debug-helper');
    
    if (!debugEntity) {
      console.log('🐛 [DebugSystem] Creating new debug entity...');
      // Créer une nouvelle entité debug si elle n'existe pas
      debugEntity = DebugFactory.create();
      entityManager.register(debugEntity);
      console.log('🐛 [DebugSystem] Debug entity created and registered');
    } else {
      console.log('🐛 [DebugSystem] Debug entity found:', debugEntity.id);
    }
    
    this.debugEntity = debugEntity ?? null;
  }

  update(context: SimulationContext): void {
    const currentTime = performance.now();
    const shouldLog = currentTime - this.lastLogTime > 5000; // Log max une fois toutes les 5 secondes
    
    if (!this.inputComponent || !this.debugEntity || !this.renderSystem) {
      if (!this.renderSystem && shouldLog) {
        console.warn('🐛 [DebugSystem] renderSystem not set');
        this.lastLogTime = currentTime;
      }
      return;
    }

    const debugComp = this.debugEntity.getComponent('debug') as DebugComponent | null;
    if (!debugComp) {
      console.warn('🐛 [DebugSystem] DebugComponent not found');
      return;
    }

    // Si le mode debug vient d'être activé, ajouter le groupe à la scène
    if (this.inputComponent.debugMode && !this.prevDebugMode) {
      console.log('🐛 [DebugSystem] DEBUG MODE ACTIVATED');
      console.log('  - RenderSystem scene:', this.renderSystem.scene);
      console.log('  - DebugGroup:', debugComp.debugGroup);
      this.renderSystem.scene.add(debugComp.debugGroup);
      console.log('  - DebugGroup added to scene');
      this.lastLogTime = currentTime;
    }
    // Si le mode debug vient d'être désactivé, enlever le groupe
    else if (!this.inputComponent.debugMode && this.prevDebugMode) {
      console.log('🐛 [DebugSystem] DEBUG MODE DEACTIVATED');
      this.renderSystem.scene.remove(debugComp.debugGroup);
      debugComp.clearArrows();
      this.lastLogTime = currentTime;
    }

    this.prevDebugMode = this.inputComponent.debugMode;

    if (!this.inputComponent.debugMode) {
      return; // Ne rien faire si debug désactivé
    }

    // Nettoyer les flèches précédentes
    debugComp.clearArrows();

    // Chercher le kite et afficher les forces
    const kiteEntity = context.entityManager.query(['physics', 'transform']).find(e => e.id === 'kite');
    if (!kiteEntity) {
      console.warn('🐛 [DebugSystem] Kite entity not found');
      return;
    }

    const physics = kiteEntity.getComponent('physics') as PhysicsComponent | null;
    const transform = kiteEntity.getComponent('transform') as TransformComponent | null;

    if (!physics || !transform) {
      console.warn('🐛 [DebugSystem] Physics or Transform component missing');
      return;
    }

    // Log uniquement si demandé (toutes les 5 secondes)
    if (shouldLog) {
      console.log(`🐛 [DebugSystem] Face forces: ${physics.faceForces.length} faces avec portance/traînée`);
      this.lastLogTime = currentTime;
    }
    
    // === Afficher les forces par face (aux positions exactes de calcul) ===
    const scale = 0.5; // Facteur d'échelle pour la visibilité
    const minForceThreshold = 0.001; // Seuil réduit pour le debug
    
    // Afficher les forces de portance, traînée et gravité pour chaque face
    physics.faceForces.forEach((faceForce, index) => {
      // Portance (bleu ciel)
      if (faceForce.lift.length() > minForceThreshold) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.lift.clone().multiplyScalar(scale),
          0x87CEEB, // Bleu ciel
          `lift-face-${index}`
        );
      }
      
      // Traînée (rouge)
      if (faceForce.drag.length() > minForceThreshold) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.drag.clone().multiplyScalar(scale),
          0xff0000, // Rouge
          `drag-face-${index}`
        );
      }

      // Gravité par face (jaune)
      if (faceForce.gravity.length() > minForceThreshold) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.gravity.clone().multiplyScalar(scale),
          0xffff00, // Jaune
          `gravity-face-${index}`
        );
      }

      // Vent apparent par face (vert)
      if (faceForce.apparentWind.length() > minForceThreshold) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.apparentWind.clone().multiplyScalar(0.05), // Échelle réduite pour visibilité
          0x00ff00, // Vert
          `apparent-wind-face-${index}`
        );
      }
    });

    // === Afficher les tensions des lignes (magenta) ===
    this.displayLineTensions(debugComp, context, kiteEntity, scale);

    // === Afficher les forces aux poignets de la barre (cyan) ===
    this.displayGripForces(debugComp, context, scale);

    // Log count seulement lors du throttle
    // (Le log de forces ci-dessus a déjà mis à jour lastLogTime)
  }

  /**
   * Affiche les vecteurs de tension des lignes aux points d'attache
   */
  private displayLineTensions(debugComp: DebugComponent, context: SimulationContext, kiteEntity: any, scale: number): void {
    const { entityManager } = context;

    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    const controlBar = entityManager.getEntity('controlBar');

    if (!controlBar) return;

    const kiteGeometry = kiteEntity.getComponent('geometry') as GeometryComponent | null;
    const barGeometry = controlBar.getComponent('geometry') as GeometryComponent | null;

    if (!kiteGeometry || !barGeometry) return;

    // Tension ligne gauche
    if (leftLine) {
      const lineComp = leftLine.getComponent('line') as LineComponent | null;
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > 0.001) {
        const kitePoint = kiteGeometry.getPointWorld('CTRL_GAUCHE', kiteEntity);
        const barPoint = barGeometry.getPointWorld('leftHandle', controlBar);

        if (kitePoint && barPoint) {
          const direction = barPoint.clone().sub(kitePoint).normalize();
          const tensionVector = direction.multiplyScalar(lineComp.currentTension);

          // Afficher la tension (magenta)
          debugComp.addForceArrow(
            kitePoint.clone(),
            tensionVector.clone().multiplyScalar(scale),
            0xff00ff, // Magenta
            'tension-left'
          );
        }
      }
    }

    // Tension ligne droite
    if (rightLine) {
      const lineComp = rightLine.getComponent('line') as LineComponent | null;
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > 0.001) {
        const kitePoint = kiteGeometry.getPointWorld('CTRL_DROIT', kiteEntity);
        const barPoint = barGeometry.getPointWorld('rightHandle', controlBar);

        if (kitePoint && barPoint) {
          const direction = barPoint.clone().sub(kitePoint).normalize();
          const tensionVector = direction.multiplyScalar(lineComp.currentTension);

          // Afficher la tension (magenta)
          debugComp.addForceArrow(
            kitePoint.clone(),
            tensionVector.clone().multiplyScalar(scale),
            0xff00ff, // Magenta
            'tension-right'
          );
        }
      }
    }
  }

  /**
   * Affiche les forces de tension au niveau des poignets de la barre de contrôle
   * Visualise la force que les lignes exercent sur les mains du pilote
   */
  private displayGripForces(debugComp: DebugComponent, context: SimulationContext, scale: number): void {
    const { entityManager } = context;

    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    const controlBar = entityManager.getEntity('controlBar');

    if (!controlBar) return;

    const barGeometry = controlBar.getComponent('geometry') as GeometryComponent | null;
    if (!barGeometry) return;

    // Force sur le poignet gauche
    if (leftLine) {
      const lineComp = leftLine.getComponent('line') as LineComponent | null;
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > 0.001) {
        const barPoint = barGeometry.getPointWorld('leftHandle', controlBar);
        
        if (barPoint) {
          // La tension tire le poignet vers le haut-avant (direction du kite)
          const barTransform = controlBar.getComponent('transform') as TransformComponent | null;
          const kiteEntity = entityManager.getEntity('kite');
          const kiteTransform = kiteEntity?.getComponent('transform') as TransformComponent | null;
          
          if (kiteTransform && barTransform) {
            const direction = kiteTransform.position.clone().sub(barTransform.position).normalize();
            const gripForce = direction.multiplyScalar(lineComp.currentTension);

            // Afficher la force au poignet (cyan = couleur des forces de grip)
            debugComp.addForceArrow(
              barPoint.clone(),
              gripForce.clone().multiplyScalar(scale),
              0x00ffff, // Cyan
              'grip-force-left'
            );
          }
        }
      }
    }

    // Force sur le poignet droit
    if (rightLine) {
      const lineComp = rightLine.getComponent('line') as LineComponent | null;
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > 0.001) {
        const barPoint = barGeometry.getPointWorld('rightHandle', controlBar);
        
        if (barPoint) {
          const barTransform = controlBar.getComponent('transform') as TransformComponent | null;
          const kiteEntity = entityManager.getEntity('kite');
          const kiteTransform = kiteEntity?.getComponent('transform') as TransformComponent | null;
          
          if (kiteTransform && barTransform) {
            const direction = kiteTransform.position.clone().sub(barTransform.position).normalize();
            const gripForce = direction.multiplyScalar(lineComp.currentTension);

            // Afficher la force au poignet (cyan)
            debugComp.addForceArrow(
              barPoint.clone(),
              gripForce.clone().multiplyScalar(scale),
              0x00ffff, // Cyan
              'grip-force-right'
            );
          }
        }
      }
    }
  }

  /**
   * Réinitialise l'état du debug (appelé lors d'un reset de simulation)
   * Nettoie tous les vecteurs de debug et retire le groupe de la scène
   */
  resetDebugState(): void {
    if (!this.debugEntity || !this.renderSystem) return;

    const debugComp = this.debugEntity.getComponent('debug') as DebugComponent | null;
    if (debugComp) {
      console.log('🐛 [DebugSystem] Resetting debug state...');

      // Nettoyer toutes les flèches
      debugComp.clearArrows();

      // Retirer le groupe de la scène
      if (debugComp.debugGroup.parent) {
        this.renderSystem.scene.remove(debugComp.debugGroup);
        console.log('🐛 [DebugSystem] DebugGroup removed from scene');
      }

      // Réinitialiser le flag prevDebugMode pour forcer la ré-ajout si debug activé
      this.prevDebugMode = false;
    }
  }

  dispose(): void {
    if (this.debugEntity) {
      const debugComp = this.debugEntity.getComponent('debug') as DebugComponent | null;
      if (debugComp) {
        debugComp.clearArrows();
      }
    }
  }
}
