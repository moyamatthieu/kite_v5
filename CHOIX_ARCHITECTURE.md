# 🎯 CHOIX D'ARCHITECTURE - Simulation V5

**Date** : 19 octobre 2025  
**Objectif** : Définir le modèle physique et l'architecture pour résoudre les oscillations

---

## 📋 INSTRUCTIONS

Pour chaque section, **coche une seule case** `[x]` selon ton choix.  
Laisse des commentaires si besoin après `<!-- -->`.

---

## 1️⃣ MODÈLE DE LIGNE - Comportement Physique

### Question : Comment une ligne doit-elle se comporter ?

- [ ] **Option A : Pivot Libre Simple**
  ```typescript
  if (distance > restLength) {
    force = stiffness × (distance - restLength);
  } else {
    force = 0; // Ligne molle
  }
  ```
  - ✅ Simple et stable
  - ✅ Utilisé par V3 avec succès
  - ❌ Pas de preTension (moins réaliste ?)

- [ ] **Option B : Dyneema avec preTension comme Force**
  ```typescript
  const extension = distance - restLength;
  force = preTension + stiffness × extension;
  // Force minimale même au repos
  ```
  - ✅ Ligne toujours "sous tension"
  - ❌ Peut créer forces négatives → oscillations
  - ❌ C'était notre modèle actuel (qui oscille)

- [ ] **Option C : Dyneema avec preTension comme Longueur Effective**
  ```typescript
  const effectiveLength = restLength - (preTension / stiffness);
  const extension = distance - effectiveLength;
  if (extension > 0) {
    force = stiffness × extension;
  } else {
    force = 0;
  }
  ```
  - ✅ preTension réduit longueur de repos
  - ✅ Pas de forces négatives
  - ⚠️ Nécessite clarification concept preTension

- [ x] **Option D : Autre modèle (à décrire)**
  <!--de slignes simple, pivot libre aux extréminté, les extrémité peuvent s'attacher a des point, dans notre projet au handle et au point de controle du kite, la pyramide des bride. pas de tension lorsque les distance sont inferieurs a la distance regler par la config, pas d'etirement lorsqu'une tension est appliquer dessus, propage les tension en bidirectionnel instentanement dans effet ressort -->

**Commentaires** :
<!-- Explique pourquoi ce choix -->

---

## 2️⃣ VALEUR DE STIFFNESS - Raideur des Lignes

### Question : Quelle valeur de raideur utiliser ?

- [x ] **Option A : Stiffness Réaliste Dyneema (2200 N/m)**
  - ✅ Physiquement réaliste pour Dyneema 15m
  - ❌ Nécessite peut-être PBD pour stabilité
  - ⚠️ C'est ce qu'on avait (avec oscillations)

- [ ] **Option B : Stiffness Très Élevée V3 (25000 N/m)**
  - ✅ V3 stable avec cette valeur
  - ✅ Forces dominantes → correction rapide
  - ❌ Moins réaliste (×11 plus raide)

- [ ] **Option C : Stiffness Intermédiaire (~5000-10000 N/m)**
  - ⚖️ Compromis réalisme/stabilité
  - ⚠️ À tester

- [ ] **Option D : Stiffness Variable selon Type**
  - Lignes principales : `_____` N/m
  - Bridles : `_____` N/m
  <!-- Remplis les valeurs -->

**Commentaires** :
<!-- Note : la raideur et plus une tension maximal que la ligne peut supporter avant de laché, sinon elle transmet simplement la tension, ne s'etire pas -->

---

## 3️⃣ SYSTÈME DE BRIDLES - Architecture

### Question : Comment implémenter les bridles ?

- [x ] **Option A : Bridles = Contraintes Géométriques (Actuel)**
  ```
  BridleConstraintSystem calcule positions CTRL via trilatération
  → CTRL_GAUCHE/DROIT sont forcés à des positions précises
  ```
  - ✅ Déjà implémenté
  - ✅ Contrôle précis de la géométrie
  - ❌ Peut entrer en conflit avec physique des lignes
  - ❌ V3 n'utilise pas ça

- [ ] **Option B : Bridles = Lignes Physiques (6 LineComponents)**
  ```
  NEZ, INTER, CENTRE (fixes sur kite) 
    → 3 bridles gauche → CTRL_GAUCHE (point libre)
    → 3 bridles droite → CTRL_DROIT (point libre)
  Position CTRL émerge de l'équilibre des forces
  ```
  - ✅ Physiquement cohérent (tout est force-based)
  - ✅ CTRL peut bouger naturellement
  - ❌ Plus complexe (8 contraintes au lieu de 2)
  - ⚠️ Nécessite peut-être PBD

