# Plan de Correction Aérodynamique - Kite V5

## 🎯 Objectif
Corriger le modèle aérodynamique pour qu'il soit cohérent avec la physique d'un cerf-volant (surface plane), pas celle d'un avion.

## ✅ Corrections Appliquées

### ✅ Correction 1 : Calcul de l'angle d'attaque (Commit: 42d7b9c)
**Branche:** `feat/fix-aero-physics`

**Problème identifié:**
- Utilisait l'axe X local (envergure) au lieu de la normale de la surface
- Donnait un angle d'attaque ~0° alors que le kite avait un pitch de 5°

**Solution appliquée:**
```typescript
// Avant (INCORRECT)
const chord = new THREE.Vector3(1, 0, 0).applyQuaternion(transform.quaternion);
const alpha = Math.asin(chord.dot(windDir)) * 180 / Math.PI;

// Après (CORRECT)
const faceNormal = sample.normal.clone();
const angleNormalWind = Math.acos(faceNormal.dot(localWindDir)) * 180 / Math.PI;
const alpha = 90 - angleNormalWind; // Angle entre le plan et le vent
```

**Impact:**
- Les angles d'attaque devraient maintenant afficher des valeurs réalistes (5-15°)
- Chaque face a son propre angle calculé correctement

**À tester:**
- [ ] Le kite vole-t-il toujours ?
- [ ] Les valeurs d'angle d'attaque sont-elles dans une plage réaliste (5-20°) ?
- [ ] Le comportement global est-il stable ?

---

## 📋 Corrections À Appliquer (Prochaines Sessions)

### 🔄 Correction 2 : Directions des forces aérodynamiques
**Priorité:** HAUTE  
**Risque:** MOYEN (peut changer significativement le comportement)

**Problème identifié:**
```typescript
// Code actuel (ligne 137-142)
const liftDir = surfaceNormal.clone(); // ❌ Incorrect !
const dragDir = localWindDir.clone();  // ✓ Correct
```

**Problème:** Le lift (portance) est appliqué selon la normale de la surface, ce qui n'est pas correct en aérodynamique.

**Définitions correctes:**
- **Lift (portance)** : Force perpendiculaire au vent apparent
- **Drag (traînée)** : Force parallèle au vent apparent (dans le sens du vent)

**Solution proposée:**
```typescript
// Repère aérodynamique standard
const dragDir = localWindDir.clone(); // ✓ Parallèle au vent

// Calculer la direction perpendiculaire au vent (dans le plan vertical)
const worldUp = new THREE.Vector3(0, 1, 0);
const sideDir = new THREE.Vector3()
  .crossVectors(localWindDir, worldUp)
  .normalize();

const liftDir = new THREE.Vector3()
  .crossVectors(sideDir, localWindDir)
  .normalize();
// Lift perpendiculaire au vent, composante verticale positive
```

**Étapes d'application:**
1. Créer un commit de sauvegarde
2. Appliquer la modification
3. Tester le vol du kite
4. Ajuster les coefficients si nécessaire (CLAlpha, CD0, etc.)
5. Si ça casse : `git revert` et réfléchir à une approche progressive

**Fichier à modifier:** `src/ecs/systems/AeroSystem.ts` (lignes ~125-145)

---

### 🔄 Correction 3 : Cohérence du modèle physique
**Priorité:** MOYENNE  
**Risque:** FAIBLE

**À vérifier:**
- [ ] Les coefficients CL et CD sont-ils appropriés pour un cerf-volant ?
  - CLAlpha = 0.105/° (semble OK)
  - CD0 = 0.08 (parasite drag, à vérifier)
  - alpha0 = -2° (portance nulle)
  - alphaOptimal = 12° (angle optimal)

- [ ] La gravité est-elle bien distribuée par face ?
  - Actuellement : `gravityPerFace = gravity × (mass × area) / totalArea` ✓

- [ ] Les couples (torques) sont-ils correctement calculés ?
  - Actuellement : `torque = leverArm × force` ✓

---

### 🎨 Amélioration 4 : Visualisation debug
**Priorité:** BASSE  
**Risque:** NUL

