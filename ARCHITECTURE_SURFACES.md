# 🏗️ Flux de récupération des surfaces dans AeroSystem

## Question: Où AeroSystem récupère-t-il les surfaces?

**Réponse: Il les récupère du `AerodynamicsComponent` qui les reçoit de `KiteFactory`**

## Flux complet

```
KiteSurfaceDefinitions (source unique)
    ↓
KiteFactory.addAerodynamicsComponent()
    ↓
AerodynamicsComponent.surfaces
    ↓
AeroSystem.getSurfaceDescriptors()
    ↓
AeroSystem.getSurfaceSamples()
    ↓
Calcul des forces aérodynamiques
```

## Détail du flux dans le code

### 1️⃣ KiteSurfaceDefinitions - Source unique
```typescript
// KiteSurfaceDefinition.ts
export class KiteSurfaceDefinitions {
  static readonly SURFACES = [
    { id: 'leftUpper', points: ['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE'] },
    { id: 'leftLower', points: ['NEZ', 'SPINE_BAS', 'WHISKER_GAUCHE'] },
    { id: 'rightUpper', points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'] },
    { id: 'rightLower', points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'] }
  ];
}
```

### 2️⃣ KiteFactory crée les 4 surfaces du kite

#### addGeometryComponent() - Pour le rendu
```typescript
private static addGeometryComponent(entity: Entity): void {
  const geometry = new GeometryComponent();
  
  // ... ajouter les points ...
  
  // Utiliser KiteSurfaceDefinitions comme source unique
  KiteSurfaceDefinitions.getAll().forEach(surfaceDefinition => {
    geometry.addSurface(surfaceDefinition.points);
  });
  
  entity.addComponent(geometry);
}
```

#### addAerodynamicsComponent() - Pour les calculs aéro
```typescript
private static addAerodynamicsComponent(entity: Entity): void {
  // Utiliser KiteSurfaceDefinitions comme source unique
  const aeroSurfaces = KiteSurfaceDefinitions.getAll().map(surfaceDefinition => ({
    name: surfaceDefinition.id,
    points: surfaceDefinition.points
  }));

  entity.addComponent(new AerodynamicsComponent({
    coefficients: { /* ... */ },
    surfaces: aeroSurfaces
  }));
}
```

### 3️⃣ AeroSystem récupère les surfaces du AerodynamicsComponent

```typescript
// AeroSystem.ts
private getSurfaceDescriptors(
  aero: AerodynamicsComponent, 
  geometry: GeometryComponent
): AeroSurfaceDescriptor[] {
  // ✅ Option 1: Si AerodynamicsComponent a des surfaces → les utiliser
  if (aero.surfaces.length > 0) {
    return aero.surfaces;  // ← Les surfaces définies dans KiteFactory
  }

  // ⚠️ Option 2 (fallback): Sinon, les reconstruire depuis GeometryComponent
  return geometry.surfaces
    .filter(surface => surface.points.length >= 3)
    .map((surface, index) => ({
      name: surface.points.join('-') || `surface_${index}`,
      points: [surface.points[0], surface.points[1], surface.points[2]]
    }));
}
```

## Comportement réel

Avec la nouvelle architecture:

```
AeroSystem demande les surfaces
    ↓
getSurfaceDescriptors() vérifie aero.surfaces
    ↓
✅ aero.surfaces.length > 0 (vrai!)
    ↓
Retourne directement: aero.surfaces
    ↓
Ces surfaces viennent de KiteFactory → KiteSurfaceDefinitions
```

**Donc AeroSystem NE RECONSTRUIT PAS les surfaces** - il les récupère du composant passé par KiteFactory.

## Avantages de cette architecture

| Avant (avec duplication) | Après (centralisé) |
|---|---|
| ❌ Surfaces définies 2 fois | ✅ Surfaces définies 1 fois |
| ❌ Risque d'incohérence | ✅ Cohérence garantie |
| ❌ Bug possible = ordre différent | ✅ Impossible d'avoir un ordre différent |
| ❌ Difficile à maintenir | ✅ Facile à modifier |

## Diagramme de dépendances

```
┌─────────────────────────────┐
│ KiteSurfaceDefinitions      │  ← Source unique de vérité
│  (4 surfaces avec ordre)    │
└──────────────┬──────────────┘
               │
               ├─────────────────────┬─────────────────────┐
               ↓                     ↓                     ↓
    ┌──────────────────────┐  ┌──────────────────────┐
    │ addGeometryComponent │  │ addAerodynamicsComp. │
    │   (KiteFactory)      │  │   (KiteFactory)      │
    └──────────┬───────────┘  └──────────┬───────────┘
               │                         │
               ↓                         ↓
    ┌──────────────────────┐  ┌──────────────────────┐
    │ GeometryComponent    │  │ AerodynamicsComponent│
    │  .surfaces[]         │  │  .surfaces[]         │
    │  (pour rendu)        │  │  (pour calculs aéro) │
    └──────────┬───────────┘  └──────────┬───────────┘
               │                         │
               └─────────────┬───────────┘
                             ↓
                    ┌──────────────────────┐
                    │   AeroSystem         │
                    │ .getSurfaceSamples() │
                    │ (utilise les 2)      │
                    └──────────────────────┘
```

## Que se passe-t-il en détail dans AeroSystem

### Étape 1: Obtenir les descripteurs
```typescript
const surfaceSamples = this.getSurfaceSamples(aero, geometry, kite);
```

### Étape 2: Pour chaque surface, calculer les normales monde
```typescript
const descriptors = this.getSurfaceDescriptors(aero, geometry);
// Retourne directement aero.surfaces depuis KiteFactory

descriptors.forEach(descriptor => {
  // descriptor.points = ['NEZ', 'WHISKER_GAUCHE', 'BORD_GAUCHE']
  
  // Récupérer les positions monde des points
  const worldPoints = descriptor.points.map(name => 
    geometry.getPointWorld(name, entity)
  );
  
  // Calculer la normale
  const normal = this.computeTriangleNormal(p1, p2, p3);
  
  // Ajouter au sample
  samples.push({ descriptor, area, centroid, normal });
});
```

### Étape 3: Utiliser les surfaces pour les calculs aéro
```typescript
surfaceSamples.forEach((sample) => {
  const normal = sample.normal;  // Normale en coordonnées monde
  
  // Calcul de la portance basé sur cette normale
  const liftDir = this.calculateLiftDirection(normal, localWindDir);
  
  // Application des forces
  const panelLift = liftDir.clone().multiplyScalar(CL * q * sample.area);
  // ...
});
```

## Conclusion

✅ **AeroSystem récupère les surfaces du AerodynamicsComponent** qui lui sont passées par KiteFactory lors de la création du kite. Il ne les reconstruit **jamais**.

✅ **Pas de duplication**: L'ordre des vertices vient d'une seule source (KiteSurfaceDefinitions), donc pas de risque d'incohérence.

✅ **Facile à modifier**: Si on veut changer l'ordre des vertices ou ajouter une surface, on le fait dans `KiteSurfaceDefinitions` et c'est automatiquement utilisé partout.
