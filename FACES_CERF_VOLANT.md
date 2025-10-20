# Traitement des 4 faces du cerf-volant

## 🎯 Architecture des faces

Le cerf-volant est composé de **4 surfaces triangulaires** qui forment la toile :

### Définition des faces (KiteFactory.ts)

```typescript
const aeroSurfaces = [
  { name: 'leftUpper',  points: ['NEZ', 'BORD_GAUCHE', 'WHISKER_GAUCHE'] },
  { name: 'leftLower',  points: ['NEZ', 'WHISKER_GAUCHE', 'SPINE_BAS'] },
  { name: 'rightUpper', points: ['NEZ', 'BORD_DROIT', 'WHISKER_DROIT'] },
  { name: 'rightLower', points: ['NEZ', 'WHISKER_DROIT', 'SPINE_BAS'] }
];
```

### Visualisation de la structure

```
        NEZ (nez du cerf-volant)
         /\
        /  \
   BORD_G  BORD_D (bords d'attaque)
      /      \
     /        \
WHISKER_G  WHISKER_D (intermédiaires)
     \        /
      \      /
      SPINE_BAS (base de la spine)
```

### Décomposition en triangles

```
Face leftUpper:              Face rightUpper:
    NEZ                          NEZ
    / \                          / \
   /   \                        /   \
BORD_G--WHISKER_G        BORD_D--WHISKER_D


Face leftLower:              Face rightLower:
    NEZ                          NEZ
    / \                          / \
   /   \                        /   \
WHISKER_G--SPINE_BAS    WHISKER_D--SPINE_BAS
```

## 🔄 Calcul des normales

### Règle de la main droite

Pour chaque triangle, la normale est calculée par produit vectoriel :
```
normale = (B - A) × (C - A)
```

L'ordre des vertices détermine l'orientation initiale de la normale :
- **Sens anti-horaire** (vu de face) → normale pointe **vers l'avant**
- **Sens horaire** (vu de face) → normale pointe **vers l'arrière**

### Orientation automatique

Le système `AeroSystem` ajuste automatiquement l'orientation de chaque normale :

```typescript
private calculateLiftDirection(surfaceNormal: THREE.Vector3, windDir: THREE.Vector3): THREE.Vector3 {
  const dotNW = surfaceNormal.dot(windDir);
  return dotNW < 0 ? surfaceNormal.clone().negate() : surfaceNormal.clone();
}
```

**Garantie** : Quelle que soit l'orientation initiale de la normale, elle sera **toujours orientée face au vent** pour le calcul des forces.

## ✨ Traitement unifié des 4 faces

### Boucle de calcul (AeroSystem.ts)

```typescript
surfaceSamples.forEach(sample => {
  // 1. Vent apparent LOCAL pour cette face
  const localApparentWind = ...;
  
  // 2. Angle d'attaque LOCAL
  const alpha = ...;
  
  // 3. Coefficients aéro CL et CD (dépendent de alpha)
  const CL = this.calculateCL(aero, alpha);
  const CD = this.calculateCD(aero, CL, kiteComp.aspectRatio);
  
  // 4. Direction portance = normale face au vent
  const liftDir = this.calculateLiftDirection(surfaceNormal, localWindDir);
  
  // 5. Forces pour cette face
  const panelLift = liftDir.multiplyScalar(CL × q × area);
  const panelDrag = windDir.multiplyScalar(CD × q × area);
  
  // 6. Couple généré par cette face
  const panelTorque = leverArm.cross(totalForce);
});
```

### Avantages du traitement par face

✅ **Indépendance** : Chaque face calcule ses forces indépendamment  
✅ **Localité** : Vent apparent et angle d'attaque locaux (tient compte de la rotation)  
✅ **Couple naturel** : Émerge de la position des forces  
✅ **Robustesse** : Fonctionne quelle que soit l'orientation du kite  

## 🐛 Mode Debug

Le système inclut un mode debug pour vérifier le traitement de chaque face :

```typescript
// Dans AeroSystem.ts
private debugFaces = false; // Passer à true pour activer

// Active le logging
if (this.debugFaces && this.debugFrameCounter % 60 === 0) {
  console.log(`[AeroSystem] Face: ${sample.descriptor.name}`);
  console.log(`  Normal: (${surfaceNormal.x}, ${surfaceNormal.y}, ${surfaceNormal.z})`);
  console.log(`  Wind: (${localWindDir.x}, ${localWindDir.y}, ${localWindDir.z})`);
  console.log(`  Dot product: ${dotNW} ${isFlipped ? '(FLIPPED)' : '(OK)'}`);
  console.log(`  Lift dir: (${liftDir.x}, ${liftDir.y}, ${liftDir.z})`);
  console.log(`  Alpha: ${alpha}° | CL: ${CL} | CD: ${CD}`);
}
```

