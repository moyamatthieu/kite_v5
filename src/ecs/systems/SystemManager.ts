import { BaseSimulationSystem, SimulationContext } from '@base/BaseSimulationSystem';

export class SystemManager {
  private systems: BaseSimulationSystem[] = [];

  addSystem(system: BaseSimulationSystem): void {
    this.systems.push(system);
    // Sort systems by order
    this.systems.sort((a, b) => (a.order || 0) - (b.order || 0));
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

  getSystems(): BaseSimulationSystem[] {
    return [...this.systems];
  }

  getSystem<T extends BaseSimulationSystem>(type: new (...args: any[]) => T): T | undefined {
    return this.systems.find(system => system instanceof type) as T;
  }
}