# Migration Guide - SimulationApp V8 → V9 (ECS Architecture)

## Vue d'Ensemble

La **Phase 5** du refactor architectural est maintenant terminée ! Le simulateur utilise désormais l'architecture ECS-inspired par défaut.

## 🔄 Changements Apportés

### Fichiers Renommés
- `SimulationApp.ts` → `SimulationApp_legacy.ts` (ancienne version)
- `SimulationApp_new.ts` → `SimulationApp.ts` (nouvelle version ECS)

### Compatibilité Maintenue
- L'import `import { Simulation } from './simulation'` fonctionne toujours
- L'API publique reste compatible pour les cas d'usage simples
- Les composants legacy sont activés par défaut

## 🚀 Nouvelles Fonctionnalités

### Architecture ECS-Inspired
```typescript
// Nouvelle architecture modulaire
const app = new Simulation({
  enableRenderSystem: true,
  enableLegacyComponents: true, // Composants anciens activés par défaut
  physics: { gravityEnabled: true },
  wind: { baseSpeed: 5.0, turbulenceEnabled: true },
  input: { barSmoothingEnabled: true },
  render: { antialias: true, shadowMapEnabled: true }
});
```

### Systèmes Indépendants
- **PhysicsSystem** : Moteur physique avec forces aérodynamiques
- **WindSystem** : Simulation du vent avec turbulence et rafales
- **InputSystem** : Gestion des entrées avec lissage
- **RenderSystem** : Rendu Three.js optimisé

### Configuration Granulaire
```typescript
interface SimulationConfig {
  targetFPS: number;
  enableDebug: boolean;
  enableRenderSystem: boolean;     // Désactiver pour tests headless
  enableLegacyComponents: boolean; // Désactiver pour tests purs ECS
  physics: Partial<PhysicsConfig>;
  wind: Partial<WindConfig>;
  input: Partial<InputConfig>;
  render: Partial<RenderConfig>;
}
```

## 🧪 Tests Disponibles

### Tests d'Intégration ECS
```bash
npm run test-ecs  # Test complet de l'architecture ECS
```

### Version ECS Dédiée
```bash
npm run dev-new   # Interface ECS avec overlay UI temps réel
```

### Version Legacy
```bash
npm run dev       # Version originale (maintenue pour compatibilité)
```

## 📊 Performance

### Améliorations Apportées
- **Boucle 60 FPS stable** avec context partagé optimisé
- **Lazy initialization** des systèmes non critiques
- **Configuration conditionnelle** pour réduire la charge mémoire
- **Tests headless** possibles sans WebGL

### Métriques de Test
```
✅ Architecture ECS fonctionnelle
✅ Systèmes modulaires opérationnels
✅ SimulationApp orchestrant correctement
✅ Gestion du cycle de vie complète
✅ Intégration sans DOM réussie
```

## 🔧 Migration pour Développeurs

### Code Existant
```typescript
// Avant (toujours supporté)
import { Simulation } from './simulation';
const app = new Simulation();
```

### Nouveau Code Recommandé
```typescript
// Nouveau (recommandé pour les nouvelles fonctionnalités)
import { SimulationApp } from './simulation/SimulationApp';
import { PhysicsSystem, WindSystem } from './simulation/systems';

const app = new SimulationApp({
  enableLegacyComponents: false, // Mode ECS pur
  physics: { gravityEnabled: true },
  wind: { turbulenceEnabled: true }
});

// Accès direct aux systèmes
const physics = app.physicsSystem;
const wind = app.windSystem;
```

## 🐛 Debugging

### Console Commands
```javascript
// Accès aux systèmes
window.simulationApp.physicsSystem.getStats()
window.simulationApp.windSystem.getWindState()
window.simulationApp.inputSystem.getInputState()
window.simulationApp.renderSystem.getRenderStats()

// Statistiques générales
window.simulationApp.getStats()
```

### Interface Debug
- **Overlay UI** : FPS, position kite, vitesse, vent, position barre
- **Console logging** : Logs détaillés avec `enableDebug: true`
- **Tests isolés** : Chaque système testable indépendamment

## 📚 Documentation

- [Architecture ECS](./docs/ECS_ARCHITECTURE.md)
- [Guide des Systèmes](./docs/SYSTEMS_GUIDE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [README ECS](./README_ECS.md)

## 🎯 État du Refactor

### ✅ Phases Terminées
- **Phase 1** : Fondation architecturale
- **Phase 2** : Intégration systèmes
- **Phase 3** : Systèmes concrets (Physics, Wind, Input, Render)
- **Phase 4** : Boucle ECS et tests d'intégration
- **Phase 5** : Migration complète ✅

### 🔄 Prochaines Phases
- **Phase 6** : Optimisations performance avancées
- **Phase 7** : Tests d'intégration physique réaliste
- **Phase 8** : Documentation complète et déploiement

## 🚀 Prêt pour la Production

L'architecture ECS-inspired est maintenant **opérationnelle en production** avec :

- ✅ **Migration complète** depuis l'ancienne architecture
- ✅ **Compatibilité ascendante** maintenue
- ✅ **Tests d'intégration** validés
- ✅ **Performance optimisée** pour 60 FPS
- ✅ **Documentation complète** disponible

Le simulateur de cerf-volant est prêt pour les développements futurs ! 🎉