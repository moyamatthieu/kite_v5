# Architecture Visuelle : Avant vs Après Refactor

## 📐 Structure Actuelle (AVANT)

```
SimulationApp.ts (781 lignes) ⚠️ MONOLITHIQUE
├─ Imports & Config (90 lignes)
├─ Constructor & Initialization (100 lignes)
├─ createSystems() (60 lignes)
├─ createEntities() (350 lignes) ⚠️ PROBLÈME
│  ├─ createKiteEntity() (40 lignes)
│  │  └─ new Kite()
│  │  └─ new TransformComponent()
│  │  └─ new MeshComponent()
│  │  └─ kitePhysicsSystem.setKite()
│  │
│  ├─ createControlBarEntity() (130 lignes) ⚠️ TRÈS VERBEUX
│  │  └─ new THREE.CylinderGeometry() (60 lignes Three.js !)
│  │  └─ new THREE.MeshStandardMaterial()
│  │  └─ Création handles (40 lignes Three.js !)
│  │  └─ new TransformComponent()
│  │  └─ new MeshComponent()
│  │  └─ Configuration systèmes (30 lignes)
│  │
│  ├─ createPilotEntity() (15 lignes)
│  │  └─ new PilotEntity()
│  │  └─ pilotSystem.setPilotEntity()
│  │
│  └─ createLineEntities() (30 lignes)
│     └─ linesRenderSystem.setKite()
│     └─ linesRenderSystem.setControlBarSystem()
│     └─ linesRenderSystem.createLineEntity()
│
├─ initializeSystems() (40 lignes)
├─ setupRendering() (80 lignes)
├─ createInterface() (30 lignes)
├─ updateLoop() (80 lignes)
└─ Accessors & Utils (80 lignes)

❌ PROBLÈMES :
- Violation Single Responsibility Principle
- Logique Three.js mélangée avec orchestration ECS
- Code non réutilisable (impossible créer 2nd control bar)
- Difficile à tester (couplage fort)
- Verbeux et difficile à lire
```

---

## 🎯 Structure Proposée (APRÈS)

```
📁 src/simulation/
├─ SimulationApp.ts (450 lignes) ✅ ORCHESTRATEUR PUR
│  ├─ Imports & Config (90 lignes)
│  ├─ Constructor & Initialization (100 lignes)
│  ├─ createSystems() (60 lignes)
│  ├─ createEntities() (80 lignes) ✅ SIMPLIFIÉ
│  │  ├─ createKiteEntity() (10 lignes)
│  │  │  └─ KiteEntityFactory.create()
│  │  │  └─ Configuration systèmes
│  │  │
│  │  ├─ createControlBarEntity() (15 lignes)
│  │  │  └─ ControlBarEntityFactory.create()
│  │  │  └─ Configuration systèmes
│  │  │
│  │  ├─ createPilotEntity() (10 lignes)
│  │  │  └─ PilotEntityFactory.create()
│  │  │  └─ Configuration systèmes
│  │  │
│  │  └─ createLineEntities() (20 lignes)
│  │     └─ LineEntityFactory.create() (optionnel)
│  │
│  ├─ initializeSystems() (40 lignes)
│  ├─ setupRendering() (80 lignes)
│  ├─ createInterface() (30 lignes)
│  ├─ updateLoop() (80 lignes)
│  └─ Accessors & Utils (80 lignes)
│
├─ 📁 factories/ ✅ NOUVEAU - SÉPARATION DES RESPONSABILITÉS
│  ├─ ControlBarEntityFactory.ts (120 lignes)
│  │  ├─ create(params) → Entity
│  │  ├─ createGeometry() → THREE.Group
│  │  ├─ createBar() → THREE.Mesh
│  │  └─ createHandles() → { left, right }
│  │
│  ├─ PilotEntityFactory.ts (60 lignes)
│  │  ├─ create(params) → PilotEntity
│  │  └─ createGeometry() → THREE.Group
│  │
│  ├─ KiteEntityFactory.ts (50 lignes)
│  │  ├─ create(params) → Entity
│  │  └─ setupKite() → Kite
│  │
│  └─ LineEntityFactory.ts (optionnel)
│     └─ create(params) → LineEntity
│
└─ 📁 utils/
   └─ EntityBuilder.ts ✅ HELPERS COMMUNS
      ├─ registerAndAddToScene()
      └─ attachChild()

✅ BÉNÉFICES :
- Separation of Concerns (SRP respecté)
- Code réutilisable (factories indépendantes)
- Testable (chaque factory testable isolément)
- Lisible (SimulationApp = orchestration pure)
- Évolutif (ajouter entités sans toucher SimulationApp)
```

