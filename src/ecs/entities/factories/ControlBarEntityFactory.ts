import * as THREE from 'three';
import { Entity } from '@base/Entity';
import { TransformComponent } from '@components/TransformComponent';
import { GeometryComponent } from '@components/GeometryComponent';
import { VisualComponent } from '@components/VisualComponent';
import { CONFIG } from '@config/SimulationConfig';

export class ControlBarEntityFactory {
  static create(): Entity {
    const controlBarEntity = new Entity('controlBar');

    // Calculer la position relative au pilote
    const controlBarPosition = new THREE.Vector3(
      CONFIG.pilot.position.x,
      CONFIG.pilot.position.y + CONFIG.controlBar.offsetY,
      CONFIG.pilot.position.z + CONFIG.controlBar.offsetZ
    );

    // Composant Transform
    controlBarEntity.addComponent(new TransformComponent({ position: controlBarPosition }));

    // Composant Geometry
    const geometry = new GeometryComponent();
    const barLength = CONFIG.controlBar.handleLength * 2; // Longueur totale
    const barRadius = CONFIG.controlBar.barRadius;

    geometry.setPoint('LEFT_HANDLE', new THREE.Vector3(-barLength / 2, 0, 0));
    geometry.setPoint('CENTER', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('RIGHT_HANDLE', new THREE.Vector3(barLength / 2, 0, 0));
    geometry.addConnection('LEFT_HANDLE', 'CENTER');
    geometry.addConnection('CENTER', 'RIGHT_HANDLE');

    controlBarEntity.addComponent(geometry);

    // Composant Visual
    const visual = new VisualComponent();
    visual.frameMaterial = {
      color: '#8B4513', // Marron pour la barre
      diameter: barRadius * 2
    };
    controlBarEntity.addComponent(visual);

    return controlBarEntity;
  }
}