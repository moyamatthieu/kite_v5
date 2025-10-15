/**
 * LineEntity.ts - Entité ECS pour les lignes de contrôle
 *
 * Représente une ligne de contrôle (gauche ou droite) dans la simulation ECS.
 * Contient les composants Transform et Mesh pour le rendu 3D.
 */

import * as THREE from 'three';
import { CONFIG } from '@config/SimulationConfig';
import { Entity } from '@base/Entity';

import { TransformComponent } from '@components/TransformComponent';
import { MeshComponent } from '@components/MeshComponent';


export type LineSide = 'left' | 'right';

export class LineEntity extends Entity {
  public readonly side: LineSide;

  constructor(side: LineSide) {
    super(`${side}Line`);
    this.side = side;

    // Créer la géométrie de ligne (utiliser des tubes pour une meilleure visibilité)
    const segments = 20;
    const points = new Array(segments + 1).fill(0).map(() => new THREE.Vector3());
    const curve = new THREE.CatmullRomCurve3(points);

    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000, // Rouge vif pour debug (sera coloré par les tensions ensuite)
      roughness: 0.7,
      metalness: 0.2,
      emissive: 0x440000, // Émission rouge pour meilleure visibilité
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide, // Visible des deux côtés
      transparent: false,
      opacity: 1.0
    });

      const tubeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segments, CONFIG.defaults.tubeRadius, CONFIG.defaults.tubeRadialSegments, false),
        tubeMaterial
      );
    tubeMesh.name = `${side === 'left' ? 'Left' : 'Right'}ControlLine`;
    tubeMesh.castShadow = false;
    tubeMesh.receiveShadow = false;

    // Ajouter le composant Transform (position initiale à l'origine)
    const transform = new TransformComponent({
      position: new THREE.Vector3(),
      rotation: 0,
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1)
    });
    this.addComponent(transform);

    // Ajouter le composant Mesh
    const mesh = new MeshComponent(tubeMesh, {
      visible: true,
      castShadow: false,
      receiveShadow: false
    });
    this.addComponent(mesh);
  }

  /**
   * Met à jour la géométrie de la ligne entre deux points
   */
  updateGeometry(start: THREE.Vector3, end: THREE.Vector3): void {
    const mesh = this.getComponent<MeshComponent>('mesh');
    if (!mesh) return;

    const tubeMesh = mesh.object3D as THREE.Mesh;

    // Créer une nouvelle courbe pour le tube
    const segments = 20;
    const points: THREE.Vector3[] = [];

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

      points.push(new THREE.Vector3(x, y + curvature, z));
    }

    // Créer une nouvelle courbe et géométrie de tube
    const curve = new THREE.CatmullRomCurve3(points);
    const newTubeGeometry = new THREE.TubeGeometry(
      curve, 
      segments, 
      CONFIG.defaults.tubeRadius, 
      CONFIG.defaults.tubeRadialSegments, 
      false
    );

    // Remplacer la géométrie
    tubeMesh.geometry.dispose();
    tubeMesh.geometry = newTubeGeometry;
  }

  /**
   * Obtient la géométrie de la ligne
   */
  getGeometry(): THREE.BufferGeometry | null {
    const mesh = this.getComponent<MeshComponent>('mesh');
    return mesh ? (mesh.object3D as THREE.Line).geometry as THREE.BufferGeometry : null;
  }
}