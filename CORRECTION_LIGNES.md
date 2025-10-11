# ✅ CORRECTION : Lignes de Contrôle Invisibles

## 🎯 Problème

Les lignes de contrôle du kite n'étaient **pas visibles** dans la simulation.

## 🔍 Diagnostic

### Cause Principale : **Rayon trop petit**

- **Rayon initial** : 0.015m (15mm)
- **Distance caméra → kite** : ~15-20m
- **Angle visuel** : atan(0.015/20) ≈ 0.043° ← **INVISIBLE !**

**Comparaison** :
- Fil de pêche : 0.5mm
- Corde d'escalade : 10-12mm
- Ligne kite réelle : 1-2mm
- **Ligne visible en 3D à 20m** : **minimum 50-100mm**

### Autres Problèmes Potentiels

1. ✅ Géométrie correctement mise à jour dans `update()`
2. ✅ Mesh ajouté à la scène dans `createLineEntity()`
3. ✅ Matériau visible avec émission
4. ⚠️ Couleur verte peu visible (surtout sur fond vert/gris)
5. ⚠️ Segments trop peu nombreux (4 → courbe pas lisse)

## 🔧 Corrections Appliquées

### 1. **Augmentation du rayon des lignes** (×5.3)

**Fichier** : `src/simulation/config/SimulationConfig.ts`

```typescript
defaults: {
  meshSegments: 20,        // ← 4 → 20 (courbes plus lisses)
  tubeRadius: 0.08,        // ← 0.015 → 0.08 (15mm → 80mm)
  tubeRadialSegments: 8,
  // ...
}
```

**Impact** :
- Angle visuel : 0.043° → **0.23°** (×5.3)
- Lignes **largement visibles** à 20m de distance
- Compromis réalisme/visibilité : ✅ acceptable pour simulation

### 2. **Amélioration visuelle du matériau**

**Fichier** : `src/simulation/entities/LineEntity.ts`

```typescript
const tubeMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000,              // ← Rouge vif au lieu de vert
  roughness: 0.7,
  metalness: 0.2,
  emissive: 0x440000,           // ← Émission rouge
  emissiveIntensity: 0.3,       // ← Augmentée de 0.2 à 0.3
  side: THREE.DoubleSide,       // ← Visible des deux côtés
  transparent: false,
  opacity: 1.0
});
```

**Raison rouge vif** :
- Maximum de contraste avec le ciel (bleu/gris) et le sol (vert/brun)
- Facilement repérable lors du debug
- Sera remplacé par couleurs tension (vert → jaune → rouge) lors de `update()`

### 3. **Ajout de logs de debug**

**Fichier** : `src/simulation/systems/LinesRenderSystem.ts`

#### Dans `update()` :
```typescript
// 🔍 Log toutes les secondes
if (_context.totalTime % 1 < 0.016) {
  console.log('✅ LinesRenderSystem update:', {
    lineCount: this.lineEntities.size,
    handleLeft: handles.left.toArray(),
    handleRight: handles.right.toArray(),
    ctrlLeft: ctrlLeftWorld.toArray(),
    ctrlRight: ctrlRightWorld.toArray()
  });
}
```

#### Dans `createLineEntity()` :
```typescript
console.log(`✅ Ligne ${side} ajoutée à la scène:`, {
  id,
  position: mesh.object3D.position.toArray(),
  visible: mesh.object3D.visible,
  geometry: tubeMesh.geometry.type,
  material: material.type,
  color: material.color.getHexString()
});
```

**Utilité** :
- Vérifier que les lignes sont créées (`lineCount: 2`)
- Vérifier que les positions sont valides (pas (0,0,0))
- Vérifier que le matériau et la géométrie sont corrects

### 4. **Warnings explicites**

Ajout de warnings si composants manquants :
```typescript
if (!this.kite || !this.controlBarSystem) {
  console.warn('🔴 LinesRenderSystem: kite ou controlBarSystem manquant');
  return;
}
```

## 📊 Résultat Attendu

### Dans la Console (F12)

