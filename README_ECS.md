# Kite Simulator V9 - Architecture ECS-Inspired

## Vue d'Ensemble

Le simulateur de cerf-volant a été refactorisé avec une architecture moderne inspirée des systèmes ECS (Entity Component System). Cette nouvelle architecture offre une meilleure modularité, testabilité et performance.

## Architecture

### 🏗️ Structure Modulaire

```
src/
├── base/                    # Classes de base et abstractions
│   ├── BaseSimulationSystem.ts    # Interface pour tous les systèmes
│   └── ...
├── simulation/
│   ├── systems/             # Systèmes ECS
│   │   ├── PhysicsSystem.ts # Moteur physique
│   │   ├── WindSystem.ts    # Simulation du vent
│   │   ├── InputSystem.ts   # Gestion des entrées
│   │   └── RenderSystem.ts  # Rendu Three.js
│   ├── SimulationApp_new.ts # Application principale (nouvelle)
│   └── SimulationApp.ts     # Application principale (ancienne)
└── ...
```

### 🔄 Boucle de Simulation ECS

La nouvelle architecture utilise une boucle de simulation modulaire :

1. **InputSystem** : Capture les entrées utilisateur (priorité 1)
2. **WindSystem** : Calcule l'état du vent (priorité 5)
3. **PhysicsSystem** : Applique les lois physiques (priorité 10)
4. **RenderSystem** : Rend la scène (priorité 100)

Chaque système fonctionne indépendamment et communique via un contexte partagé.

## 🚀 Démarrage Rapide

### Version Classique (V8)
```bash
npm run dev
```
Ouvre `http://localhost:3001` avec l'ancienne architecture.

### Nouvelle Version (V9 - ECS)
```bash
npm run dev-new
```
Ouvre `http://localhost:3001` avec la nouvelle architecture ECS-inspired.

## 🎮 Contrôles

- **← →** : Contrôler la position de la barre
- **R** : Réinitialiser la simulation
- **D** : Afficher les informations de debug (console)

## 🔧 Configuration

La nouvelle `SimulationApp` accepte une configuration complète :

```typescript
const app = new SimulationApp({
  targetFPS: 60,
  enableDebug: true,
  physics: {
    gravityEnabled: true,
    airResistanceEnabled: true
  },
  wind: {
    baseSpeed: 5.0,
    turbulenceEnabled: true,
    gustsEnabled: true
  },
  input: {
    keyboardEnabled: true,
    barSmoothingEnabled: true
  },
  render: {
    antialias: true,
    shadowMapEnabled: true
  }
});
```

## 📊 Fonctionnalités

### PhysicsSystem
- Intégration numérique précise
- Forces gravitationnelles et aérodynamiques
- Gestion des collisions et contraintes
- Calcul de portance et traînée

### WindSystem
- Vent de base configurable
- Turbulence réaliste
- Rafales périodiques
- Cisaillement du vent (variation avec l'altitude)

### InputSystem
- Gestion clavier et souris
- Lissage des entrées pour éviter les oscillations
- Configuration des zones mortes
- États pulse pour les boutons

### RenderSystem
- Renderer Three.js optimisé
- Statistiques de performance en temps réel
- Gestion automatique du redimensionnement
- Configuration des ombres et éclairage

## 🧪 Tests

### Tests Manuels
```bash
# Tester la nouvelle architecture
npm run dev-new
```

### Tests Automatisés
```bash
# Vérification des types
npm run type-check

# Linting
npm run lint
```

## 📈 Performance

- **Boucle 60 FPS** stable
- **Architecture modulaire** pour optimisations ciblées
- **Lazy loading** des systèmes non critiques
- **Profiling intégré** via RenderSystem

## 🔄 Migration

La migration vers la nouvelle architecture se fait progressivement :

1. ✅ **Phase 1-3** : Architecture ECS implémentée
2. 🔄 **Phase 4** : Tests d'intégration (en cours)
3. 🔄 **Phase 5** : Migration complète
4. 🔄 **Phase 6** : Optimisations performance

## 🐛 Debug

### Console
```javascript
// Accès à l'application depuis la console
window.simulationApp

// Obtenir les statistiques
window.simulationApp.getStats()

// États des systèmes
window.simulationApp.physicsSystem.getStats()
window.simulationApp.windSystem.getWindState()
window.simulationApp.inputSystem.getInputState()
```

### Interface Utilisateur
L'overlay en haut à gauche affiche :
- FPS en temps réel
- Position du kite
- Vitesse du kite
- Vitesse du vent
- Position de la barre

## 📚 Documentation

- [Architecture ECS](./docs/ECS_ARCHITECTURE.md)
- [Guide des Systèmes](./docs/SYSTEMS_GUIDE.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Guide de Migration](./docs/MIGRATION_GUIDE.md)

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commiter les changements (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.