# 🔍 DIAGNOSTIC : Lignes de Contrôle Invisibles

## Problème Identifié

Les lignes de contrôle ne sont **pas visibles** dans la simulation.

## Analyse du Code

### ✅ Implémentation Correcte

1. **LineEntity** (`src/simulation/entities/LineEntity.ts`) :
   - ✅ Crée des tubes avec `TubeGeometry`
   - ✅ Utilise `MeshStandardMaterial` avec couleur verte
   - ✅ Rayon : 0.015m (15mm)
   - ✅ Segments : 20
   - ✅ Émission légère pour visibilité

2. **LinesRenderSystem** (`src/simulation/systems/LinesRenderSystem.ts`) :
   - ✅ `createLineEntity()` ajoute le mesh à la scène : `scene.add(mesh.object3D)`
   - ✅ `update()` recalcule la géométrie chaque frame
   - ✅ Met à jour les couleurs selon les tensions

3. **SimulationApp** (`src/simulation/SimulationApp.ts`) :
   - ✅ Crée deux lignes : `leftLine` et `rightLine`
   - ✅ Configure le système avec kite et control bar
   - ✅ Appelle `update()` à chaque frame

### 🔴 Problèmes Potentiels

#### 1. **Rayon trop petit** (0.015m = 15mm)
- Pour un kite à 15-20m de distance, 15mm de rayon pourrait être **invisible**
- **Comparaison** : Fil de pêche = 0.5mm, corde d'escalade = 10-12mm

#### 2. **Géométrie peut être mal initialisée**
- Dans `LineEntity` constructeur, les points sont tous à `(0,0,0)`
- La géométrie n'est mise à jour que lors du premier `update()`
- Si `update()` n'est pas appelé ou échoue, les lignes restent au point (0,0,0)

#### 3. **Visibilité du mesh**
- `visible: true` est défini dans MeshComponent
- Mais peut être écrasé ou ignoré

#### 4. **Position des handles ou points de contrôle**
- Si `handles.left/right` ou `ctrlLeftWorld/ctrlRightWorld` sont invalides
- Les lignes pourraient être à des positions aberrantes

#### 5. **Ordre de rendu**
- Les lignes sont ajoutées à la scène après le kite
- Pas de problème de z-fighting normalement

## 🔧 Solutions Proposées

### Solution 1 : Augmenter le rayon des lignes (immédiat)

**Fichier** : `src/simulation/config/SimulationConfig.ts`

```typescript
defaults: {
  meshSegments: 4,
  tubeRadius: 0.05, // ← CHANGER de 0.015 à 0.05 (50mm au lieu de 15mm)
  tubeRadialSegments: 8,
  catenarySagFactor: 0.02,
  // ...
}
```

**Impact** : Lignes 3x plus épaisses, devraient être visibles

### Solution 2 : Ajouter logs de debug

**Fichier** : `src/simulation/systems/LinesRenderSystem.ts`

Ajouter dans `update()` :
```typescript
update(_context: SimulationContext): void {
  if (!this.kite || !this.controlBarSystem) {
    console.warn('🔴 LinesRenderSystem: kite ou controlBarSystem manquant');
    return;
  }

  const handles = this.controlBarSystem.getHandlePositions();
  if (!handles) {
    console.warn('🔴 LinesRenderSystem: handles manquants');
    return;
  }

  console.log('✅ LinesRenderSystem update:', {
    handleLeft: handles.left.toArray(),
    handleRight: handles.right.toArray(),
    lineCount: this.lineEntities.size
  });
  
  // ... reste du code
}
```

### Solution 3 : Forcer visibilité et matériau visible

**Fichier** : `src/simulation/entities/LineEntity.ts`

```typescript
const tubeMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000, // ← ROUGE VIF pour debug au lieu de vert
  roughness: 0.8,
  metalness: 0.1,
  emissive: 0xff0000, // ← Émission rouge
  emissiveIntensity: 0.5, // ← Augmenter intensité
  wireframe: false, // ← S'assurer que ce n'est pas en wireframe
  transparent: false,
  opacity: 1.0,
  visible: true
});

tubeMesh.visible = true; // ← Forcer explicitement
```

### Solution 4 : Vérifier que les lignes sont dans la scène

Ajouter dans `createLineEntity()` :
```typescript
createLineEntity(id: string, side: 'left' | 'right', scene: THREE.Scene): LineEntity {
  const entity = new LineEntity(side);
  const mesh = entity.getComponent<MeshComponent>('mesh');
  
  if (mesh) {
    scene.add(mesh.object3D);
    console.log(`✅ Ligne ${side} ajoutée à la scène:`, {
      position: mesh.object3D.position.toArray(),
      visible: mesh.object3D.visible,
      geometry: mesh.object3D.geometry
    });
  } else {
    console.error(`🔴 Ligne ${side}: mesh component manquant!`);
  }
  
  // ... reste
}
```

## 🎯 Plan d'Action Recommandé

1. **Immédiat** : Augmenter `tubeRadius` de 0.015 à 0.05 (ou même 0.1 pour test)
2. **Debug** : Ajouter logs dans `update()` et `createLineEntity()`
3. **Vérification** : Vérifier dans la console si les positions sont valides
4. **Test visuel** : Changer couleur en rouge vif avec émission forte
5. **Si toujours invisible** : Vérifier avec Three.js Inspector (extension Chrome)

## 🧪 Test à Effectuer

```bash
# 1. Modifier tubeRadius dans SimulationConfig.ts
# 2. Lancer la simulation
npm run dev

# 3. Ouvrir console navigateur (F12)
# 4. Chercher les logs "✅ LinesRenderSystem update"
# 5. Vérifier les positions des handles et les compteurs
```

## 📊 Métriques Attendues

Si tout fonctionne :
- Console : `lineCount: 2` (deux lignes créées)
- Console : Positions handles différentes de (0,0,0)
- Visuel : Deux lignes rouges reliant barre de contrôle au kite

## 🔬 Hypothèse Principale

**Les lignes sont probablement trop fines** (15mm de rayon à 15-20m de distance).

**Calcul de l'angle visuel** :
- Rayon ligne : 0.015m
- Distance caméra : ~20m
- Angle = atan(0.015/20) ≈ 0.043° 
- **TROP PETIT pour être visible !**

**Solution** : Rayon de 0.05-0.1m sera visible (angle ~0.14-0.29°)

---

**Date** : 11 Octobre 2025  
**Statut** : 🔴 Lignes invisibles, correction en cours