### Activation du debug

1. Ouvrir `src/ecs/systems/AeroSystem.ts`
2. Ligne 42 : `private debugFaces = false;` → `true`
3. Lancer la simulation : `npm run dev`
4. Ouvrir la console (F12)
5. Observer les logs toutes les secondes (60 frames)

### Exemple de sortie attendue

```
[AeroSystem] Face: leftUpper
  Normal: (0.00, 1.00, 0.00)
  Wind: (0.71, 0.00, 0.71)
  Dot product: 0.000 (OK)
  Lift dir: (0.00, 1.00, 0.00)
  Alpha: 90.0° | CL: 1.200 | CD: 0.800

[AeroSystem] Face: leftLower
  Normal: (0.00, -0.50, 0.87)
  Wind: (0.71, 0.00, 0.71)
  Dot product: 0.615 (OK)
  Lift dir: (0.00, -0.50, 0.87)
  Alpha: 52.0° | CL: 0.850 | CD: 0.450

[AeroSystem] Face: rightUpper
  Normal: (0.00, 1.00, 0.00)
  Wind: (0.71, 0.00, 0.71)
  Dot product: 0.000 (OK)
  Lift dir: (0.00, 1.00, 0.00)
  Alpha: 90.0° | CL: 1.200 | CD: 0.800

[AeroSystem] Face: rightLower
  Normal: (0.00, -0.50, 0.87)
  Wind: (0.71, 0.00, 0.71)
  Dot product: 0.615 (OK)
  Lift dir: (0.00, -0.50, 0.87)
  Alpha: 52.0° | CL: 0.850 | CD: 0.450
```

## 🎯 Vérifications

### Checklist pour valider le traitement des 4 faces

- [ ] **Nombre de faces** : Exactement 4 surfaces dans `surfaceSamples`
- [ ] **Normales calculées** : Chaque face a une normale valide (length = 1)
- [ ] **Orientation cohérente** : Dot product jamais très négatif (< -0.9)
- [ ] **Forces équilibrées** : leftUpper ≈ rightUpper, leftLower ≈ rightLower (vent symétrique)
- [ ] **Angles cohérents** : Upper faces ont alpha différent des Lower faces
- [ ] **Lift positif** : CL toujours positif quand face au vent

## 📊 Cas particuliers

### 1. Cerf-volant face au vent (alpha = 90°)
- Toutes les faces perpendiculaires au vent
- CL maximal pour toutes
- Forces symétriques gauche/droite
- Pas de couple de rotation

### 2. Cerf-volant en virage (rotation)
- Vitesses locales différentes gauche/droite
- Vents apparents asymétriques
- CL différent pour chaque face
- Couple de rotation naturel

### 3. Cerf-volant décrochage (alpha > alphaStall)
- CL décroît pour les faces en décrochage
- CD augmente
- Comportement stable grâce au traitement par face

## 🏗️ Architecture ECS respectée

```
GeometryComponent (DONNÉES)
├─ points: Map<string, Vector3>  // Positions des vertices
└─ surfaces: GeometrySurface[]   // Définition des triangles

AerodynamicsComponent (DONNÉES)
└─ surfaces: AeroSurfaceDescriptor[]  // Noms et points des faces

AeroSystem (LOGIQUE)
├─ getSurfaceSamples()           // Extraction des 4 faces
├─ computeTriangleNormal()       // Calcul normale par face
├─ calculateLiftDirection()      // Orientation portance par face
└─ update()                      // Traitement unifié des 4 faces
```

## 🎓 Principes clés

1. **Traitement unifié** : Le même algorithme pour les 4 faces
2. **Orientation automatique** : Dot product garantit cohérence
3. **Localité** : Chaque face a son vent apparent et angle d'attaque
4. **Émergence** : Le comportement global émerge des forces locales
5. **Robustesse** : Fonctionne pour toutes orientations du kite

---

**Date** : 20 octobre 2025  
**Branche** : `fix-lift-orientation`  
**Statut** : ✅ Les 4 faces sont correctement traitées
