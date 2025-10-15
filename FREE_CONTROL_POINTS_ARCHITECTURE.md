# Architecture des Points de Contrôle Libres (Free Control Points)

## Vue d'ensemble

Ce document décrit l'architecture ECS permettant de simuler les points de contrôle (`CTRL_GAUCHE` et `CTRL_DROIT`) comme des **particules libres** dont la position émerge uniquement des contraintes physiques, au lieu de points rigidement attachés à la géométrie du cerf-volant.

### Motivation

**Problème initial** : Les points CTRL étaient traités comme des points fixes dans `GeometryComponent`, transformés avec le quaternion du kite. Cela créait un couplage rigide incorrect qui empêchait l'angle d'attaque d'émerger naturellement de la physique.

**Solution** : Migrer vers une architecture où chaque point CTRL est une entité ECS indépendante, avec sa propre position et vélocité, contrainte uniquement par :
- 3 brides reliant le kite (points NEZ, INTER_GAUCHE/DROIT, CENTRE)
- 1 ligne de contrôle reliant la barre (handle)

Cette approche permet au kite d'adopter une orientation réaliste basée sur l'équilibre des forces aérodynamiques et des tensions de brides.

---

## Architecture ECS

### 1. Composants

#### `ControlPointComponent`
**Fichier** : `src/ecs/components/ControlPointComponent.ts`

**Responsabilité** : Stockage de l'état physique d'un point de contrôle libre.

**Propriétés** :
```typescript
{
  position: THREE.Vector3        // Position actuelle dans l'espace monde
  velocity: THREE.Vector3        // Vitesse actuelle
  previousPosition: THREE.Vector3 // Position précédente (pour Verlet)
  config: {
    side: 'left' | 'right'       // Côté gauche ou droit
    attachments: string[]         // Points d'attache sur le kite
    mass: number                  // Masse (0.001 kg - négligeable)
  }
}
```

**Méthodes** :
- `updatePosition(newPos)` : Met à jour position et previousPosition
- `updateVelocity(newVel)` : Met à jour la vélocité
- `reset(initialPos, initialVel)` : Réinitialise l'état

**Principe** : Pure data, aucune logique métier.

---

### 2. Entités

#### `ControlPointEntityFactory`
**Fichier** : `src/ecs/entities/factories/ControlPointEntityFactory.ts`

**Responsabilité** : Création des entités CTRL avec tous leurs composants.

**Méthodes** :
```typescript
// Créer un seul point de contrôle
static create(
  side: 'left' | 'right',
  initialPosition: THREE.Vector3,
  attachments: string[]
): Entity

// Créer une paire gauche/droite
static createPair(
  leftPosition: THREE.Vector3,
  rightPosition: THREE.Vector3
): { left: Entity, right: Entity }
```

**Composants ajoutés** :
1. `ControlPointComponent` - État spécifique CTRL
2. `TransformComponent` - Position/rotation monde
3. `PhysicsComponent` - Masse/vitesse/forces (mass = 0.001 kg)

**Usage typique** :
```typescript
const { left, right } = ControlPointEntityFactory.createPair(
  leftInitialPos,
  rightInitialPos
);
entityManager.registerEntity(left);
entityManager.registerEntity(right);
```

---

### 3. Systèmes

#### `ControlPointSystem`
**Fichier** : `src/ecs/systems/ControlPointSystem.ts`

**Responsabilité** : Résoudre la position des points CTRL et appliquer les forces de brides sur le kite.

**Ordre d'exécution** : `50` (après physique du kite, avant rendu)

**Workflow `update()` :**
```
Pour chaque point CTRL (left/right) :
  1. Récupérer kiteEntity, handlePosition
  2. Extraire positions des 3 points d'attache bride sur kite
  3. Appeler ConstraintSolver.solveControlPointPosition()
     → Résolution quadrilatération 3D (intersection 4 sphères)
  4. Mettre à jour ControlPointComponent.position
  5. Mettre à jour TransformComponent.position
  6. Appeler ConstraintSolver.applyBridleForces()
     → Applique tensions brides sur kite
```

**Configuration requise** :
- `setKiteEntity(entity)` : Référence au kite
- `setHandlePositions(left, right)` : Positions des poignées de barre

**Intégration** :
```typescript
const controlPointSystem = new ControlPointSystem(entityManager);
controlPointSystem.setKiteEntity(kiteEntity);
controlPointSystem.setHandlePositions(handleLeftPos, handleRightPos);
systemManager.addSystem(controlPointSystem);
```

---

#### Extensions de `PureConstraintSolver`
**Fichier** : `src/ecs/systems/ConstraintSolver.pure.ts`