- [ ] **Option C : Bridles Simplifiées (Points Fixes comme V3)**
  ```
  CTRL_GAUCHE et CTRL_DROIT = points fixes dans géométrie kite
  Pas de système de bridles dynamique
  ```
  - ✅ Très simple et stable (V3 fonctionne ainsi)
  - ✅ Moins de calculs
  - ❌ Perd le contrôle dynamique angle d'attaque
  - ❌ Pas de réglage bridles en vol

- [ ] **Option D : Hybride**
  <!-- Décris ton approche hybride -->

**Commentaires** :
<!-- Important : on reste avec l'option A pour les bride actuel, on regle deja le probleme des lignes -->

---

## 4️⃣ DAMPING - Amortissement Physique

### Question : Quel modèle de damping utiliser ?

- [ ] **Option A : Damping Multiplicatif (V3)**
  ```typescript
  velocity *= linearDamping; // 0.92 = 8% perte par frame
  ```
  - ✅ Simple et stable
  - ✅ V3 l'utilise avec succès
  - ⚠️ Dépend du framerate (mais OK si stable)

- [ x] **Option B : Damping Exponentiel (Actuel)**
  ```typescript
  velocity *= Math.exp(-damping × dt);
  ```
  - ✅ Indépendant du framerate
  - ✅ Physiquement plus correct
  - ⚠️ On l'a déjà mais oscillations persistent ( commentaire : pas forcement le damping le probleme, plutot les lignes qui font un effets ressort )

- [ ] **Option C : Damping Hybride**
  - Multiplicatif pour velocity globale
  - Exponentiel pour forces de lignes
  <!-- Précise les valeurs -->

**Valeurs de damping préférées** :
- Linear damping : `_____` (ex: 0.92)
- Angular damping : `_____` (ex: 0.85)
- Line damping : `_____` N·s/m (ex: 0.05)

**Commentaires** :

---

## 5️⃣ LISSAGE TEMPOREL - Force Smoothing

### Question : Faut-il lisser les forces dans le temps ?

- [ ] **Option A : Lissage Temporel V3 (FORCE_SMOOTHING = 0.15)**
  ```typescript
  smoothedForce.lerp(currentForce, 0.85);
  // Utilise smoothedForce au lieu de currentForce pour intégration
  ```
  - ✅ Empêche variations brutales
  - ✅ V3 l'utilise (stable)
  - ⚠️ Ajoute un léger délai (réaliste ?)

- [ ] **Option B : Pas de Lissage (Actuel)**
  - Forces instantanées appliquées directement
  - ❌ Variations brutales → oscillations possibles
  - ✅ Plus réactif

- [ x] **Option C : Lissage Ajustable**
  - Facteur de lissage : `_____` (0.0 = pas de lissage, 1 = fort lissage)

**Commentaires** :

---

## 6️⃣ LIMITES DE SÉCURITÉ - Safety Limits

### Question : Doit-on limiter les grandeurs physiques ?

- [ ] **Option A : Limites V3 (MAX_FORCE, MAX_VELOCITY, etc.)**
  ```typescript
  MAX_FORCE = 1000 N
  MAX_VELOCITY = 30 m/s
  MAX_ACCELERATION = 100 m/s²
  MAX_ANGULAR_VELOCITY = 25 rad/s
  ```
  - ✅ Empêche explosions numériques
  - ✅ V3 l'utilise
  - ⚠️ Peut "clamper" comportements réalistes

- [ x] **Option B : Pas de Limites (Actuel)**
  - ✅ Physique "pure" sans bridage
  - ❌ Risque de NaN / explosions

- [ ] **Option C : Limites sur Lignes Uniquement**
  - Juste `maxTension` sur les lignes
  - Pas de limites sur velocities

**Commentaires** :

---

## 7️⃣ SOLVER DE CONTRAINTES - Méthode d'Intégration

### Question : Quelle méthode pour résoudre les contraintes ?

- [ ] **Option A : Force-Based (Actuel)**
  ```
  1. Calculer forces (aéro + lignes + gravité)
  2. Intégrer : a = F/m, v += a×dt, pos += v×dt
  ```
  - ✅ Simple à comprendre et déboguer
  - ✅ Architecture ECS actuelle compatible
  - ❌ Peut être instable si mal paramétré
  - ⚠️ Nécessite stiffness élevé pour stabilité

