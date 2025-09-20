/**
 * SimulationAppInitializer.ts - Gestionnaire d'initialisation de la scène
 *
 * Responsable de la création et configuration initiale des objets de la simulation.
 */

import * as THREE from "three";
import { Kite } from "../objects/organic/Kite";
import { PhysicsEngine } from "../physics/PhysicsEngine";
import { RenderManager } from "../rendering/RenderManager";
import { InputHandler } from "../input/InputHandler";
import { CONFIG } from "../config/GlobalConfig";
import { INPUT_CONFIG } from "../config/InputConfig";
import type { WindParams } from "../types/wind";
import { SimulationUI } from "../ui/SimulationUI";
import { SimulationApp } from "./SimulationApp"; // Import pour type

export class SimulationAppInitializer {
  private app: SimulationApp;
  private renderManager: RenderManager;
  private inputHandler: InputHandler;
  private container: HTMLElement;

  constructor(
    app: SimulationApp,
    renderManager: RenderManager,
    inputHandler: InputHandler,
    container: HTMLElement
  ) {
    this.app = app;
    this.renderManager = renderManager;
    this.inputHandler = inputHandler;
    this.container = container;
  }

  initializeScene(): void {
    // 🪁 CRÉATION DU CERF-VOLANT
    console.log("🪁 Création du cerf-volant...");
    this.app.kite = new Kite(); // Fabrique un nouveau cerf-volant selon le design
    this.app.kite.position.set(0, 7, -5); // Le place dans le ciel (7m de haut, 5m vers l'avant)
    this.app.kite.userData.area = CONFIG.kite.area; // Définit sa surface (pour calculer les forces du vent)
    this.app.kite.rotation.x = Math.PI / 9; // 20° d'angle d'attaque initial pour portance
    console.log(
      `📍 Position initiale du kite: ${this.app.kite.position
        .toArray()
        .join(",")}`
    );

    // 🎨 Ajout du kite dans la scène 3D pour qu'on le voie
    this.renderManager.addObject(this.app.kite);

    // 🎮 CRÉATION DE LA BARRE DE CONTRÔLE ET DU PILOTE
    console.log("🎮 Création de la barre de contrôle et du pilote...");
    this.createControlBar(); // Crée la barre que le pilote tient + le pilote lui-même

    // ⚡ DÉMARRAGE DU MOTEUR PHYSIQUE - Le "cerveau" qui calcule tout
    console.log("⚡ Initialisation du moteur physique...");
    const controlBarPosition = new THREE.Vector3(...CONFIG.controlBar.position);
    this.app.physicsEngine = new PhysicsEngine(
      [this.app.kite],
      controlBarPosition
    );

    // 🌬️ CONFIGURATION DU VENT - Comme régler la météo virtuelle
    console.log("🌬️ Configuration du vent initial...");
    this.app.physicsEngine.setWindParams({
      speed: CONFIG.wind.defaultSpeed, // Vitesse du vent (km/h)
      direction: CONFIG.wind.defaultDirection, // D'où vient le vent (degrés)
      turbulence: CONFIG.wind.defaultTurbulence, // Intensité des rafales (%)
    } as WindParams);

    // 🔗 CRÉATION DES LIGNES VISUELLES - Les "cordes" qu'on voit entre kite et pilote
    console.log("🔗 Création des lignes de contrôle...");
    this.createLines();

    // 🎛️ CONFIGURATION DES CONTRÔLES - Connecte les boutons et le clavier
    console.log("🎛️ Configuration des contrôles...");
    // Les contrôles sont gérés par SimulationAppControls

    // Initialiser l'interface utilisateur (UI)
    this.app.simulationUI = new SimulationUI(this.container);

    // IMPORTANT: Connecter la référence à SimulationApp pour que les sliders fonctionnent
    this.app.simulationUI.setAppReference(this.app);

    console.log("✅ Scène initialisée avec succès !");
  }

  private createControlBar(): void {
    this.app.controlBar = new THREE.Group();

    // Barre principale (60cm de large)
    const barGeometry = new THREE.BoxGeometry(0.6, 0.03, 0.03);
    const barMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const barMesh = new THREE.Mesh(barGeometry, barMaterial);
    this.app.controlBar.add(barMesh);

    // Poignées aux extrémités (30cm de chaque côté)
    const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.1);
    const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });

    const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    leftHandle.position.set(-0.3, 0, 0); // À l'extrémité gauche
    leftHandle.rotation.z = Math.PI / 2;
    this.app.controlBar.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    rightHandle.position.set(0.3, 0, 0); // À l'extrémité droite
    rightHandle.rotation.z = Math.PI / 2;
    this.app.controlBar.add(rightHandle);

    this.app.controlBar.position.set(...CONFIG.controlBar.position);
    this.renderManager.addObject(this.app.controlBar);

    // Ajout du pilote
    this.createPilot();
  }

  private createPilot(): void {
    const pilotGeometry = new THREE.BoxGeometry(0.4, 1.6, 0.3);
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c5aa0,
      roughness: 0.8,
    });
    const pilot = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilot.position.set(0, 0.8, 8.5);
    pilot.castShadow = true;

    this.renderManager.addObject(pilot);
  }

  private createLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });

    // Ligne gauche
    const leftGeometry = new THREE.BufferGeometry();
    this.app.leftLine = new THREE.Line(leftGeometry, lineMaterial);
    this.renderManager.addObject(this.app.leftLine);

    // Ligne droite
    const rightGeometry = new THREE.BufferGeometry();
    this.app.rightLine = new THREE.Line(rightGeometry, lineMaterial);
    this.renderManager.addObject(this.app.rightLine);
  }
}
