/**
 * RenderSystem.ts - Affichage Three.js (scene + camera + renderer)
 * 
 * Synchronise la scène Three.js avec les MeshComponent et rend la frame.
 * Priorité 70 (dernier système visuel).
 */

import * as THREE from 'three';

import { System, SimulationContext } from '../core/System';
import { EntityManager } from '../core/EntityManager';
import { TransformComponent } from '../components/TransformComponent';
import { MeshComponent } from '../components/MeshComponent';
import { RenderConfig } from '../config/Config';

export class RenderSystem extends System {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  private readonly addedMeshes = new Set<string>();
  
  constructor(canvas?: HTMLCanvasElement) {
    super('RenderSystem', 70);
    
    // Créer scène
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Bleu ciel
    
    // Créer caméra
    // Position pour voir : pilote(0,0,0), barre(0,1,-0.6), kite(0,11,-15.6)
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Position trouvée manuellement pour voir pilote ET kite ensemble
    this.camera.position.set(RenderConfig.CAMERA_POSITION_X, RenderConfig.CAMERA_POSITION_Y, RenderConfig.CAMERA_POSITION_Z);
    this.camera.lookAt(RenderConfig.CAMERA_LOOKAT_X, RenderConfig.CAMERA_LOOKAT_Y, RenderConfig.CAMERA_LOOKAT_Z);
    
    // Créer renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Lumière
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(10, 10, 10);
    this.scene.add(directionalLight);
    
    // Resize handler
    window.addEventListener('resize', () => this.onResize());
  }
  
  initialize(_entityManager: EntityManager): void {
    // Rien à faire, la scène est déjà créée
  }
  
  update(context: SimulationContext): void {
    const { entityManager } = context;
    
    // Pour toutes les entités avec mesh + transform
    const entities = entityManager.query(['transform', 'mesh']);
    
    entities.forEach(entity => {
      const transform = entity.getComponent<TransformComponent>('transform')!;
      const mesh = entity.getComponent<MeshComponent>('mesh')!;
      
      // Ajouter à la scène si pas encore fait (tracker par UUID du mesh)
      if (!this.addedMeshes.has(mesh.object3D.uuid)) {
        this.scene.add(mesh.object3D);
        this.addedMeshes.add(mesh.object3D.uuid);
      }

      // Synchroniser transform
      mesh.object3D.position.copy(transform.position);
      mesh.object3D.quaternion.copy(transform.quaternion);
      mesh.object3D.scale.copy(transform.scale);
    });
    
    // Rendre la frame
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose(): void {
    this.renderer.dispose();
    this.addedMeshes.clear();
  }

  /**
   * Réinitialise l'état du rendu (appelé lors d'un reset)
   * Nettoie UNIQUEMENT les meshes des entités (kite, lignes, etc)
   * Garde l'environnement (sol, ciel, éclairage)
   */
  resetRenderState(): void {
    // On ne supprime que les meshes correspondant aux IDs des entités ECS
    // Les objets de l'environnement ne sont pas dans addedMeshes
    const meshesToRemove: THREE.Object3D[] = [];
    
    // Parcourir la scène et supprimer UNIQUEMENT les meshes qui correspondent aux IDs des entités
    this.scene.traverse(obj => {
      // Vérifier si cet objet correspond à une entité connue
      if (this.addedMeshes.has(obj.uuid)) {
        meshesToRemove.push(obj);
      }
    });
    
    meshesToRemove.forEach(mesh => {
      // Disposer les géométries et matériaux
      if (mesh instanceof THREE.Mesh) {
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => mat.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
      this.scene.remove(mesh);
    });
    
    // Nettoyer le Set de tracking
    this.addedMeshes.clear();
  }
  
  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  /**
   * Accès au canvas (pour l'attacher au DOM)
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
