# Plan de Rationalisation Config.ts 🔄

**Branche** : `refactor/config-cleanup`  
**Date** : 20 octobre 2025  
**Objectif** : Éliminer les redondances et améliorer la clarté du Config.ts

---

## 📋 Audit des Redondances

### 1. **RenderConfig - Doublons Caméra** ⚠️

#### Ancien format (DÉPRÉCIÉ)
```typescript
// Ligne 321-333
export const CAMERA_DISTANCE_M = 25;      // Utilisé dans CONFIG uniquement
export const CAMERA_HEIGHT_M = 10;
export const CAMERA_TARGET_X = 0;
export const CAMERA_TARGET_Y = 5;
export const CAMERA_TARGET_Z = 8;
```

#### Nouveau format (ACTIF)
```typescript
// Ligne 302-317
export const CAMERA_POSITION_X = 13.37;   // Position directe Vector3
export const CAMERA_POSITION_Y = 11.96;
export const CAMERA_POSITION_Z = 0.45;
export const CAMERA_LOOKAT_X = -3.92;     // Point visé directe
export const CAMERA_LOOKAT_Y = 0;
export const CAMERA_LOOKAT_Z = -12.33;
```

#### Impact
- **Ancien format** : Utilisé UNIQUEMENT dans `CONFIG.render` pour compatibilité
- **Nouveau format** : Format directe, plus intuitif
- **Décision** : Supprimer ancien format, mettre à jour CONFIG

---

### 2. **Constantes COLOR** ✅

```typescript
KiteSpecs.COLOR = 0xff3333      // Rouge kite
BridleConfig.COLOR = 0xff0000   // Rouge bridles
LineSpecs.COLOR = 0x0000ff      // Bleu lignes
```

**Statut** : OK - Contextes distincts, pas de confusion

---

### 3. **Constantes MASS_KG** ✅

```typescript
KiteSpecs.MASS_KG = 0.12        // Masse kite (kg)
PilotSpecs.MASS_KG = 75         // Masse pilote (kg)
```

**Statut** : OK - Valeurs complètement différentes, contextes clairs

---

### 4. **Constantes PRIORITY** ✅

```typescript
UIConfig.PRIORITY = 90           // UI system priority
WindConfig.PRIORITY = 20         // Wind system priority
```

**Statut** : OK - Systèmes différents, pas d'ambiguïté

---

## 🎯 Actions Recommandées

### Phase 1 : Nettoyage RenderConfig

#### ✅ À FAIRE
1. Supprimer les anciennes constantes (L321-333) de RenderConfig
2. Mettre à jour l'objet `CONFIG` pour utiliser le nouveau format
3. Valider que seul CONFIG.render les utilisait

#### ✅ RÉSULTAT ATTENDU
```typescript
// Avant : 6 constantes + 5 dans CONFIG = 11 références
// Après  : 6 constantes seulement = -5 références

// Avant (dans CONFIG.render)
cameraDistance: RenderConfig.CAMERA_DISTANCE_M,
cameraHeight: RenderConfig.CAMERA_HEIGHT_M,
cameraTarget: new THREE.Vector3(CAMERA_TARGET_X, CAMERA_TARGET_Y, CAMERA_TARGET_Z),

// Après (dans CONFIG.render)
cameraPosition: new THREE.Vector3(CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z),
cameraLookAt: new THREE.Vector3(CAMERA_LOOKAT_X, CAMERA_LOOKAT_Y, CAMERA_LOOKAT_Z),
```

---

### Phase 2 : Rationalisation CANVAS

#### Observation actuelle
```typescript
export const CANVAS_SMALL_SIZE = 128;
export const CANVAS_LARGE_SIZE = 512;
export const CANVAS_SMALL_CENTER = CANVAS_SMALL_SIZE / 2;       // = 64
export const CANVAS_LARGE_CENTER = CANVAS_LARGE_SIZE / 2;       // = 256
```

#### Problème
Les CENTER sont calculés, pas vraiment des "constantes"

#### Options
1. **Garder comme maintenant** : Lisibilité explicite
2. **Supprimer** : Les recalculer où nécessaire
3. **Créer une structure** : `CanvasConfig = { SMALL: { size: 128, center: 64 } }`

**Recommandation** : Garder actuellement (utile pour debug)

---

### Phase 3 : Documentation des Namespaces

#### État actuel : 14 namespaces

| Namespace | Constantes | État | Dups? |
|-----------|-----------|------|-------|
| PhysicsConstants | 5 | ✅ Clean | Non |
| KiteSpecs | 18 | ✅ Clean | Non |
| BridleConfig | 4 | ✅ Clean | Non |
| LineSpecs | 10 | ✅ Clean | Non |
| AeroConfig | 11 | ✅ Clean | Non |
| EnvironmentConfig | 5 | ✅ Clean | Non |
| PilotSpecs | 5 | ✅ Clean | Non |
| InitConfig | 6 | ✅ Clean | Non |
| SimulationConfig | 4 | ✅ Clean | Non |
| RenderConfig | 11 (6 + 5 à supprimer) | ⚠️ À nettoyer | Oui |
| DebugConfig | 17 | ✅ Clean | Non |
| UIConfig | 7 | ✅ Clean | Non |
| WindConfig | 10 | ✅ Clean | Non |

**Total après nettoyage** : ~160 → ~155 constantes

---

## 🔧 Implémentation

### Étape 1 : Identifier les usages
```bash
grep -r "CAMERA_DISTANCE_M\|CAMERA_HEIGHT_M\|CAMERA_TARGET" src/
# Résultat : AUCUN dans src/ (seulement dans CONFIG)
```

### Étape 2 : Supprimer les anciennes constantes
- Supprimer L321-333 de RenderConfig

### Étape 3 : Mettre à jour CONFIG
- Remplacer l'objet `CONFIG.render` pour utiliser nouveau format

### Étape 4 : Valider
```bash
npm run type-check    # TypeScript strict
npm run lint          # ESLint
npm run build         # Production build
```

---

## ✨ Bénéfices

| Aspect | Avant | Après |
|--------|-------|-------|
| **Clarté** | Format mixte | Format unifié |
| **Constantes** | 160 | 155 |
| **Redondance** | 5 valeurs inutiles | 0 |
| **Maintenance** | 2 formats caméra | 1 format |
| **Confusion** | Possible (ancien/nouveau) | Impossible |

---

## 📌 Status

- [ ] Phase 1 : Nettoyage RenderConfig
- [ ] Phase 2 : Validation TypeScript
- [ ] Phase 3 : Validation build
- [ ] Phase 4 : PR review
- [ ] Phase 5 : Merge

---

**Prochaines étapes** : Commencer Phase 1 du nettoyage RenderConfig
