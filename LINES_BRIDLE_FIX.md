# Fix - Lignes et Brides Non Visibles

## Problème
Les lignes de contrôle n'étaient pas visibles et n'étaient pas connectées au kite ni aux brides.

## Solution Implémentée (Architecture ECS Pure)

### 1. **GeometryRenderSystem** - Gestion des Entités de Lignes
- Ajout d'une méthode `initializeLineEntity()` pour créer des placeholders pour les lignes
- Les lignes sont détectées par leur ID (contient 'Line')
- Crée un `MeshComponent` vide qui sera rempli par `LinesRenderSystem`

### 2. **LinesRenderSystem** - Rendu Dynamique des Lignes
- **Simplification de `registerLineEntity()`** : Ne crée plus de mesh directement, juste enregistrement
- **Amélioration de `update()`** :
  - Crée les meshes de lignes à la première frame si absent
  - Utilise `createLineMesh()` pour créer une géométrie TubeGeometry avec courbure caténaire
  - Met à jour la géométrie à chaque frame avec `updateLineGeometry()`
- **Nouvelle méthode `createLineMesh()`** :
  - Crée un `THREE.TubeGeometry` avec courbure réaliste
  - Matériau `MeshStandardMaterial` avec ombres
  - Ajoute directement à la scène
  - Stocke dans le `MeshComponent` de l'entité
- **Nouvelle méthode `createLineCurve()`** :
  - Génère une courbe caténaire (courbure gravitationnelle)
  - Paramétrable via `CONFIG.defaults.catenarySagFactor`

### 3. **SimulationApp** - Initialisation Correcte
- Donne la scène Three.js au `LinesRenderSystem` via `setScene()`
- Initialise les placeholders de lignes via `GeometryRenderSystem.initializeEntity()`
- Les lignes sont ensuite gérées par `LinesRenderSystem.update()`

### 4. **KiteEntityFactory** - Visualisation des Brides
- Ajout de `visual.bridleMaterial` avec couleur verte visible
- Activation de `showDebugMarkers = true` pour voir les points de contrôle
- Les marqueurs rouges sur CTRL_GAUCHE et CTRL_DROIT permettent de voir où les lignes se connectent

## Points de Connexion

### Kite → Lignes
- **Point gauche** : `CTRL_GAUCHE` (coordonnées locales : `-0.2, 0.4, 0`)
- **Point droit** : `CTRL_DROIT` (coordonnées locales : `0.2, 0.4, 0`)
- Conversion en coordonnées monde via `TransformComponent` (position + quaternion)

### Brides → Points de Contrôle
Les brides sont définies dans `BridleComponent.connections` :
```typescript
// Brides gauches
{ from: 'NEZ', to: 'CTRL_GAUCHE', length: 0.65, side: 'left' }
{ from: 'INTER_GAUCHE', to: 'CTRL_GAUCHE', length: 0.65, side: 'left' }
{ from: 'CENTRE', to: 'CTRL_GAUCHE', length: 0.65, side: 'left' }

// Brides droites
{ from: 'NEZ', to: 'CTRL_DROIT', length: 0.65, side: 'right' }
{ from: 'INTER_DROIT', to: 'CTRL_DROIT', length: 0.65, side: 'right' }
{ from: 'CENTRE', to: 'CTRL_DROIT', length: 0.65, side: 'right' }
```

### Barre de Contrôle → Lignes
- **Poignée gauche** : `handles.left` (via `ControlBarSystem.getHandlePositions()`)
- **Poignée droite** : `handles.right`

## Flux de Rendu ECS

```
1. SimulationApp.initializeRendering()
   └─ linesRenderSystem.setScene(scene)
   └─ geometryRenderSystem.initializeEntity(leftLineEntity)  // Crée placeholder
   └─ geometryRenderSystem.initializeEntity(rightLineEntity) // Crée placeholder

2. Chaque frame : SystemManager.updateAll()
   └─ LinesRenderSystem.update()
      ├─ Vérifie si meshes existent
      ├─ Si non : createLineMesh() → ajoute à scène
      └─ Si oui : updateLineGeometry() → met à jour courbe
```

## Architecture ECS Respectée

✅ **Séparation données/logique** :
- `LineComponent` : données physiques (longueur, tension, masse)
- `GeometryComponent` : données géométriques (vide pour lignes dynamiques)
- `VisualComponent` : données visuelles (couleur, diamètre)
- `LinesRenderSystem` : logique de rendu (création/mise à jour meshes)

✅ **Pas de code rustine** :
- Suppression de la création de mesh dans `registerLineEntity()`
- Création centralisée dans `createLineMesh()`
- Mise à jour propre dans `updateLineGeometry()`

✅ **Composants réutilisables** :
- `MeshComponent` stocke l'objet Three.js
- Système peut query/modifier sans dépendance OO

## Résultat Attendu

- ✅ Lignes visibles avec courbure caténaire réaliste
- ✅ Connexion Barre de Contrôle → Points CTRL_GAUCHE/CTRL_DROIT
- ✅ Brides visibles (vertes) reliant NEZ/INTER/CENTRE → CTRL_GAUCHE/CTRL_DROIT
- ✅ Marqueurs rouges sur points de contrôle pour debug
- ✅ Mise à jour temps réel des positions selon physique

## Fichiers Modifiés

1. `/src/ecs/systems/GeometryRenderSystem.ts` - Ajout gestion lignes
2. `/src/ecs/systems/LinesRenderSystem.ts` - Refactoring rendu dynamique
3. `/src/ecs/SimulationApp.ts` - Configuration scène pour lignes
4. `/src/ecs/entities/factories/KiteEntityFactory.ts` - Activation brides visibles
