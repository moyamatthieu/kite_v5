/**
 * ControlBarSystem.ts - [ARCHIVÉ]
 * 
 * Ce système est archivé et non utilisé. La gestion de la rotation de la barre
 * est assurée par PilotSystem (priorité 55) qui lit InputComponent.barRotationInput.
 * 
 * Historique :
 * - Était destiné à gérer la cinématique de la barre avant PilotSystem
 * - Remplacé par PilotSystem pour une meilleure architecture ECS
 * - Conservé à titre historique mais pas instancié dans SimulationApp.ts
 */

// import * as THREE from 'three';

// import { System, SimulationContext } from '../core/System';
// import { Entity } from '../core/Entity';
// import { InputComponent } from '../components/InputComponent';
// import { TransformComponent } from '../components/TransformComponent';
// import { PhysicsComponent } from '../components/PhysicsComponent';
// import { ControlConstants } from '../config/Config';
// import { Logger } from '../utils/Logging';

// export class ControlBarSystem extends System {
//   private logger = Logger.getInstance();

//   constructor() {
//     super('ControlBarSystem', 25);
//   }

//   update(context: SimulationContext): void {
//     const { entityManager, deltaTime } = context;

//     // 1. Récupérer les entrées utilisateur
//     const inputEntity = entityManager.query(['Input'])[0];
//     if (!inputEntity) return;
//     const inputComp = inputEntity.getComponent<InputComponent>('Input');
//     if (!inputComp) return;

//     // 2. Trouver la barre de contrôle
//     const controlBarEntity = entityManager.getEntity('controlBar');
//     if (!controlBarEntity) return;

//     const transform = controlBarEntity.getComponent<TransformComponent>('transform');
//     const physics = controlBarEntity.getComponent<PhysicsComponent>('physics');

//     if (!transform || !physics) return;

//     // 3. Appliquer la rotation basée sur l'input
//     // La barre est cinématique, donc nous modifions directement sa rotation.
//     if (inputComp.barRotationInput !== 0) {
//       // Calculer l'angle de rotation pour cette frame
//       const rotationAmount = inputComp.barRotationInput * ControlConstants.BAR_ROTATION_SPEED * deltaTime;
      
//       this.logger.debug(`ControlBar rotation: input=${inputComp.barRotationInput}, amount=${rotationAmount.toFixed(4)} rad`, 'ControlBarSystem');
      
//       // Créer un quaternion pour la rotation autour de l'axe Y (yaw)
//       const rotation = new THREE.Quaternion().setFromAxisAngle(
//         new THREE.Vector3(0, 1, 0), 
//         rotationAmount
//       );

//       // Appliquer la rotation au quaternion existant
//       transform.quaternion.multiplyQuaternions(rotation, transform.quaternion);
      
//       // Limiter la rotation totale pour éviter que la barre ne fasse des tours complets
//       const euler = new THREE.Euler().setFromQuaternion(transform.quaternion, 'YXZ');
//       euler.y = THREE.MathUtils.clamp(euler.y, -ControlConstants.MAX_BAR_ROTATION_ANGLE, ControlConstants.MAX_BAR_ROTATION_ANGLE);
//       transform.quaternion.setFromEuler(euler);
//     }
//   }
// }