- [x ] **Option B : Position-Based Dynamics (PBD)**
  ```
  1. Prédire position : predPos = pos + v×dt
  2. Résoudre contraintes géométriquement
  3. Calculer nouvelle vitesse : v = (predPos - pos)/dt
  ```
  - ✅ Très stable (garantit contraintes)
  - ✅ V3 l'utilise
  - ❌ Plus complexe à implémenter (~1-2 jours)
  - ❌ Change ordre systèmes ECS

- [ ] **Option C : Force-Based Amélioré**
  - Force-based mais avec tous les tricks V3 :
    - Stiffness élevé
    - Lissage temporel
    - Limites de sécurité
    - Damping optimisé
  - ⚖️ Compromis : stabilité sans refonte architecture

**Commentaires** :
<!-- ça m'inquiete de changer l'architecture, mais on peux essayer -->

---

## 8️⃣ PARAMÈTRES DE MASSE/INERTIE

### Question : Quelles valeurs utiliser ?

- [ ] **Option A : Valeurs Réalistes Actuelles**
  ```
  mass = 0.12 kg (léger, réaliste)
  inertia = {Ixx: 0.0315, Iyy: 0.0042, Izz: 0.0110} kg·m²
  ```
  - ✅ Physiquement réaliste
  - ⚠️ Kite léger = plus sensible aux forces

- [ ] **Option B : Valeurs V3 (Plus Lourdes)**
  ```
  mass = 0.28 kg (×2.3 plus lourd)
  inertia = 0.08 kg·m² (scalaire simplifié)
  ```
  - ✅ V3 stable avec ces valeurs
  - ❌ Moins réaliste
  - ✅ Plus de "momentum" → moins d'oscillations

- [ x] **Option C : valeur calculer avec les dimention de kite factory**
  - mass = `_____` kg
  - inertia = `_____` kg·m²

**Commentaires** :

---

## 9️⃣ PLAN D'ACTION - Stratégie d'Implémentation

### Question : Par quoi commencer ?

- [ ] **Plan A : Test Rapide Paramètres V3**
  1. Changer juste stiffness → 25000
  2. Supprimer preTension
  3. Tester → voir si oscillations disparaissent
  - 🕐 Temps : 30 minutes
  - ⚠️ Risque : Peut ne pas suffire

- [ ] **Plan B : Adoption Complète Modèle V3**
  1. Tous paramètres V3 (stiffness, damping, mass)
  2. Ajouter lissage temporel
  3. Ajouter limites de sécurité
  4. Simplifier bridles (points fixes)
  5. Tester progressivement
  - 🕐 Temps : 3-4 heures
  - ✅ Forte probabilité de succès

- [ ] **Plan C : Force-Based Amélioré avec Bridles Physiques**
  1. Adopter paramètres V3
  2. Transformer bridles en LineComponents
  3. Ajouter lissage + limites
  4. Tester et ajuster
  - 🕐 Temps : 6-8 heures
  - ⚠️ Complexité élevée (8 contraintes)

- [ ] **Plan D : Implémentation PBD**
  1. Créer nouveau système PBDConstraintSystem
  2. Réorganiser ordre d'exécution systèmes
  3. Implémenter solver itératif
  4. Migrer contraintes de lignes
  5. (Optionnel) Ajouter bridles physiques après
  - 🕐 Temps : 1-2 jours
  - ✅ Solution robuste long terme
  - ❌ Gros investissement

**Commentaires** :
<!-- Quelle stratégie te semble la plus appropriée ? -->

---

## 🎯 DÉCISION FINALE

### Résumé de mes choix :

**Modèle de ligne** : Option `___`  
**Stiffness** : Option `___` (valeur: `_____` N/m)  
**Bridles** : Option `___`  
**Damping** : Option `___`  
**Lissage** : Option `___`  
**Limites** : Option `___`  
**Solver** : Option `___`  
**Masse/Inertie** : Option `___`  
**Plan d'action** : Plan `___`

### Justification / Notes :
<!-- Explique la cohérence globale de tes choix -->

---

## 📝 QUESTIONS OUVERTES

Liste ici toute question ou clarification nécessaire avant implémentation :

1. 
2. 
3. 

---

**Date de complétion** : `___________`  
**Validé par** : `___________`
