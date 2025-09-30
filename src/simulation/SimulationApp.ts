/**
 * SimulationApp.ts - Application principale de simulation
 *
 * Point d'entrée refactorisé qui assemble tous les composants modulaires
 */

import * as THREE from "three";
import { Kite } from "../objects/organic/Kite";
import { RenderManager } from "./rendering/RenderManager";
import { DebugRenderer } from "./rendering/DebugRenderer";
import { PhysicsEngine } from "./physics/PhysicsEngine";
import { InputHandler } from "./controllers/InputHandler";
import { UIManager } from "./ui/UIManager";
import { CONFIG } from "./config/SimulationConfig";

export class Simulation {
  private renderManager: RenderManager;
  private debugRenderer: DebugRenderer;
  private physicsEngine!: PhysicsEngine;
  private inputHandler: InputHandler;
  private uiManager!: UIManager;
  private kite!: Kite;
  private controlBar!: THREE.Group;
  private clock: THREE.Clock;
  private isPlaying: boolean = true;
  private leftLine: THREE.Line | null = null;
  private rightLine: THREE.Line | null = null;
  private frameCount: number = 0;

  constructor() {
    console.log("🚀 Démarrage de la Simulation V8 - Version modulaire");

    try {
      const container = document.getElementById("app");
      if (!container) {
        throw new Error("Container #app non trouvé");
      }

      this.renderManager = new RenderManager(container);
      this.debugRenderer = new DebugRenderer(this.renderManager);
      this.inputHandler = new InputHandler();
      this.clock = new THREE.Clock();

      this.setupControlBar();
      this.setupKite();
      this.physicsEngine = new PhysicsEngine(
        this.kite,
        this.controlBar.position
      );
      this.setupUI();
      this.createControlLines();
      this.animate();
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'initialisation de la Simulation:",
        error
      );
      throw error;
    }
  }

  private setupKite(): void {
    this.kite = new Kite();
    const pilot = this.controlBar.position.clone();
    const initialDistance = CONFIG.lines.defaultLength * 0.95;

    const kiteY = 7;
    const dy = kiteY - pilot.y;
    const horizontal = Math.max(
      0.1,
      Math.sqrt(Math.max(0, initialDistance * initialDistance - dy * dy))
    );

    this.kite.position.set(pilot.x, kiteY, pilot.z - horizontal);
    this.kite.rotation.set(0, 0, 0);
    this.kite.quaternion.identity();

    console.log(
      `📍 Position initiale du kite: ${this.kite.position.toArray()}`
    );
    this.renderManager.addObject(this.kite);
  }

  private setupControlBar(): void {
    this.controlBar = new THREE.Group();
    this.controlBar.position.copy(CONFIG.controlBar.position);

    const barGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      CONFIG.controlBar.width
    );
    const barMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bar = new THREE.Mesh(barGeometry, barMaterial);
    bar.rotation.z = Math.PI / 2;
    this.controlBar.add(bar);

    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.6,
    });

    const halfWidth = CONFIG.controlBar.width / 2;
    const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    leftHandle.position.set(-halfWidth, 0, 0);
    this.controlBar.add(leftHandle);

    const rightHandle = new THREE.Mesh(handleGeometry, handleMaterial);
    rightHandle.position.set(halfWidth, 0, 0);
    this.controlBar.add(rightHandle);

    const pilotGeometry = new THREE.BoxGeometry(0.4, 1.6, 0.3);
    const pilotMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.8,
    });
    const pilot = new THREE.Mesh(pilotGeometry, pilotMaterial);
    pilot.position.set(0, 0.8, 8.5);
    pilot.castShadow = true;

    this.renderManager.addObject(this.controlBar);
    this.renderManager.addObject(pilot);
  }

  private createControlLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x333333,
      linewidth: 2,
    });

    const leftGeometry = new THREE.BufferGeometry();
    const rightGeometry = new THREE.BufferGeometry();

    this.leftLine = new THREE.Line(leftGeometry, lineMaterial);
    this.rightLine = new THREE.Line(rightGeometry, lineMaterial);

    this.renderManager.addObject(this.leftLine);
    this.renderManager.addObject(this.rightLine);
  }

  private updateControlLines(): void {
    if (!this.leftLine || !this.rightLine) return;

    const ctrlLeft = this.kite.getPoint("CTRL_GAUCHE");
    const ctrlRight = this.kite.getPoint("CTRL_DROIT");

    if (!ctrlLeft || !ctrlRight) return;

    const kiteLeftWorld = ctrlLeft.clone();
    const kiteRightWorld = ctrlRight.clone();
    this.kite.localToWorld(kiteLeftWorld);
    this.kite.localToWorld(kiteRightWorld);

    const handles = this.physicsEngine
      .getControlBarManager()
      .getHandlePositions(this.kite.position);

    const leftPoints = this.physicsEngine
      .getLineSystem()
      .calculateCatenary(handles.left, kiteLeftWorld);
    const rightPoints = this.physicsEngine
      .getLineSystem()
      .calculateCatenary(handles.right, kiteRightWorld);

    this.leftLine.geometry.setFromPoints(leftPoints);
    this.rightLine.geometry.setFromPoints(rightPoints);

    this.physicsEngine
      .getControlBarManager()
      .updateVisual(this.controlBar, this.kite);
  }

  private setupUI(): void {
    this.uiManager = new UIManager(
      this.physicsEngine,
      this.debugRenderer,
      () => this.resetSimulation(),
      () => this.togglePlayPause()
    );
  }

  private resetSimulation(): void {
    const currentLineLength =
      this.physicsEngine.getLineSystem().lineLength ||
      CONFIG.lines.defaultLength;
    const initialDistance = currentLineLength * 0.95;

    const pilot = this.controlBar.position.clone();
    const kiteY = 7;
    const dy = kiteY - pilot.y;
    const horizontal = Math.max(
      0.1,
      Math.sqrt(Math.max(0, initialDistance * initialDistance - dy * dy))
    );
    this.kite.position.set(pilot.x, kiteY, pilot.z - horizontal);

    this.kite.rotation.set(0, 0, 0);
    this.kite.quaternion.identity();
    this.controlBar.quaternion.identity();

    this.physicsEngine = new PhysicsEngine(this.kite, this.controlBar.position);
    this.physicsEngine.setLineLength(currentLineLength);

    this.updateControlLines();
    console.log(`🔄 Simulation réinitialisée`);
  }

  private togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    this.uiManager.updatePlayButton(this.isPlaying);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    this.frameCount++;

    if (this.isPlaying) {
      try {
        const deltaTime = this.clock.getDelta();
        this.inputHandler.update(deltaTime);
        const targetRotation = this.inputHandler.getTargetBarRotation();

        this.physicsEngine.update(deltaTime, targetRotation, false);
        this.updateControlLines();
        this.debugRenderer.updateDebugArrows(this.kite, this.physicsEngine);
      } catch (error) {
        console.error("❌ Erreur dans la boucle d'animation:", error);
        this.isPlaying = false;
      }
    }

    this.renderManager.render();
  };

  public cleanup(): void {
    console.log("🧹 Nettoyage de la Simulation...");
    this.isPlaying = false;

    this.debugRenderer.clearDebugArrows();

    if (this.leftLine) {
      this.renderManager.removeObject(this.leftLine);
      this.leftLine = null;
    }
    if (this.rightLine) {
      this.renderManager.removeObject(this.rightLine);
      this.rightLine = null;
    }

    if (this.kite) {
      this.renderManager.removeObject(this.kite);
    }

    if (this.controlBar) {
      this.renderManager.removeObject(this.controlBar);
    }

    console.log("✅ Simulation nettoyée");
  }
}