##### a) `solveControlPointPosition()`
**Signature** :
```typescript
solveControlPointPosition(
  handlePosition: THREE.Vector3,
  nezPosition: THREE.Vector3,
  interPosition: THREE.Vector3,
  centrePosition: THREE.Vector3,
  bridles: BridleLengths,
  lineLength: number,
  currentCtrlPosition: THREE.Vector3
): THREE.Vector3 | null
```

**Algorithme** : Quadrilatération 3D
1. Résout trilatération des 3 brides (intersection 3 sphères centrées sur NEZ, INTER, CENTRE)
2. Trouve point sur ligne handle → CTRL (sphère rayon lineLength)
3. Choisit solution géométriquement valide (la plus proche position actuelle)

**Retour** : 
- Nouvelle position CTRL si solution trouvée
- `null` si pas de solution géométrique (bridesages impossibles)

##### b) `trilaterate3D()`
**Signature** :
```typescript
trilaterate3D(
  p1: THREE.Vector3, r1: number,
  p2: THREE.Vector3, r2: number,
  p3: THREE.Vector3, r3: number
): THREE.Vector3[] // 0, 1, ou 2 solutions
```

**Algorithme** : Trilatération analytique
1. Positionne p1 à l'origine, p2 sur axe X
2. Résout système d'équations pour x, y, z
3. Retourne 0, 1 ou 2 points d'intersection

**Usage** : Appelé par `solveControlPointPosition()` pour résoudre les 3 brides.

##### c) `applyBridleForces()`
**Signature** :
```typescript
applyBridleForces(
  kiteEntity: Entity,
  ctrlPosition: THREE.Vector3,
  attachmentNames: string[],
  bridles: BridleLengths,
  stiffness: number = 5000
): void
```

**Algorithme** : Loi de Hooke sur chaque bride
```
Pour chaque bride (NEZ, INTER, CENTRE) :
  1. Calculer direction et longueur actuelle
  2. Comparer à longueur au repos (config)
  3. F = k · Δx (k = 5000 N/m par défaut)
  4. Appliquer force sur PhysicsComponent du kite
```

**Paramètres** :
- `stiffness` : Raideur bride (défaut 5000 N/m, type Dyneema)
- Applique forces sur points d'attache du kite via `PhysicsComponent`

---

### 4. Systèmes Adaptés

#### `LineSystem.pure.ts`
**Modifications** :
- Ajout propriétés `ctrlLeftEntity`, `ctrlRightEntity`
- Méthode `setControlPointEntities(left, right)` pour configuration
- `calculateLineTensions()` lit positions depuis `ctrlLeftEntity.getComponent('transform').position`
- `getLineDistances()` utilise positions CTRL entities au lieu de `geometry.getPoint('CTRL_GAUCHE')`

**Breaking change** : Ne dépend plus de `GeometryComponent` pour positions CTRL.

#### `LinesRenderSystem.ts`
**Modifications** :
- Ajout propriétés `ctrlLeftEntity`, `ctrlRightEntity`
- Méthode `setControlPointEntities(left, right)`
- Rendu lignes utilise `ctrlLeftTransform.position.clone()` directement
- Génération courbes catenary depuis positions entités CTRL

**Impact** : Lignes suivent maintenant correctement les points CTRL libres.

#### `GeometryRenderSystem.ts` (TODO)
**À adapter** :
- Rendu des brides (actuellement utilise `geometry.getPoint('CTRL_GAUCHE/DROIT')`)
- Méthode `calculateBridleTensionsFromGeometry()` doit lire depuis entités CTRL
- Ajouter `setControlPointEntities()` similaire aux autres systèmes

---

## Physique

### Principe de Quadrilatération

Les points CTRL sont contraints par **4 sphères** :

1. **Sphère bride NEZ** : centre = point NEZ du kite, rayon = longueur bride NEZ
2. **Sphère bride INTER** : centre = point INTER_GAUCHE/DROIT, rayon = longueur bride INTER
3. **Sphère bride CENTRE** : centre = point CENTRE, rayon = longueur bride CENTRE
4. **Sphère ligne contrôle** : centre = position handle (barre), rayon = longueur ligne

La position CTRL est l'**intersection géométrique** de ces 4 sphères.

### Résolution en 2 étapes

1. **Trilatération 3D** : Résout intersection sphères 1+2+3 → 0, 1 ou 2 solutions
2. **Contrainte ligne** : Filtre solutions à distance = lineLength du handle
3. **Choix solution** : Prend la solution la plus proche de la position actuelle CTRL

### Forces de Brides sur Kite

Chaque bride applique une force de rappel élastique :

```
F_bride = k · (L_actuelle - L_repos) · direction_normalisée
```