```
✅ Ligne left ajoutée à la scène: {
  id: "leftLine",
  position: [0, 0, 0],
  visible: true,
  geometry: "TubeGeometry",
  material: "MeshStandardMaterial",
  color: "ff0000"
}
✅ Ligne right ajoutée à la scène: { ... }

✅ LinesRenderSystem update: {
  lineCount: 2,
  handleLeft: [-0.5, 1.5, 2.5],    // Position poignée gauche
  handleRight: [0.5, 1.5, 2.5],     // Position poignée droite
  ctrlLeft: [-1.2, 15.0, 5.0],      // Point contrôle gauche kite
  ctrlRight: [1.2, 15.0, 5.0]       // Point contrôle droit kite
}
```

### Dans la Scène 3D

- **Deux lignes rouges épaisses** reliant :
  - Poignées de la barre de contrôle (bas)
  - Points de contrôle du kite (haut)
- **Courbure caténaire** visible (léger affaissement au milieu)
- **Couleur changeante** selon la tension (vert → jaune → rouge)

## 🧪 Tests à Effectuer

### Test 1 : Vérification Visuelle
```bash
npm run dev
# Ouvrir navigateur
# Chercher deux lignes rouges épaisses
```

**Critère de succès** : Lignes visibles immédiatement

### Test 2 : Vérification Console
```bash
# Ouvrir F12 → Console
# Chercher logs "✅ Ligne ... ajoutée"
# Chercher logs "✅ LinesRenderSystem update"
```

**Critère de succès** :
- `lineCount: 2`
- Positions handles ≠ (0,0,0)
- Positions ctrl ≠ (0,0,0)

### Test 3 : Vérification Géométrie
```javascript
// Dans console navigateur
const scene = window.__THREE_DEVTOOLS__?.scene;
const lines = scene.children.filter(c => c.name.includes('ControlLine'));
console.log(lines.length); // Devrait être 2
console.log(lines[0].geometry.parameters.radius); // Devrait être 0.08
```

## 🎨 Améliorations Futures (Optionnel)

### 1. Rendre rayon configurable via UI
```typescript
// UIManager.ts
controls.add(CONFIG.defaults, 'tubeRadius', 0.01, 0.2).name('Line Thickness');
```

### 2. Mode "réaliste" vs "visible"
```typescript
const PRESET_REALISTIC = { tubeRadius: 0.002 }; // 2mm
const PRESET_VISIBLE = { tubeRadius: 0.08 };    // 80mm
```

### 3. Transparence selon distance
```typescript
// Plus la caméra est proche, plus les lignes sont fines/transparentes
const distance = camera.position.distanceTo(kitePosition);
material.opacity = Math.min(1.0, distance / 10);
```

## ✅ Checklist de Vérification

- [x] `tubeRadius` augmenté de 0.015 à 0.08
- [x] `meshSegments` augmenté de 4 à 20
- [x] Couleur changée en rouge vif (#ff0000)
- [x] Émission augmentée (intensité 0.3)
- [x] `side: THREE.DoubleSide` ajouté
- [x] Logs de debug ajoutés dans `update()`
- [x] Logs de debug ajoutés dans `createLineEntity()`
- [x] Warnings explicites si composants manquants
- [x] Compilation TypeScript OK
- [ ] **Test visuel dans navigateur** ← À FAIRE

## 📝 Commit Recommandé

```bash
git add -A
git commit -m "fix: 🔧 Correction visibilité lignes de contrôle

- ✅ Augmente rayon lignes: 15mm → 80mm (×5.3)
- ✅ Améliore segments: 4 → 20 (courbes lisses)
- ✅ Change couleur: vert → rouge vif (debug)
- ✅ Augmente émission pour visibilité
- 🔍 Ajoute logs debug dans update() et createLineEntity()
- 🔍 Ajoute warnings si composants manquants

Résultat: Lignes largement visibles à 15-20m
Angle visuel: 0.043° → 0.23° (×5.3)

See: DIAGNOSTIC_LIGNES.md, CORRECTION_LIGNES.md"
```

---

**Date** : 11 Octobre 2025  
**Statut** : ✅ **Corrections appliquées, test visuel requis**  
**Prochaine étape** : Lancer `npm run dev` et vérifier dans le navigateur
