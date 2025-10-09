/**
 * SceneManager.ts - Gestionnaire central de la scène 3D
 *
 * Rôle : Orchestrateur principal de tous les objets 3D
 * Gère le cycle de vie, les updates et la hiérarchie des Node3D
 */

import { Node3D } from './Node3D';
import * as THREE from 'three';

export class SceneManager {
  private static instance: SceneManager;
  private nodes: Set<Node3D> = new Set();
  private rootScene: THREE.Scene;
  private totalTime: number = 0;

  private constructor() {
    this.rootScene = new THREE.Scene();
  }

  static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  /**
   * Enregistre un nouveau nœud dans la scène
   */
  register(node: Node3D): void {
    if (!this.nodes.has(node)) {
      this.nodes.add(node);
      node.onRegister();
    }
  }

  /**
   * Désenregistre un nœud de la scène
   */
  unregister(node: Node3D): void {
    if (this.nodes.has(node)) {
      node.onUnregister();
      this.nodes.delete(node);
    }
  }

  /**
   * Met à jour tous les nœuds enregistrés
   */
  update(deltaTime: number): void {
    this.totalTime += deltaTime;

    const context = {
      deltaTime,
      totalTime: this.totalTime,
      isPaused: false,
      debugMode: false
    };

    // Mise à jour de tous les nœuds
    for (const node of this.nodes) {
      if (node.isActive()) {
        node.update(deltaTime);
      }
    }
  }

  /**
   * Ajoute un objet à la scène Three.js racine
   */
  addToScene(object: THREE.Object3D): void {
    this.rootScene.add(object);
  }

  /**
   * Retire un objet de la scène Three.js racine
   */
  removeFromScene(object: THREE.Object3D): void {
    this.rootScene.remove(object);
  }

  /**
   * Obtient la scène Three.js racine
   */
  getScene(): THREE.Scene {
    return this.rootScene;
  }

  /**
   * Recherche un nœud par nom
   */
  findNodeByName(name: string): Node3D | undefined {
    for (const node of this.nodes) {
      if (node.getName() === name) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Obtient tous les nœuds d'un certain type
   */
  getNodesOfType<T extends Node3D>(type: new (...args: any[]) => T): T[] {
    const result: T[] = [];
    for (const node of this.nodes) {
      if (node instanceof type) {
        result.push(node as T);
      }
    }
    return result;
  }

  /**
   * Nettoie tous les nœuds
   */
  clear(): void {
    for (const node of this.nodes) {
      node.destroy();
    }
    this.nodes.clear();
    this.rootScene.clear();
    this.totalTime = 0;
  }

  /**
   * Statistiques de la scène
   */
  getStats(): { nodeCount: number; totalTime: number } {
    return {
      nodeCount: this.nodes.size,
      totalTime: this.totalTime
    };
  }
}