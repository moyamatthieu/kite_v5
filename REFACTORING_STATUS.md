# État de la Refactorisation ECS

## ✅ Systèmes de Base Implémentés

### 1. RenderSystem
- ✅ Scène Three.js avec lumières et sol
- ✅ OrbitControls pour la caméra
- ✅ Gestion du redimensionnement
- ✅ Calcul du FPS

### 2. WindSystem
- ✅ Vent de base avec direction/vitesse
- ✅ Turbulence (bruit pseudo-aléatoire)
- ✅ Rafales (gusts)
- ✅ Cisaillement du vent (altitude)
- ✅ Vent apparent (vent - vitesse objet)

### 3. InputSystem
- ✅ Gestion clavier (flèches, R, D)
- ✅ Gestion souris (événements)
- ✅ Lissage de la barre de contrôle
- ✅ Zone morte et limitation de vitesse

### 4. PhysicsSystem (Base)
- ✅ Gravité
- ✅ Résistance de l'air
- ✅ Collision avec le sol
- ✅ Intégration d'Euler
- ✅ Limitation des vitesses

## ⏳ Composants Existants à Intégrer

### 1. BridleSystem
**Fichier**: `src/simulation/physics/BridleSystem.ts`
**État**: Existe mais non utilisé dans l'architecture ECS
**Action**: Intégrer dans PhysicsSystem pour contraintes des brides

### 2. LineSystem
**Fichier**: `src/simulation/physics/LineSystem.ts`
**État**: Existe mais non utilisé dans l'architecture ECS
**Action**: Intégrer dans PhysicsSystem pour contraintes des lignes

### 3. ConstraintSolver
**Fichier**: `src/simulation/physics/ConstraintSolver.ts`
**État**: Existe mais non utilisé dans l'architecture ECS
**Action**: Appeler après intégration des forces (PBD)

### 4. AerodynamicsCalculator
**Fichier**: `src/simulation/physics/AerodynamicsCalculator.ts`
**État**: Version simplifiée dans SimulationApp
**Action**: Remplacer par version complète avec calcul par surface

## 🎯 Plan d'Intégration

### Phase 1: Renforcement de PhysicsSystem
```typescript
PhysicsSystem {
  - lineSystem: LineSystem
  - bridleSystem: BridleSystem
  - constraintSolver: ConstraintSolver
  - aerodynamicsCalculator: AerodynamicsCalculator

  update() {
    // 1. Calculer vent apparent (WindSystem)
    // 2. Calculer forces aéro (AerodynamicsCalculator)
    // 3. Appliquer gravité
    // 4. Intégrer forces → vitesse → position prédite
    // 5. Appliquer contraintes (ConstraintSolver)
    // 6. Corriger position/rotation
    // 7. Calculer tensions (debug only)
  }
}
```

### Phase 2: Refactoring de SimulationApp
- Déplacer logique physique complexe vers PhysicsSystem
- Garder seulement synchronisation visuelle
- Simplifier la méthode `syncLegacyComponents`

### Phase 3: Visualisation
- Afficher tensions des brides (couleur)
- Afficher tensions des lignes (couleur)
- Debug arrows pour forces aérodynamiques

## 📊 Architecture Cible

```
SimulationApp (Orchestrateur)
  ├─> InputSystem (Priorité 1)
  │    └─> Capture entrées utilisateur
  │
  ├─> WindSystem (Priorité 5)
  │    └─> Calcule vent apparent
  │
  ├─> PhysicsSystem (Priorité 10)
  │    ├─> LineSystem (calcul tensions)
  │    ├─> BridleSystem (calcul tensions)
  │    ├─> AerodynamicsCalculator (forces)
  │    ├─> Intégration (F=ma, T=Iα)
  │    └─> ConstraintSolver (PBD)
  │
  └─> RenderSystem (Priorité 100)
       └─> Rendu Three.js
```

## 🔧 Prochaines Étapes

1. ✅ Corriger erreurs TypeScript dans PhysicsSystem
2. ⏳ Intégrer BridleSystem dans PhysicsSystem
3. ⏳ Intégrer LineSystem dans PhysicsSystem
4. ⏳ Intégrer ConstraintSolver dans PhysicsSystem
5. ⏳ Intégrer AerodynamicsCalculator complet
6. ⏳ Tester simulation complète
7. ⏳ Ajouter visualisation des tensions

## 📝 Notes Importantes

### Principe Physique Fondamental
**Les lignes et brides sont des CONTRAINTES, pas des forces !**

- Elles ne TIRENT PAS
- Elles RETIENNENT (distance max)
- L'équilibre émerge de la géométrie imposée
- Les forces proviennent de: aérodynamique + gravité

### Ordre d'Exécution Critique
1. Calcul des forces (aéro + gravité)
2. Intégration (position prédite)
3. Application des contraintes (correction PBD)
4. Calcul des tensions (visualisation uniquement)

### Configuration Actuelle
- **FPS**: 60
- **Timestep physique**: 1/60 = 0.0167s
- **Longueur lignes**: 30m par défaut
- **Masse kite**: 0.5 kg
- **Vent de base**: 5 m/s

---
**Dernière mise à jour**: 2025-10-09
