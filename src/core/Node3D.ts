
/**
 * Node3D.ts - Couche d'abstraction Godot-compatible pour la simulation Kite
 *
 * Rôle :
 *   - Encapsule THREE.Group avec une API similaire à Godot
 *   - Fournit des propriétés et méthodes compatibles avec le moteur Godot
 *   - Sert de base à StructuredObject et à tous les objets 3D du projet
 *
 * Dépendances principales :
 *   - Three.js : Pour la gestion des groupes et transformations 3D
 *
 * Relation avec les fichiers adjacents :
 *   - StructuredObject.ts (dossier core) hérite de Node3D
 *   - Tous les objets 3D du projet héritent indirectement de Node3D
 *
 * Utilisation typique :
 *   - Sert de base à la hiérarchie d'objets 3D
 *   - Permet la compatibilité avec Godot pour la portabilité
 *
 * Voir aussi :
 *   - src/core/StructuredObject.ts
 */

import * as THREE from 'three';
import { SceneManager } from './SceneManager';

/**
 * Transform3D compatible Godot
 */
export interface Transform3D {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
}

/**
 * Signal basique pour la communication entre nodes
 */
export interface Signal {
    name: string;
    callbacks: Array<{ target: Node3D; method: string }>;
}

/**
 * Node3D - Équivalent du Node3D de Godot
 * Hérite de THREE.Group pour la compatibilité
 */
export class Node3D extends THREE.Group {
    // 🎮 Propriétés Godot-like
    public transform: Transform3D;
    public signals: Map<string, Signal> = new Map();
    
    // 🏷️ Métadonnées
    public readonly nodeId: string;
    public nodeType: string = 'Node3D';
    
    // 🔧 État interne
    protected isReady: boolean = false;
    protected active: boolean = true;

    constructor(name: string = 'Node3D') {
        super();
        this.name = name;
        this.nodeId = this.generateNodeId();

        // Transform3D unifié
        this.transform = {
            position: this.position,
            rotation: this.rotation,
            scale: this.scale
        };

        // Auto-enregistrement dans SceneManager
        SceneManager.getInstance().register(this);

        // Auto-initialisation
        this.callReady();
    }
    
    /**
     * Génère un ID unique pour le node (compatible Godot)
     */
    private generateNodeId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `node_${timestamp}_${random}`;
    }
    
    // === 🎮 Méthodes Cycle de Vie Godot ===
    
    /**
     * _ready() - Appelé une seule fois quand le node est ajouté à la scène
     */
    protected _ready(): void {
        // À overrider dans les classes dérivées
    }
    
    /**
     * _process() - Appelé à chaque frame
     */
    protected _process(delta: number): void {
        // À overrider dans les classes dérivées
    }
    
    /**
     * _physics_process() - Appelé à chaque frame physique
     */
    protected _physics_process(delta: number): void {
        // À overrider dans les classes dérivées
    }
    
    /**
     * Appel automatique de _ready()
     */
    private callReady(): void {
        if (!this.isReady) {
            this.isReady = true;
            this._ready();
        }
    }
    
    // === 🔗 Gestion des Signaux ===
    
    /**
     * Définit un signal (équivalent signal en GDScript)
     */
    public define_signal(name: string): void {
        if (!this.signals.has(name)) {
            this.signals.set(name, {
                name,
                callbacks: []
            });
        }
    }
    
    /**
     * Émet un signal
     */
    public emit_signal(name: string, ...args: any[]): void {
        const signal = this.signals.get(name);
        if (signal) {
            signal.callbacks.forEach(callback => {
                const method = (callback.target as any)[callback.method];
                if (typeof method === 'function') {
                    method.call(callback.target, ...args);
                }
            });
        }
    }
    
    /**
     * Connecte un signal à une méthode
     */
    public connect(signal: string, target: Node3D, method: string): void {
        if (!this.signals.has(signal)) {
            this.define_signal(signal);
        }
        
        const signalObj = this.signals.get(signal)!;
        signalObj.callbacks.push({ target, method });
    }
    
    // === 🌳 Gestion de l'Arbre de Nodes ===
    
    /**
     * Ajoute un enfant (compatible Godot)
     */
    public add_child(child: Node3D): void {
        this.add(child);
        child.callReady();
    }
    
    /**
     * Retire un enfant
     */
    public remove_child(child: Node3D): void {
        this.remove(child);
    }
    
    /**
     * Trouve un enfant par nom
     */
    public get_node(path: string): Node3D | null {
        return this.getObjectByName(path) as Node3D || null;
    }
    
    /**
     * Trouve tous les enfants d'un type donné
     */
    public get_children_of_type<T extends Node3D>(type: new (...args: any[]) => T): T[] {
        const result: T[] = [];
        this.traverse((obj) => {
            if (obj instanceof type) {
                result.push(obj);
            }
        });
        return result;
    }
    
    // === 🔄 Mise à Jour du Cycle de Vie ===
    
    /**
     * Met à jour le node et tous ses enfants
     */
    public update(delta: number): void {
        if (this.isReady) {
            this._process(delta);
            this._physics_process(delta);
            
            // Mettre à jour les enfants Node3D
            this.children.forEach(child => {
                if (child instanceof Node3D) {
                    child.update(delta);
                }
            });
        }
    }
    
    /**
     * Active/désactive le node
     */
    public setActive(active: boolean): void {
        this.active = active;
    }

    /**
     * Vérifie si le node est actif
     */
    public isActive(): boolean {
        return this.active;
    }

    /**
     * Obtient le nom du node
     */
    public getName(): string {
        return this.name;
    }

    /**
     * Appelé quand le node est enregistré dans SceneManager
     */
    public onRegister(): void {
        // À overrider dans les sous-classes
    }

    /**
     * Appelé quand le node est désenregistré de SceneManager
     */
    public onUnregister(): void {
        // À overrider dans les sous-classes
    }

    /**
     * Détruit le node et nettoie les ressources
     */
    public destroy(): void {
        // Désenregistrer du SceneManager
        SceneManager.getInstance().unregister(this);

        // Nettoyer les signaux
        this.signals.clear();

        // Nettoyer les enfants
        this.children.forEach(child => {
            if (child instanceof Node3D) {
                child.destroy();
            }
        });

        // Nettoyer Three.js
        this.clear();
    }
    
    // === 🏷️ Métadonnées et Debug ===
    
    /**
     * Retourne une description du node
     */
    public get_description(): string {
        return `${this.nodeType}:${this.name} (${this.nodeId})`;
    }
    
    /**
     * Affiche l'arbre des nodes (debug)
     */
    public print_tree(indent: number = 0): void {
        const spaces = '  '.repeat(indent);
        console.log(`${spaces}${this.get_description()}`);
        
        this.children.forEach(child => {
            if (child instanceof Node3D) {
                child.print_tree(indent + 1);
            }
        });
    }
    
    // === 🎯 Compatibilité Three.js ===
    
    /**
     * Accès direct au transform Three.js
     */
    public get three_transform() {
        return {
            position: this.position,
            rotation: this.rotation,
            scale: this.scale,
            matrix: this.matrix,
            matrixWorld: this.matrixWorld
        };
    }
}