- `k = 5000 N/m` (raideur Dyneema)
- `L_actuelle` : distance actuelle entre point kite et CTRL
- `L_repos` : longueur bride configurée (`CONFIG.kite.bridles`)
- `direction_normalisée` : vecteur unitaire kite → CTRL

Ces forces sont appliquées sur `PhysicsComponent` du kite aux points d'attache (NEZ, INTER, CENTRE).

### Propriétés Émergentes

Avec cette architecture, **l'angle d'attaque du kite émerge naturellement** :

1. Vent applique forces de portance/traînée sur surfaces kite
2. Kite pivote selon moments aérodynamiques
3. Points CTRL se déplacent pour maintenir contraintes brides + ligne
4. Brides appliquent forces de rappel sur kite
5. **Équilibre** : Kite adopte orientation où forces aéro = tensions brides

→ Pas de scripting d'angle, physique pure !

---

## Intégration SimulationApp

### Étapes d'intégration

```typescript
// 1. Créer entités CTRL
const { left: ctrlLeft, right: ctrlRight } = 
  ControlPointEntityFactory.createPair(
    leftInitialPosition,  // Calculée par trilatération depuis géométrie kite
    rightInitialPosition
  );

// 2. Enregistrer dans EntityManager
entityManager.registerEntity(ctrlLeft);
entityManager.registerEntity(ctrlRight);

// 3. Créer et configurer ControlPointSystem
const controlPointSystem = new ControlPointSystem(entityManager);
controlPointSystem.setKiteEntity(kiteEntity);
controlPointSystem.setHandlePositions(
  controlBarLeft.position,
  controlBarRight.position
);
systemManager.addSystem(controlPointSystem);

// 4. Configurer LineSystem
lineSystem.setControlPointEntities(ctrlLeft, ctrlRight);

// 5. Configurer LinesRenderSystem
linesRenderSystem.setControlPointEntities(ctrlLeft, ctrlRight);

// 6. (TODO) Configurer GeometryRenderSystem
geometryRenderSystem.setControlPointEntities(ctrlLeft, ctrlRight);
```

### Positions Initiales

Calculer positions CTRL initiales par trilatération depuis géométrie kite :

```typescript
// Extraire positions points d'attache depuis KiteGeometry
const nezPos = kiteGeometry.points.find(p => p.name === 'NEZ').position;
const interLeftPos = kiteGeometry.points.find(p => p.name === 'INTER_GAUCHE').position;
const centrePos = kiteGeometry.points.find(p => p.name === 'CENTRE').position;

// Appliquer transform kite pour obtenir positions monde
const kiteTransform = kiteEntity.getComponent('transform');
const nezWorld = nezPos.clone().applyQuaternion(kiteTransform.quaternion).add(kiteTransform.position);
// ... idem pour interLeftWorld, centreWorld

// Résoudre trilatération
const ctrlLeftInitial = PureConstraintSolver.trilaterate3D(
  nezWorld, CONFIG.kite.bridles.nez,
  interLeftWorld, CONFIG.kite.bridles.inter,
  centreWorld, CONFIG.kite.bridles.centre
)[0]; // Prendre première solution
```

---

## Ordre d'Exécution Systèmes

Pour garantir cohérence physique, ordre strict :

1. **InputSystem** (ordre 5) : Capture inputs utilisateur
2. **WindSimulator** (ordre 10) : Calcule champ de vent
3. **KitePhysicsSystem** (ordre 20) : Forces aéro → accélération kite
4. **LinePhysics** (ordre 25) : Physique lignes
5. **PureBridleSystem** (ordre 30) : Tensions brides (si utilisé)
6. **PureConstraintSolver** (ordre 40) : Contraintes géométriques
7. **ControlPointSystem** (ordre 50) : **Résout CTRL + applique forces brides**
8. **LineSystem** (ordre 60) : Calcule tensions lignes depuis CTRL
9. **GeometryRenderSystem** (ordre 90) : Génère meshes depuis composants
10. **LinesRenderSystem** (ordre 95) : Rendu lignes
11. **RenderSystem** (ordre 100) : Rendu scène Three.js

**Critique** : `ControlPointSystem` doit s'exécuter **après** physique kite (ordre 20) mais **avant** calcul tensions lignes (ordre 60).

---

## Migration et Nettoyage

### Fichiers Legacy à Supprimer

Une fois migration terminée et testée :

1. `src/ecs/.legacy/objects/Point.ts` - Classe OO obsolète
2. Références `CTRL_GAUCHE`/`CTRL_DROIT` dans `GeometryComponent`
3. Code `geometry.getPoint('CTRL_GAUCHE')` dans systèmes
4. Transform CTRL via quaternion kite dans renderers

### Checklist Migration

