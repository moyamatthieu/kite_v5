import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';

export class SystemManager {
  private systems: any[] = [];

  addSystem(system: any): void {
    this.systems.push(system);
  }

  async initializeAll(): Promise<void> {
    for (const system of this.systems) {
      if (system.initialize && typeof system.initialize === 'function') {
        await system.initialize();
      }
    }
  }

  updateAll(context: SimulationContext): void {
    this.systems.forEach((system) => {
      if (system.update && typeof system.update === 'function') {
        system.update(context);
      }
    });
  }

  resetAll(): void {
    this.systems.forEach((system) => {
      if (system.reset && typeof system.reset === 'function') {
        system.reset();
      }
    });
  }

  disposeAll(): void {
    this.systems.forEach((system) => {
      if (system.dispose && typeof system.dispose === 'function') {
        system.dispose();
      }
    });
  }

  getSystems(): any[] {
    return [...this.systems];
  }
}