---

## 🔄 Flux de Création d'Entité : Avant vs Après

### AVANT : Tout dans SimulationApp

```
┌─────────────────────────────────────────────────────┐
│         SimulationApp.createControlBarEntity()      │
│                                                     │
│  1. new THREE.CylinderGeometry()       ┐            │
│  2. new THREE.MeshStandardMaterial()   │            │
│  3. new THREE.Mesh()                   │ 60 lignes  │
│  4. bar.rotation.z = Math.PI / 2       │ Three.js   │
│  5. Créer handles (×2)                 │            │
│  6. Positioning                        ┘            │
│                                                     │
│  7. new Entity()                       ┐            │
│  8. new TransformComponent()           │ 30 lignes  │
│  9. new MeshComponent()                │ ECS        │
│  10. entity.addComponent()             ┘            │
│                                                     │
│  11. controlBarSystem.setEntity()      ┐ 40 lignes  │
│  12. controlBarSystem.setInputSystem() │ Config     │
│  13. pilotSystem.setControlBarPos()    ┘ Système    │
└─────────────────────────────────────────────────────┘
        ❌ 130 lignes, responsabilités mélangées
```

---

### APRÈS : Factory Pattern

```
┌────────────────────────────────────────┐
│  SimulationApp.createControlBarEntity()│
│                                        │
│  1. ControlBarEntityFactory.create()  │ ← DÉLÉGATION
│  2. registerEntity()                  │
│  3. controlBarSystem.setEntity()      │
│  4. controlBarSystem.setInputSystem() │
└────────────────────────────────────────┘
        ✅ 15 lignes, orchestration pure
                      │
                      │ délègue à
                      ▼
┌────────────────────────────────────────┐
│   ControlBarEntityFactory.create()    │
│                                        │
│  1. createGeometry()        ┐          │
│     ├─ createBar()          │ 60 lignes│
│     └─ createHandles()      │ Three.js │
│                             ┘          │
│  2. new Entity()            ┐          │
│  3. new TransformComponent()│ 30 lignes│
│  4. new MeshComponent()     │ ECS      │
│  5. entity.addComponent()   ┘          │
│                                        │
│  6. return entity                      │
└────────────────────────────────────────┘
        ✅ 120 lignes, responsabilité unique
        ✅ Réutilisable, testable, isolée
```

---

## 📊 Métriques Avant/Après

### Taille des Fichiers

```
AVANT :
┌────────────────────────────────┬────────┐
│ Fichier                        │ Lignes │
├────────────────────────────────┼────────┤
│ SimulationApp.ts               │   781  │ ⚠️
│                                │        │
│ TOTAL                          │   781  │
└────────────────────────────────┴────────┘

APRÈS :
┌────────────────────────────────┬────────┐
│ Fichier                        │ Lignes │
├────────────────────────────────┼────────┤
│ SimulationApp.ts               │   450  │ ✅
│ ControlBarEntityFactory.ts     │   120  │ ✅
│ PilotEntityFactory.ts          │    60  │ ✅
│ KiteEntityFactory.ts           │    50  │ ✅
│ EntityBuilder.ts               │    40  │ ✅
│                                │        │
│ TOTAL                          │   720  │ ✅
└────────────────────────────────┴────────┘

Remarque : Total +61 lignes MAIS :
- Code mieux organisé (séparation responsabilités)
- Réutilisable (créer plusieurs instances)
- Testable (factories isolées)
- Maintenable (modifications localisées)
```

---

### Complexité Cyclomatique

```
AVANT :
createControlBarEntity() : Complexité = 12 ⚠️
  - 130 lignes linéaires
  - Branches : if/else pour pilote, géométries
  - Difficile à suivre

APRÈS :
createControlBarEntity() : Complexité = 3 ✅
  - 15 lignes
  - Appel factory simple
  - Facile à comprendre

ControlBarEntityFactory.create() : Complexité = 5 ✅
  - Logique isolée
  - Méthodes privées bien découpées
  - Facile à tester
```

---

### Testabilité