- [x] `ControlPointComponent` créé
- [x] `ControlPointEntityFactory` créé
- [x] `ControlPointSystem` implémenté
- [x] `ConstraintSolver.solveControlPointPosition()` implémenté
- [x] `ConstraintSolver.trilaterate3D()` implémenté
- [x] `ConstraintSolver.applyBridleForces()` implémenté
- [x] `LineSystem` adapté (setControlPointEntities)
- [x] `LinesRenderSystem` adapté (setControlPointEntities)
- [ ] `SimulationApp` intégration (créer entités, wiring)
- [ ] `GeometryRenderSystem` adapté (bridle rendering)
- [ ] Supprimer CTRL de `GeometryComponent`
- [ ] Tests navigateur (vérifier physique émergente)
- [ ] Tuning paramètres (stiffness, masse, etc.)

---

## Paramètres Physiques

### Configuration Actuelle

**Brides** (dans `CONFIG.kite.bridles`) :
```typescript
{
  nez: 0.65,      // 65 cm
  inter: 0.65,    // 65 cm
  centre: 0.85    // 85 cm
}
```

**Raideur bride** : `k = 5000 N/m` (Dyneema-like)

**Masse CTRL** : `0.001 kg` (négligeable, juste pour PhysicsComponent)

**Longueur lignes** : `15 m` (configurable via UI slider)

### Tuning Recommandé

Si comportement instable :
- **Augmenter** stiffness (10000 N/m) pour brides plus rigides
- **Réduire** deltaTime si oscillations numériques
- **Ajuster** masse CTRL (essayer 0.0001 kg)
- **Vérifier** que trilatération retourne solutions valides

Si kite ne réagit pas :
- **Vérifier** que `applyBridleForces()` s'exécute bien
- **Augmenter** forces aérodynamiques (lift/drag scale)
- **Logger** tensions brides et positions CTRL

---

## Debugging

### Logs Utiles

Activer dans `ControlPointSystem.update()` :
```typescript
Logger.getInstance().debug('ControlPointSystem', 
  `CTRL_LEFT resolved: ${newPosition.toArray()}`
);
```

Activer dans `ConstraintSolver.applyBridleForces()` :
```typescript
Logger.getInstance().debug('BridleForces',
  `Force on ${attachmentName}: ${force.length().toFixed(2)} N`
);
```

### Visualisation Debug

Ajouter rendu debug des points CTRL :
```typescript
// Dans DebugRenderer ou système dédié
const ctrlSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.05),
  new THREE.MeshBasicMaterial({ color: 0xff00ff })
);
ctrlSphere.position.copy(ctrlLeftTransform.position);
scene.add(ctrlSphere);
```

Ajouter vecteurs debug des forces brides :
```typescript
const bridleForceArrow = new THREE.ArrowHelper(
  forceDirection,
  attachmentPoint,
  forceLength * 0.001, // Scale
  0xff0000 // Rouge
);
```

---

## Références

- **Documentation principale** : `/CTRL_POINTS_ANALYSIS.md`
- **Modèle physique** : `/PHYSICS_MODEL.md`
- **Tests ECS** : `/test/test_ecs_integration.ts`
- **Commits** :
  - "Feature: Points de contrôle (CTRL) comme entités libres"
  - "Adapter LineSystem et LinesRenderSystem pour CTRL libres"

---

## Notes de Conception

### Pourquoi Quadrilatération et pas Trilatération ?

Les CTRL ont **4 contraintes simultanées**, pas 3 :
- 3 brides vers kite (NEZ, INTER, CENTRE)
- 1 ligne vers handle

→ Sur-contrainte géométrique ! Solution = intersection 4 sphères.

En pratique, on résout d'abord trilatération 3 brides, puis on filtre par contrainte ligne.

### Pourquoi Forces de Brides sur Kite ?

Sans forces de rappel, le kite dériverait indéfiniment. Les brides doivent :
1. Contraindre géométrie (position CTRL)
2. Appliquer couple résistant sur kite (réaction aux forces aéro)

C'est la **dualité contrainte-force** classique en simulation physique.

### Pourquoi ECS et pas Classes OO ?

Architecture ECS permet :
- **Découplage data/logique** : ControlPointComponent = pure data
- **Composition** : Entité CTRL = Transform + Physics + ControlPoint
- **Performance** : Query efficace via EntityManager
- **Testabilité** : Systèmes testables indépendamment
- **Maintenabilité** : Responsabilités claires, code propre

Pattern OO créerait couplage rigide et héritage profond.

---

**Document créé le** : 2025-10-15  
**Auteur** : Migration architecture ECS Kite Simulator V8  
**Version** : 1.0  
**Status** : Architecture implémentée, intégration SimulationApp en cours
