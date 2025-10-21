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
import { DebugConfig } from '../config/Config';

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
    // Chercher l'InputComponent
    const inputEntities = entityManager.query(['Input']);
    if (inputEntities.length > 0) {
      const comp = inputEntities[0].getComponent('Input');
      if (comp) {
        this.inputComponent = comp as InputComponent;
      }
    }

    // Récupérer l'entité debug
    const debugEntities = entityManager.query(['debug']);
    
    let debugEntity = debugEntities.find(e => e.id === 'debug-helper');
    
    if (!debugEntity) {
      // Créer une nouvelle entité debug si elle n'existe pas
      debugEntity = DebugFactory.create();
      entityManager.register(debugEntity);
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
      this.renderSystem.scene.add(debugComp.debugGroup);
      this.lastLogTime = currentTime;
    }
    // Si le mode debug vient d'être désactivé, enlever le groupe
    else if (!this.inputComponent.debugMode && this.prevDebugMode) {
      this.renderSystem.scene.remove(debugComp.debugGroup);
      debugComp.clearAll(); // Nettoyer TOUT, y compris les labels persistants
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
      return;
    }

    const physics = kiteEntity.getComponent('physics') as PhysicsComponent | null;
    const transform = kiteEntity.getComponent('transform') as TransformComponent | null;

    if (!physics || !transform) {
      return;
    }

    // Log uniquement si demandé (toutes les 5 secondes)
    // Désactivé pour réduire le bruit de logs
    
    // === Afficher les forces par face (aux positions exactes de calcul) ===
    // Afficher les forces de portance, traînée et gravité pour chaque face
    physics.faceForces.forEach((faceForce, index) => {
      // Portance (bleu ciel) - TOUJOURS afficher même si petite
      if (faceForce.lift.length() > DebugConfig.LIFT_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.lift.clone().multiplyScalar(DebugConfig.FORCE_VECTOR_SCALE),
          0x87CEEB, // Bleu ciel
          `lift-face-${index}`
        );
      }
      
      // Traînée (rouge)
      if (faceForce.drag.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.drag.clone().multiplyScalar(DebugConfig.FORCE_VECTOR_SCALE),
          0xff0000, // Rouge
          `drag-face-${index}`
        );
      }

      // Gravité par face (jaune)
      if (faceForce.gravity.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.gravity.clone().multiplyScalar(DebugConfig.FORCE_VECTOR_SCALE),
          0xffff00, // Jaune
          `gravity-face-${index}`
        );
      }

      // Vent apparent par face (vert)
      if (faceForce.apparentWind.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.apparentWind.clone().multiplyScalar(DebugConfig.WIND_VECTOR_SCALE),
          0x00ff00, // Vert
          `apparent-wind-face-${index}`
        );
      }

      // 🎯 NORMALE de la face (bleu foncé)
      if (faceForce.normal && faceForce.normal.length() > DebugConfig.FORCE_THRESHOLD) {
        debugComp.addForceArrow(
          faceForce.centroid,
          faceForce.normal.clone().multiplyScalar(DebugConfig.NORMAL_DISPLAY_LENGTH),
          0x00008B, // Bleu foncé (dark blue)
          `normal-face-${index}`
        );
      }
      
      // 🏷️ LABEL numérique de la face (parallèle à la surface)
      // Créer les labels UNE SEULE FOIS, puis juste mettre à jour leur position
      const faceNumber = index + 1;
      
      if (faceForce.normal && faceForce.normal.length() > DebugConfig.MIN_FORCE_ARROW_DISPLAY) {
        if (!debugComp.labelsCreated) {
          // Première fois: créer le label
          debugComp.addSurfaceLabel(
            `${faceNumber}`, // Juste le numéro (1-4)
            faceForce.centroid.clone(), // Position au centre exact de la face
            faceForce.normal.clone(), // Normale pour alignement parallèle
            '#FFFF00', // Jaune pour visibilité
            DebugConfig.TEXT_LABEL_SIZE
          );
        } else {
          // Ensuite: juste mettre à jour la position (pas de recréation!)
          debugComp.updateSurfaceLabel(
            index,
            faceForce.centroid.clone(),
            faceForce.normal.clone()
          );
        }
      }
    });
    
    // Marquer les labels comme créés après la première passe
    if (!debugComp.labelsCreated && physics.faceForces.length > 0) {
      debugComp.labelsCreated = true;
    }

    // === Afficher les tensions des lignes (magenta) ===
    this.displayLineTensions(debugComp, context, kiteEntity);

    // === Afficher les forces aux poignets de la barre (cyan) ===
    this.displayGripForces(debugComp, context);

    // === Afficher le vecteur du vent au point NEZ (blanc) ===
    this.displayWindVector(debugComp, context, kiteEntity);

    // Log count seulement lors du throttle
    // (Le log de forces ci-dessus a déjà mis à jour lastLogTime)
  }

  /**
   * Affiche les vecteurs de tension des lignes aux points d'attache
   */
  private displayLineTensions(debugComp: DebugComponent, context: SimulationContext, kiteEntity: any): void {
    const { entityManager } = context;
    const scale = DebugConfig.FORCE_VECTOR_SCALE;

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
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > DebugConfig.FORCE_THRESHOLD) {
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
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > DebugConfig.FORCE_THRESHOLD) {
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
  private displayGripForces(debugComp: DebugComponent, context: SimulationContext): void {
    const { entityManager } = context;
    const scale = DebugConfig.FORCE_VECTOR_SCALE;

    const leftLine = entityManager.getEntity('leftLine');
    const rightLine = entityManager.getEntity('rightLine');
    const controlBar = entityManager.getEntity('controlBar');

    if (!controlBar) return;

    const barGeometry = controlBar.getComponent('geometry') as GeometryComponent | null;
    if (!barGeometry) return;

    // Force sur le poignet gauche
    if (leftLine) {
      const lineComp = leftLine.getComponent('line') as LineComponent | null;
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > DebugConfig.FORCE_THRESHOLD) {
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
      if (lineComp && lineComp.state.isTaut && lineComp.currentTension > DebugConfig.FORCE_THRESHOLD) {
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
   * Affiche le vecteur du vent ambiant au point NEZ (nez) du kite
   * Couleur : blanc pour une bonne visibilité
   */
  private displayWindVector(debugComp: DebugComponent, context: SimulationContext, kiteEntity: Entity): void {
    const windCache = context.windCache as Map<string, any> | undefined;
    if (!windCache) return;

    const wind = windCache.get(kiteEntity.id);
    if (!wind || !wind.ambient) return;

    // Récupérer la géométrie du kite pour accéder au point NEZ
    const geometry = kiteEntity.getComponent('geometry') as GeometryComponent | null;
    if (!geometry) return;

    // Obtenir la position du point NEZ en coordonnées du monde
    const nezWorldPosition = geometry.getPointWorld('NEZ', kiteEntity);
    if (!nezWorldPosition) return;

    // Afficher le vecteur du vent ambiant avec l'échelle de Config
    if (wind.ambient.length() > DebugConfig.FORCE_THRESHOLD) {
      debugComp.addForceArrow(
        nezWorldPosition.clone(),
        wind.ambient.clone().multiplyScalar(DebugConfig.WIND_VECTOR_SCALE),
        0xffffff, // Blanc
        'wind-vector-nez'
      );
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
      // Nettoyer toutes les flèches
      debugComp.clearArrows();

      // Retirer le groupe de la scène
      if (debugComp.debugGroup.parent) {
        this.renderSystem.scene.remove(debugComp.debugGroup);
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
