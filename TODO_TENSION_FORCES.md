# TODO - Implémentation Forces de Tension pour BRIDES

Branche : `feature/tension-forces-physics`  
Document de design : `docs/TENSION_FORCES_DESIGN.md`

**IMPORTANT:** Les lignes principales restent des contraintes PBD (inchangées).  
Ce projet ajoute UNIQUEMENT des forces de tension pour les **brides** (stabilisation interne).

---

## 🎯 Sprint 1 : Foundation (3-5 jours)

### Créer TensionForceCalculator.ts
- [ ] Créer fichier `src/simulation/physics/TensionForceCalculator.ts`
- [ ] Définir interface `TensionForceResult`
- [ ] ~~Implémenter `calculateLineForce()`~~ **ANNULÉ** - lignes restent PBD
- [ ] Implémenter `calculateBridleForces()`
  - [ ] Force au point de départ (ex: NEZ)
  - [ ] Force au point d'arrivée (ex: CTRL_GAUCHE)
  - [ ] Action-réaction (forces opposées)
  - [ ] Calcul couples pour chaque extrémité
- [ ] Export clean des fonctions

### Tests Unitaires
- [ ] Créer `tests/unit/TensionForceCalculator.test.ts`
- [ ] ~~Test : ligne verticale → force vers le bas~~ **ANNULÉ**
- [ ] ~~Test : ligne horizontale → force latérale~~ **ANNULÉ**
- [ ] Test : bride en tension → forces opposées (action-réaction)
- [ ] Test : bride au repos → forces nulles
- [ ] Test : conservation moment (torque)
- [ ] Test : bride NEZ tendue → tire nez vers arrière

---

## 🎯 Sprint 2 : Intégration (3-5 jours)

### Modifier PhysicsEngine
- [ ] Importer `TensionForceCalculator`
- [ ] ~~Créer méthode `calculateLineForces()`~~ **ANNULÉ** - lignes inchangées
- [ ] Créer méthode privée `calculateBridleForces(kite)`
  - [ ] Récupérer les 6 brides depuis BridleSystem
  - [ ] Calculer force pour chaque bride
  - [ ] Sommer toutes les forces
  - [ ] Sommer tous les couples
  - [ ] Retourner { totalForce, totalTorque }
- [ ] Modifier `update()` pour inclure forces brides
  - [ ] Appeler `calculateBridleForces()`
  - [ ] Ajouter au totalForce existant
  - [ ] Ajouter au totalTorque existant

### Adapter ConstraintSolver
- [ ] ~~Modifier `enforceLineConstraints()`~~ **INCHANGÉ** - comportement actuel correct
  - Les lignes Dyneema quasi-inextensibles → contraintes strictes = OK
- [ ] Modifier `enforceBridleConstraints()`
  - [ ] Ne corriger que si distance > maxLength * 1.02 (2% marge)
  - [ ] Retirer correction stricte pour distance normale
  - [ ] Laisser forces de brides gérer la stabilisation
  - [ ] Commenter le changement de comportement
- [ ] Garder `enforceGroundConstraint()` inchangé

### ~~Accès aux Lignes depuis LineSystem~~ **ANNULÉ**
- Pas nécessaire - lignes inchangées

---

## 🎯 Sprint 3 : Configuration & Tuning (5-7 jours)

### Paramètres de Config
- [ ] Ajouter section `bridleTensionForces` dans `SimulationConfig.ts`
  - [ ] `enabled: boolean` — toggle global
  - [ ] ~~`lineForceWeight: number`~~ **ANNULÉ**
  - [ ] `bridleForceWeight: number` — poids forces brides (0-1)
  - [ ] `forceSmoothingFactor: number` — lerp temporel (0.85)
  - [ ] `minTensionThreshold: number` — tension min (2 N pour brides)
  - [ ] Section `pbd` avec seuils sécurité brides
- [ ] Utiliser ces params dans PhysicsEngine

### UI Controls pour Tuning
- [ ] ~~Ajouter slider "Line Force Weight"~~ **ANNULÉ**
- [ ] Ajouter slider "Bridle Force Weight" (0-100%)
- [ ] Ajouter toggle "Enable Bridle Forces"
- [ ] Afficher forces brides dans HUD
  - [ ] Force brides totale (N)
  - [ ] Tensions individuelles par bride
  - [ ] Angle d'attaque stabilisé

### Tests Manuels
- [ ] **Test Hovering** : kite stable au zénith
  - [ ] Oscillations < 10 cm
  - [ ] Angle d'attaque stable
  - [ ] Tensions équilibrées
