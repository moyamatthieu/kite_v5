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
    
    // Utiliser la LARGEUR de la barre (0.6m) pour positionner les poignées
    // Les poignées sont aux extrémités de la barre
    const halfWidth = CONFIG.controlBar.width / 2;
    const handleLength = CONFIG.controlBar.handleLength;

    // Points de la barre principale
    geometry.setPoint('LEFT_HANDLE', new THREE.Vector3(-halfWidth, 0, 0));
    geometry.setPoint('CENTER', new THREE.Vector3(0, 0, 0));
    geometry.setPoint('RIGHT_HANDLE', new THREE.Vector3(halfWidth, 0, 0));
    
    // Points pour les poignées verticales (cylindres qui descendent)
    geometry.setPoint('LEFT_HANDLE_TOP', new THREE.Vector3(-halfWidth, handleLength / 2, 0));
    geometry.setPoint('LEFT_HANDLE_BOTTOM', new THREE.Vector3(-halfWidth, -handleLength / 2, 0));
    geometry.setPoint('RIGHT_HANDLE_TOP', new THREE.Vector3(halfWidth, handleLength / 2, 0));
    geometry.setPoint('RIGHT_HANDLE_BOTTOM', new THREE.Vector3(halfWidth, -handleLength / 2, 0));
    
    // Connexions pour la barre principale (horizontale)
    geometry.addConnection('LEFT_HANDLE', 'CENTER');
    geometry.addConnection('CENTER', 'RIGHT_HANDLE');
    
    // Connexions pour les poignées (verticales)
    geometry.addConnection('LEFT_HANDLE_TOP', 'LEFT_HANDLE_BOTTOM');
    geometry.addConnection('RIGHT_HANDLE_TOP', 'RIGHT_HANDLE_BOTTOM');

    controlBarEntity.addComponent(geometry);

    // Composant Visual
    const visual = new VisualComponent();
    
    // Matériau pour la barre principale (gris, diamètre 3cm)
    visual.frameMaterial = {
      color: '#333333', // Gris foncé pour la barre
      diameter: CONFIG.controlBar.barRadius * 2
    };
    
    // Matériau pour les poignées (marron, diamètre 5cm pour être plus visible)
    visual.whiskerMaterial = {
      color: '#8B4513', // Marron pour les poignées
      diameter: CONFIG.controlBar.handleRadius * 2
    };
    
    controlBarEntity.addComponent(visual);

    return controlBarEntity;
  }
}