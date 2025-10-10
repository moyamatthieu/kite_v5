# 🏗️ Plan de Refactoring ECS Pur

## 📊 Analyse de l'Architecture Actuelle

### ✅ Déjà ECS (à conserver)
```
src/simulation/systems/
  ├── InputSystem.ts          ✅ Système ECS
  ├── WindSystem.ts           ✅ Système ECS
  ├── PhysicsSystem.ts        ✅ Système ECS
  ├── RenderSystem.ts         ✅ Système ECS
  └── KitePhysicsSystem.ts    ✅ Système ECS complet
```

### ❌ NON-ECS (à refactorer/supprimer)
```
src/simulation/controllers/
  ├── ControlBarManager.ts    ❌ Manager legacy → intégrer dans System
  ├── KiteController.ts       ❌ Manager legacy → déjà dans KitePhysicsSystem
  └── InputHandler.ts         ❌ Handler legacy → déjà dans InputSystem

src/simulation/physics/
  └── PhysicsEngine.ts        ❌ Doublon avec KitePhysicsSystem

src/simulation/SimulationApp.ts
  ├── controlBar              ❌ Propriété directe → doit être géré par System
  ├── pilot                   ❌ Propriété directe → doit être géré par System
  ├── leftLine                ❌ Propriété directe → doit être géré par System
  ├── rightLine               ❌ Propriété directe → doit être géré par System
  └── controlBarManager       ❌ Manager → doit être dans System
```

## 🎯 Architecture ECS Cible

### Principe ECS
```
Entity = ID + Composants
Component = Données pures (pas de logique)
System = Logique pure qui opère sur les composants
```

### Structure Cible
```
src/simulation/
  ├── entities/                    # 🆕 Nouvelles entités ECS
  │   ├── Entity.ts               # Interface de base
  │   ├── KiteEntity.ts           # Entité Kite
  │   ├── ControlBarEntity.ts     # Entité Barre
  │   ├── PilotEntity.ts          # Entité Pilote
  │   └── LineEntity.ts           # Entité Ligne
  │
  ├── components/                  # 🆕 Composants purs
  │   ├── TransformComponent.ts   # Position, rotation, scale
  │   ├── MeshComponent.ts        # Géométrie Three.js
  │   ├── PhysicsComponent.ts     # État physique
  │   ├── InputComponent.ts       # État input
  │   └── ControlComponent.ts     # État contrôle
  │
  └── systems/                     # Systèmes (déjà existants + nouveaux)
      ├── InputSystem.ts          ✅ Existant
      ├── WindSystem.ts           ✅ Existant
      ├── KitePhysicsSystem.ts    ✅ Existant
      ├── ControlBarSystem.ts     🆕 Remplace ControlBarManager
      ├── LinesRenderSystem.ts    🆕 Gère le rendu des lignes
      └── RenderSystem.ts         ✅ Existant (à adapter)
```

## 📋 Plan d'Action

### Phase 1 : Créer l'infrastructure ECS
- [ ] Créer `src/simulation/entities/Entity.ts` (interface de base)
- [ ] Créer `src/simulation/components/` (composants purs)
- [ ] Créer `EntityManager.ts` (registre central des entités)

### Phase 2 : Migrer les Managers vers Systems
- [ ] **ControlBarManager → ControlBarSystem**
  - Déplacer logique de rotation
  - Déplacer logique de rendu
  - Intégrer dans la boucle ECS

- [ ] **InputHandler → intégrer dans InputSystem**
  - Le système existe déjà
  - Vérifier qu'il gère bien le smoothing

- [ ] **KiteController → supprimer**
  - Déjà intégré dans KitePhysicsSystem
  - Vérifier les dépendances avant suppression

### Phase 3 : Refactorer les composants visuels
- [ ] **ControlBar** : créer ControlBarEntity + ControlBarSystem
- [ ] **Pilot** : créer PilotEntity + optionnel PilotSystem
- [ ] **Lines** : créer LineEntity + LinesRenderSystem

### Phase 4 : Nettoyer SimulationApp
- [ ] Supprimer les propriétés directes (controlBar, pilot, lines)
- [ ] Remplacer par EntityManager
- [ ] Nettoyer syncLegacyComponents()
- [ ] Supprimer le flag `enableLegacyComponents`

### Phase 5 : Supprimer les fichiers obsolètes
- [ ] Supprimer `controllers/ControlBarManager.ts`
- [ ] Supprimer `controllers/KiteController.ts` (si dupliqué)
- [ ] Supprimer `controllers/InputHandler.ts` (si dupliqué)
- [ ] Supprimer `physics/PhysicsEngine.ts` (si dupliqué)

## 🎨 Exemple : ControlBarSystem

```typescript
// Nouvelle architecture ECS pure
export class ControlBarSystem extends BaseSimulationSystem {
  private entities: Map<string, ControlBarEntity> = new Map();

  update(context: SimulationContext): void {
    this.entities.forEach(entity => {
      // Lire le composant Input
      const input = entity.getComponent<InputComponent>('input');

      // Lire le composant Transform
      const transform = entity.getComponent<TransformComponent>('transform');

      // Mettre à jour la rotation (logique pure)
      transform.rotation = input.barRotation;

      // Mettre à jour le mesh Three.js
      const mesh = entity.getComponent<MeshComponent>('mesh');
      mesh.object3D.quaternion.copy(transform.quaternion);
    });
  }
}
```

## 📦 Structure des Composants

### TransformComponent
```typescript
export interface TransformComponent {
  position: THREE.Vector3;
  rotation: number;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}
```

### MeshComponent
```typescript
export interface MeshComponent {
  object3D: THREE.Object3D;  // THREE.Group, Mesh, Line, etc.
}
```

### PhysicsComponent
```typescript
export interface PhysicsComponent {
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  mass: number;
}
```

## 🔄 Flux ECS Pur

```
Frame N:
  1. InputSystem.update()      → Lit clavier, met à jour InputComponent
  2. WindSystem.update()       → Calcule vent, met à jour WindComponent
  3. KitePhysicsSystem.update()→ Calcule physique, met à jour PhysicsComponent
  4. ControlBarSystem.update() → Calcule barre, met à jour TransformComponent
  5. LinesRenderSystem.update()→ Calcule lignes, met à jour MeshComponent
  6. RenderSystem.update()     → Rend tous les MeshComponent
```

## ✅ Avantages de l'Architecture ECS

1. **Séparation des responsabilités** : Données ≠ Logique
2. **Testabilité** : Chaque système est indépendant
3. **Performance** : Cache-friendly, parallélisable
4. **Maintenabilité** : Ajouter/supprimer features facilement
5. **Clarté** : Flux de données explicite

## 🚀 Migration Progressive

**Étape 1** : Créer l'infrastructure sans casser l'existant
**Étape 2** : Migrer un composant à la fois (commencer par ControlBar)
**Étape 3** : Tester à chaque migration
**Étape 4** : Supprimer l'ancien code quand le nouveau fonctionne
**Étape 5** : Documenter les patterns ECS pour le futur

## 📝 Notes

- Garder `Kite` en tant qu'entité complexe (THREE.Object3D) pour l'instant
- Migrer vers pur ECS seulement si nécessaire
- Prioriser la simplicité : pas de sur-ingénierie

---

**Prêt pour le refactoring ?** Commençons par créer l'infrastructure ECS de base.