- [ ] **Test Turn Gauche** : réponse aux commandes
  - [ ] Tension gauche ↑
  - [ ] Tension droite ↓
  - [ ] Rotation cohérente
- [ ] **Test Stabilisation** : perturbation angle
  - [ ] Retour équilibre < 2s
  - [ ] Pas d'oscillations excessives
- [ ] **Test Rafale** : vent fort soudain
  - [ ] PBD empêche sur-extension
  - [ ] Pas de crash

### Tuning Itératif
- [ ] Ajuster `lineForceWeight` pour équilibre optimal
- [ ] Ajuster `bridleForceWeight` pour stabilisation
- [ ] Ajuster `forceSmoothingFactor` contre oscillations
- [ ] Ajuster seuils PBD pour sécurité
- [ ] Documenter valeurs finales

---

## 🎯 Sprint 4 : Validation & Documentation (2-3 jours)

### Tests de Régression
- [ ] Vérifier que l'ancien comportement est reproduit avec weight=0
- [ ] Comparer métriques avant/après
  - [ ] Framerate (doit rester 60 FPS)
  - [ ] Temps calcul tensions (< 2 ms)
  - [ ] Stabilité simulation
- [ ] A/B testing : toggle enable/disable

### Documentation
- [ ] Mettre à jour `.github/copilot-instructions.md`
  - [ ] Modifier section Data Flow
  - [ ] Expliquer nouveau modèle hybride
  - [ ] Documenter toggle et params
- [ ] Créer `docs/TENSION_FORCES_IMPLEMENTATION.md`
  - [ ] Résumé changements
  - [ ] Exemples de code
  - [ ] Paramètres recommandés
  - [ ] Troubleshooting
- [ ] Mettre à jour commentaires dans PhysicsEngine
- [ ] Ajouter docstrings sur TensionForceCalculator

### Préparation Merge
- [ ] Nettoyer console.log de debug
- [ ] Vérifier TypeScript compile sans erreurs
- [ ] Vérifier ESLint (si configuré)
- [ ] Commit final propre
- [ ] Préparer PR description

---

## 📊 Critères de Validation Finale

### Physique
- [ ] ✅ Kite stable au repos (pas de drift)
- [ ] ✅ Réponse fluide aux commandes (< 3s)
- [ ] ✅ Angle d'attaque stabilisé par brides
- [ ] ✅ Pas d'explosions numériques

### Performance
- [ ] ✅ 60 FPS stable
- [ ] ✅ Calculs < 2 ms par frame
- [ ] ✅ Pas de memory leaks

### Code Quality
- [ ] ✅ TypeScript compile sans warnings
- [ ] ✅ Commentaires clairs sur algorithmes
- [ ] ✅ Documentation à jour
- [ ] ✅ Tests unitaires passent

### UX
- [ ] ✅ Toggle fonctionnel (on/off)
- [ ] ✅ Sliders réactifs
- [ ] ✅ HUD affiche tensions
- [ ] ✅ Visualisation lignes/brides par couleur

---

## 🐛 Bugs Connus / Issues à Surveiller

### À Vérifier
- [ ] Instabilité quand tension > maxTension (clamp?)
- [ ] Oscillations haute fréquence avec smoothing faible
- [ ] Comportement au sol (ground constraint + forces)
- [ ] Interaction forces brides entre elles (cycles?)

### Edge Cases
- [ ] Ligne complètement molle (distance < length)
- [ ] Kite à l'envers (quaternion flip)
- [ ] Deltatime très grand (pause → resume)
- [ ] Vent négatif (kite recule)

---

## 📝 Notes de Développement

### Décisions Architecturales
- **Pourquoi hybrid PBD + Forces ?**
  - Forces = comportement réaliste (90% du temps)
  - PBD = sécurité absolue (cas extrêmes)
  - Double couche de sécurité

- **Pourquoi TensionForceCalculator séparé ?**
  - Séparation des responsabilités (SRP)
  - Facilite tests unitaires
  - Réutilisable pour autres objets volants

- **Pourquoi smoothing des forces ?**
  - Évite oscillations haute fréquence
  - Simule élasticité matériaux
  - Stabilité numérique

### Alternatives Considérées
- ❌ **PBD pur** : pas assez réaliste, pas de gradation
- ❌ **Forces pures** : risque instabilité sans contraintes
- ✅ **Hybride** : meilleur des deux mondes

---

**Créé :** 3 octobre 2025  
**Statut :** 🟢 Prêt à démarrer Sprint 1  
**Prochaine action :** Créer `TensionForceCalculator.ts`
