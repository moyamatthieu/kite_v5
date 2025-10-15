import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { MeshComponent } from '@components/MeshComponent';
import { CONFIG } from '@config/SimulationConfig';
import * as THREE from 'three';

export class PilotEntityFactory {
  static create(): Entity {
    const pilotEntity = new Entity('pilot');
    const pilotGeometry = new THREE.BoxGeometry(CONFIG.pilot.width, CONFIG.pilot.height, CONFIG.pilot.depth);
    const pilotMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8 });
    const pilotMesh = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilotMesh.name = 'Pilot';
    pilotMesh.castShadow = true;
    pilotEntity.addComponent(new TransformComponent({
      position: new THREE.Vector3(CONFIG.pilot.position.x, CONFIG.pilot.position.y, CONFIG.pilot.position.z),
      rotation: 0,
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    }));
    pilotEntity.addComponent(new MeshComponent(pilotMesh, {
      visible: true,
      castShadow: true,
      receiveShadow: false
    }));
    return pilotEntity;
  }
}