**Ajouts proposés:**
- [ ] Afficher les vecteurs de lift/drag dans DebugSystem
- [ ] Afficher la normale de chaque face
- [ ] Afficher le vent apparent local par face
- [ ] Code couleur pour les angles d'attaque (vert = optimal, rouge = décrochage)

---

## 🧪 Plan de Test

### Tests après Correction 2 (Directions forces)

**Test 1 : Vol stationnaire**
- Vent : 12 m/s
- Attendre stabilisation
- Vérifier : altitude stable, angle d'attaque ~5-15°, tensions équilibrées

**Test 2 : Réponse aux commandes**
- Tirer ligne gauche → le kite doit tourner à gauche
- Tirer ligne droite → le kite doit tourner à droite
- Comportement attendu : réactif mais pas instable

**Test 3 : Variation du vent**
- Augmenter le vent à 15 m/s → le kite doit monter
- Diminuer le vent à 8 m/s → le kite doit descendre
- Pas de crash, pas d'oscillations folles

**Test 4 : Angles extrêmes**
- Forcer un angle d'attaque > alphaOptimal (12°)
- Vérifier le décrochage (CL diminue)
- Le kite doit chuter mais se stabiliser

---

## 📊 Métriques de Référence (Avant Corrections)

**État actuel (commit 42d7b9c):**
- Angle d'attaque affiché : ~0° (incorrect, maintenant corrigé)
- Portance : ~10 N
- Traînée : ~4 N
- Ratio L/D : ~2.5
- Altitude stable : ~11.5 m
- Tensions lignes : ~4.5 N chacune

**Valeurs attendues après Correction 2:**
- Angle d'attaque : 5-15°
- Portance : 8-12 N (peut varier)
- Traînée : 3-5 N
- Ratio L/D : 2-3 (normal pour un kite)
- Altitude : devrait rester stable
- Tensions : 4-6 N (équilibrées)

---

## 🔧 Commandes Git Utiles

### Revenir à un état antérieur si problème
```bash
# Voir l'historique
git log --oneline

# Revenir au commit précédent (annuler dernière modif)
git revert HEAD

# Retour au commit spécifique (état avant corrections)
git checkout 4b3bd45  # État avec angles d'attaque par face
```

### Comparer les branches
```bash
# Comparer avec la branche principale
git diff feat/ecs-active feat/fix-aero-physics

# Voir les fichiers modifiés
git diff --name-only feat/ecs-active
```

### Fusionner si tout fonctionne
```bash
git checkout feat/ecs-active
git merge feat/fix-aero-physics
git push origin feat/ecs-active
```

---

## 📝 Notes de Session

**Date:** 30 octobre 2025  
**État:** Pause après Correction 1  
**Branche actuelle:** `feat/fix-aero-physics`

**Prochaine étape:**
1. Tester le comportement avec la Correction 1 appliquée
2. Noter les observations (angles, stabilité, comportement)
3. Si OK → Appliquer Correction 2
4. Si KO → Analyser et ajuster

**Questions en suspens:**
- Les directions de lift/drag actuelles fonctionnent-elles "par chance" ?
- Faut-il ajuster les coefficients aéro après la Correction 2 ?
- Le modèle simplifié (surface plane) est-il suffisant ou faut-il modéliser les bridages ?

---

## 🎓 Références Théoriques

**Aérodynamique d'un cerf-volant:**
- Modèle simplifié : surface plane avec angle d'attaque
- Force normale : Fn = q × S × Cn(α)
- Décomposition : L = Fn cos(α), D = Fn sin(α)

**Vs Aérodynamique d'un avion:**
- Profil aérodynamique (cambre, épaisseur)
- CL et CD mesurés en soufflerie
- Portance perpendiculaire à la vitesse (pas à la surface)

**Le cerf-volant est plus proche d'une plaque plane que d'une aile d'avion !**

---

## ✅ Checklist de Reprise

- [x] Commit de l'état actuel
- [x] Création de la branche `feat/fix-aero-physics`
- [x] Application Correction 1 (angle d'attaque)
- [x] Commit Correction 1
- [ ] Test Correction 1
- [ ] Application Correction 2 (directions forces)
- [ ] Test Correction 2
- [ ] Ajustement coefficients si nécessaire
- [ ] Merge dans `feat/ecs-active`
- [ ] Push sur GitHub

**Bon courage pour la suite ! 🚀**
