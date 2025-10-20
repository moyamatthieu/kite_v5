# 🎯 Visualisation des vecteurs normaux des faces

## Activation du mode debug

Pour voir les vecteurs normaux (et toutes les autres forces) :

1. **Lancer la simulation** :
   ```bash
   npm run dev
   ```

2. **Activer le mode debug** :
   - Dans l'interface UI, cocher la case **"Debug Mode"**
   - Ou appuyer sur une touche raccourci si configurée

## Vecteurs affichés

Quand le mode debug est activé, vous verrez pour chaque face du cerf-volant :

| Vecteur | Couleur | Description |
|---------|---------|-------------|
| **Normal** | 🔵 **Bleu foncé** (`0x00008B`) | Direction de la portance (perpendiculaire à la face) |
| Lift | 🔵 Bleu ciel (`0x87CEEB`) | Force de portance calculée |
| Drag | 🔴 Rouge (`0xff0000`) | Force de traînée |
| Gravity | 🟡 Jaune (`0xffff00`) | Gravité distribuée |
| Vent apparent | 🟢 Vert (`0x00ff00`) | Vent apparent local |

## Caractéristiques des normales

### 📏 Longueur fixe
Les vecteurs normaux ont une **longueur fixe de 2 mètres** pour faciliter la visualisation, quelle que soit l'intensité de la force.

### 📍 Position
Chaque vecteur normal part du **centroïde** (centre géométrique) de sa face triangulaire.

### 🧭 Orientation
La normale est **toujours orientée face au vent** grâce au calcul :
```typescript
const dotNW = surfaceNormal.dot(windDir);
return dotNW < 0 ? surfaceNormal.clone().negate() : surfaceNormal.clone();
```

## Les 4 faces du cerf-volant

Vous devriez voir **4 vecteurs normaux** bleu foncé correspondant aux 4 faces :

```
1. leftUpper  → Face supérieure gauche
2. leftLower  → Face inférieure gauche  
3. rightUpper → Face supérieure droite
4. rightLower → Face inférieure droite
```

### Symétrie attendue

Avec un **vent symétrique** (direction 0° ou 180°) :
- `leftUpper` et `rightUpper` devraient avoir des normales symétriques
- `leftLower` et `rightLower` devraient avoir des normales symétriques

### Orientation cohérente

Toutes les normales devraient pointer **vers l'avant** (face au vent), même si les faces ont des orientations initiales différentes.

## 🔍 Vérifications visuelles

### ✅ Ce que vous devez observer :

1. **4 vecteurs bleu foncé** visibles sur le cerf-volant
2. Normales **perpendiculaires aux faces** du cerf-volant
3. Normales **orientées face au vent** (vers l'avant)
4. Symétrie gauche/droite si vent frontal
5. Les vecteurs normaux **suivent le kite** quand il bouge

### ❌ Problèmes potentiels :

- **Moins de 4 vecteurs** → Certaines faces ne sont pas calculées
- **Normales vers l'arrière** → Problème d'orientation (dot product)
- **Asymétrie avec vent frontal** → Problème de géométrie ou calcul
- **Normales non perpendiculaires** → Erreur de calcul de normale

## 🎨 Couleurs de debug complètes

Pour référence, voici toutes les couleurs utilisées dans le debug :

```typescript
// Forces aérodynamiques (par face)
0x00008B  // Bleu foncé  - NORMAL (nouveau !)
0x87CEEB  // Bleu ciel   - Lift (portance)
0xff0000  // Rouge       - Drag (traînée)
0xffff00  // Jaune       - Gravity (gravité)
0x00ff00  // Vert        - Apparent wind (vent apparent)

// Forces des lignes
0xff00ff  // Magenta     - Tensions lignes
0x00ffff  // Cyan        - Forces aux poignées
```

## 📊 Mode debug console

Pour voir également les informations dans la console :

1. Ouvrir `src/ecs/systems/AeroSystem.ts`
2. Ligne 42 : Changer `debugFaces = false` en `true`
3. Relancer la simulation
4. Ouvrir la console (F12)

Vous verrez alors pour chaque face (toutes les secondes) :
```
[AeroSystem] Face: leftUpper
  Normal: (0.00, 1.00, 0.00)
  Wind: (0.71, 0.00, 0.71)
  Dot product: 0.000 (OK)
  Lift dir: (0.00, 1.00, 0.00)
  Alpha: 90.0° | CL: 1.200 | CD: 0.800
```

## 🎯 Utilisation pour validation

Les vecteurs normaux sont essentiels pour valider :

1. **Géométrie correcte** - Les normales sont bien perpendiculaires aux faces
2. **Orientation cohérente** - Toutes les faces pointent face au vent
3. **Symétrie** - Comportement gauche/droite identique si vent symétrique
4. **Physique correcte** - La portance suit bien la normale de la face

## 🚀 Raccourcis pratiques

### Désactiver certains vecteurs

Si vous voulez voir **uniquement les normales**, modifiez `DebugSystem.ts` :
```typescript
// Commenter les lignes des autres vecteurs :
// debugComp.addForceArrow(...); // Lift
// debugComp.addForceArrow(...); // Drag
// etc.

// Garder uniquement :
debugComp.addForceArrow(...); // Normal (bleu foncé)
```

### Changer la longueur des normales

Dans `DebugSystem.ts`, ligne où les normales sont ajoutées :
```typescript
faceForce.normal.clone().multiplyScalar(2.0), // Changer 2.0 pour ajuster
```

### Changer la couleur

```typescript
0x00008B, // Bleu foncé - Remplacer par une autre couleur hex
```

Exemples de couleurs :
- `0x0000FF` - Bleu pur
- `0x000080` - Bleu marine
- `0x4169E1` - Bleu royal
- `0x1E90FF` - Bleu dodger

---

**Date** : 20 octobre 2025  
**Branche** : `fix-lift-orientation`  
**Commit** : 7fffc95  
**Fonctionnalité** : Visualisation des normales en bleu foncé ✅