```
AVANT :
┌───────────────────────────────────────────┐
│ Test createControlBarEntity() ?           │
│                                           │
│ ❌ Nécessite :                            │
│   - Mock EntityManager                    │
│   - Mock ControlBarSystem                 │
│   - Mock InputSystem                      │
│   - Mock PilotSystem                      │
│   - Mock PilotEntity                      │
│   - Mock THREE.Scene                      │
│   - Setup complet SimulationApp           │
│                                           │
│ Couplage : ★★★★★ (très élevé)           │
└───────────────────────────────────────────┘

APRÈS :
┌───────────────────────────────────────────┐
│ Test ControlBarEntityFactory.create() ?   │
│                                           │
│ ✅ Nécessite :                            │
│   - Paramètres simples                    │
│   - Aucun mock (factory pure)             │
│   - Vérifier entité retournée             │
│                                           │
│ Couplage : ★☆☆☆☆ (très faible)           │
└───────────────────────────────────────────┘

Exemple de test :
describe('ControlBarEntityFactory', () => {
  it('should create entity with correct components', () => {
    const entity = ControlBarEntityFactory.create();
    
    expect(entity.getComponent('transform')).toBeDefined();
    expect(entity.getComponent('mesh')).toBeDefined();
    
    const mesh = entity.getComponent<MeshComponent>('mesh');
    expect(mesh?.object3D.children.length).toBe(3); // bar + 2 handles
  });
});
```

---

## 🎨 Patterns Appliqués

### Pattern Factory (existant dans le projet)

```
Existants :
├─ FrameFactory.ts      (crée structure carbone)
├─ SurfaceFactory.ts    (crée voile)
├─ BridleFactory.ts     (crée brides)
└─ LineFactory.ts       (crée lignes)

Nouveaux (proposés) :
├─ ControlBarEntityFactory.ts  (crée entité ECS ControlBar)
├─ PilotEntityFactory.ts       (crée entité ECS Pilot)
└─ KiteEntityFactory.ts        (crée entité ECS Kite)

Cohérence architecturale ✅
```

---

### Pattern Builder (optionnel Phase 4)

```
AVANT :
this.controlBarSystem.setControlBarEntity(entity);
this.controlBarSystem.setInputSystem(inputSystem);
this.pilotSystem.setControlBarPosition(position);

APRÈS :
SystemConfigBuilder
  .configureControlBar(controlBarSystem, entity, inputSystem)
  .configurePilot(pilotSystem, position);

Fluent interface ✅
```

---

## 📈 Courbe d'Évolution

```
Taille SimulationApp.ts (lignes)

1000│
    │
 900│
    │                              ╱ Sans refactor
 800│                          ╱
    │                      ╱
 781│─ ─ ─ ─ ─ ─ ─ ─ ─ •  ← ACTUEL
    │               ╱    │
 700│           ╱        │
    │       ╱            │
 600│   ╱                │
    │                    │
 500│                    │    Avec refactor
    │                    │  ╱
 450│                    │•─ ─ ─ ─ ─ ─ ─ ─ ─ → Stable
    │                    ╱
 400│                ╱
    │            ╱
 300│        ╱
    │
    └────────────────────────────────────────
     2024    2025 Jan    Futur sans    Futur avec
                         refactor       refactor

Légende :
• = État actuel (781 lignes)
╱ = Tendance croissance (nouvelles features)
─ = État après refactor (450 lignes, stable)
```

---

## ✅ Checklist Visuelle

### Phase 1 : ControlBarEntityFactory (30 min)

```
[📁] Créer dossier factories/
  └─ [ ] mkdir src/simulation/factories

[📄] Créer ControlBarEntityFactory.ts
  ├─ [ ] Interface ControlBarFactoryParams
  ├─ [ ] Méthode create(params)
  ├─ [ ] Méthode createGeometry()
  ├─ [ ] Méthode createBar()
  └─ [ ] Méthode createHandles()

[✏️] Refactoriser SimulationApp.ts
  ├─ [ ] Import ControlBarEntityFactory
  ├─ [ ] Remplacer 130 lignes par appel factory
  └─ [ ] Conserver config systèmes

[✅] Validation
  ├─ [ ] npm run type-check (0 erreurs)
  ├─ [ ] Test manuel : barre visible
  ├─ [ ] Test manuel : rotations fonctionnent
  └─ [ ] Git commit

Résultat :
  SimulationApp.ts : 781 → 660 lignes (-121)
  +1 fichier bien organisé
```

---

## 🎯 Impact Visuel : Exemple Concret

### Code AVANT (extrait createControlBarEntity)

```typescript
// ⚠️ 130 lignes mélangées dans SimulationApp.ts

private createControlBarEntity(): void {
  const controlBarEntity = this.entityManager.createEntity('controlBar');
  const controlBarGroup = new THREE.Group();
  controlBarGroup.name = 'ControlBar';

  // 🔴 GÉOMÉTRIE THREE.JS (60 lignes)
  const barGeometry = new THREE.CylinderGeometry(
    CONFIG.controlBar.barRadius,
    CONFIG.controlBar.barRadius,
    CONFIG.controlBar.width
  );
  const barMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.3
  });
  const bar = new THREE.Mesh(barGeometry, barMaterial);
  bar.rotation.z = Math.PI / 2;
  bar.castShadow = true;
  controlBarGroup.add(bar);

  // 🔴 HANDLES (40 lignes)
  const handleGeometry = new THREE.CylinderGeometry(/*...*/);
  const handleMaterial = new THREE.MeshStandardMaterial(/*...*/);
  const leftHandle = new THREE.Mesh(handleGeometry, handleMaterial);
  leftHandle.position.set(-halfWidth, 0, 0);
  leftHandle.rotation.z = Math.PI / 2;
  // ... 20 lignes supplémentaires ...

  // 🟡 ECS COMPONENTS (30 lignes)
  const transform = new TransformComponent(/*...*/);
  controlBarEntity.addComponent(transform);
  const mesh = new MeshComponent(controlBarGroup, /*...*/);
  controlBarEntity.addComponent(mesh);

  // 🟢 CONFIGURATION SYSTÈMES (30 lignes)
  this.controlBarSystem.setControlBarEntity(controlBarEntity);
  this.controlBarSystem.setInputSystem(this.inputSystem);
  // ...
}
```

---

### Code APRÈS (avec factory)

```typescript
// ✅ 15 lignes dans SimulationApp.ts

private createControlBarEntity(): void {
  // Récupérer parent pour attachement
  const pilotEntity = this.entityManager.getEntity('pilot');
  const pilotMesh = pilotEntity?.getComponent<MeshComponent>('mesh');
  
  // Factory fait tout le travail (géométrie + composants)
  const controlBarEntity = ControlBarEntityFactory.create({
    parentObject: pilotMesh?.object3D
  });
  
  // Configuration ECS et systèmes (seule responsabilité de SimulationApp)
  this.entityManager.registerEntity(controlBarEntity);
  this.controlBarSystem.setControlBarEntity(controlBarEntity);
  this.controlBarSystem.setInputSystem(this.inputSystem);
  
  const worldPosition = new THREE.Vector3();
  controlBarEntity.getComponent<MeshComponent>('mesh')?.object3D
    .getWorldPosition(worldPosition);
  this.pilotSystem.setControlBarPosition(worldPosition);
}
```

```typescript
// ✅ 120 lignes dans ControlBarEntityFactory.ts (nouveau fichier)

export class ControlBarEntityFactory {
  static create(params: ControlBarFactoryParams = {}): Entity {
    const entity = new Entity(params.name || 'controlBar');
    const geometry = this.createGeometry();
    
    const position = params.position || new THREE.Vector3(
      0, CONFIG.controlBar.offsetY, CONFIG.controlBar.offsetZ
    );
    geometry.position.copy(position);
    
    if (params.parentObject) {
      params.parentObject.add(geometry);
    }
    
    entity.addComponent(new TransformComponent({...}));
    entity.addComponent(new MeshComponent(geometry, {...}));
    
    return entity;
  }
  
  private static createGeometry(): THREE.Group {
    const group = new THREE.Group();
    group.add(this.createBar());
    const { left, right } = this.createHandles();
    group.add(left, right);
    return group;
  }
  
  private static createBar(): THREE.Mesh { /*...*/ }
  private static createHandles(): { left, right } { /*...*/ }
}
```

**Comparaison finale :**
- SimulationApp : 130 → 15 lignes (-88%)
- Nouveau fichier : 120 lignes (bien organisé, réutilisable)
- Responsabilités séparées ✅
- Testable ✅
- Pattern cohérent avec projet ✅

---

**Conclusion Visuelle :** Le refactor transforme un monolithe difficile à maintenir en une architecture modulaire, testable et évolutive, tout en respectant les patterns déjà établis dans le projet.
