# Guide pour les agents IA - Simulateur de cerf-volant V8

Ce document fournit des instructions pour interagir avec la base de code du simulateur de cerf-volant. Le respect de ces directives est essentiel pour maintenir la qualité et la cohérence du code.

## 🏗️ Architecture : Entity-Component-System (ECS) Pure

Le projet utilise une architecture **ECS pure**. Il est crucial de comprendre et de respecter cette séparation stricte :

1.  **Components (`src/ecs/components/`)** :
    *   Ce sont des conteneurs de **données pures** uniquement (par exemple, `PhysicsComponent`, `TransformComponent`).
    *   **Règle :** Ne jamais y ajouter de méthodes ou de logique. Ils doivent être sérialisables (POJO - Plain Old JavaScript Objects).

2.  **Systems (`src/ecs/systems/`)** :
    *   Ils contiennent **toute la logique** du simulateur.
    *   Chaque système opère sur un ensemble d'entités qui possèdent des composants spécifiques. Par exemple, le `PhysicsSystem` met à jour les entités ayant un `PhysicsComponent` et un `TransformComponent`.
    *   **Règle :** L'ordre d'exécution des systèmes est défini dans `src/ecs/SimulationApp.ts`. Cet ordre est critique. Lors de l'ajout d'un nouveau système, insérez-le au bon endroit dans le pipeline de la boucle de simulation (`initializeSystems` et `update`).

3.  **Entities (`src/ecs/entities/`)** :
    *   Les entités sont de simples identifiants. Elles sont assemblées à l'aide de "factories" (usines) dans ce répertoire.
    *   **Règle :** Pour créer un nouvel objet dans la simulation (par exemple, un obstacle), créez une nouvelle usine (par exemple, `ObstacleFactory.ts`) qui attache les composants nécessaires. N'instanciez pas les entités directement dans les systèmes.

## 🔬 Physique et Modèle Aérodynamique

La physique de la simulation est un aspect critique.

-   **Référence Makani** : Le modèle physique est fortement inspiré du projet open-source **Makani** de Google. Le code source se trouve dans `external/makani-master/`. Avant de modifier la physique (`AeroSystem.ts`, `ConstraintSystem.ts`), consultez ce code pour comprendre les algorithmes de calcul des forces (portance/traînée) et des contraintes.
-   **Systèmes clés** :
    *   `WindSystem.ts` : Calcule le vent apparent selon la formule `Vent_apparent = Vent_ambiant - Vitesse_kite + Turbulence`. Le vent est défini dans le plan horizontal XZ (Y = vertical). Synchronisation automatique avec `InputComponent` pour les paramètres UI (vitesse, direction, turbulence).
    *   `AeroSystem.ts` : Calcule les forces aérodynamiques (portance, traînée) en utilisant les données du `WindSystem`.
    *   `ConstraintSystem.ts` : Gère la physique des lignes (tension, amortissement).
    *   `PhysicsSystem.ts` : Intègre les forces pour mettre à jour la position et la vitesse (intégrateur d'Euler).

### Système de coordonnées pour le vent
-   Direction 0° = axe +X (Est)
-   Direction 90° = axe +Z (Sud)
-   Direction 180° = axe -X (Ouest)
-   Direction 270° = axe -Z (Nord)
-   Y = axe vertical (pas de composante horizontale du vent dans Y)

## 🚀 Flux de travail du développeur

Utilisez les commandes npm définies dans `package.json` pour les tâches courantes.

### ⛔ RÈGLE STRICTE : NE JAMAIS EXÉCUTER `npm run dev`

**Ne JAMAIS lancer `npm run dev` automatiquement.** C'est absolument interdit.

**Pourquoi :**
- Le serveur de développement est géré manuellement par l'utilisateur
- Lancer automatiquement le serveur peut créer des conflits de ports
- Le rechargement à chaud (HMR) peut perturber le débogage en cours
- L'utilisateur doit avoir le contrôle total du cycle de vie du serveur
- Les agents IA ne doivent pas interférer avec les processus en arrière-plan

**À faire à la place :**
- ✅ Informer l'utilisateur qu'il doit lancer `npm run dev` lui-même
- ✅ Indiquer l'URL attendue : `http://localhost:3001` (ou 3002 si port occupé)
- ✅ Expliquer que le rechargement à chaud détectera automatiquement les changements

**Référence serveur** :
-   **Démarrage** : `npm run dev` (MANUEL UNIQUEMENT)
    *   Lance le serveur de développement Vite sur `http://localhost:3001` avec rechargement à chaud.

### Autres commandes disponibles

-   **Qualité du code** :
    *   `npm run lint` : Exécute ESLint pour l'analyse statique.
    *   `npm run lint:fix` : Corrige automatiquement les problèmes de style.
    *   `npm run type-check` : Vérifie les types TypeScript.
-   **Build** : `npm run build`
    *   Crée une version de production optimisée dans le répertoire `dist/`.

j'aimerais que tu lise tout le projet en details pour bien comprendre le fonctionnement et objectif global du projet. mais ne te laisse pas influencer par de potentiel erreurs dans le code ou commentaire, la vision global et l'objectif prime


## 🎨 Rendu 3D avec Three.js

-   Le rendu est géré par `RenderSystem.ts` et `GeometryRenderSystem.ts`.
-   Les `MeshComponent` et `GeometryComponent` lient une entité à sa représentation visuelle dans la scène Three.js.
-   Pour modifier l'apparence d'un objet, mettez à jour le matériau (`Material`) ou la géométrie (`BufferGeometry`) associés dans ces composants.

## 📝 Gestion de la documentation

### ⛔ RÈGLE STRICTE : PAS DE FICHIERS MARKDOWN

**Ne JAMAIS créer de fichiers Markdown (.md)** pour la documentation, même temporairement. C'est absolument interdit.

**Pourquoi :**
- Les fichiers .md polluent le repository et créent du debt technique
- Ils ne sont pas maintenus et deviennent rapidement obsolètes
- Ils ne sont pas liés au code, donc impossible à refactoriser avec le code
- Ils créent du bruit dans git history
- Les rapports/analyses doivent rester en conversation ou dans les commits

**Alternative :**
- Documentation intégrée directement dans le code via commentaires **JSDoc/TSDoc**
- Explications ajoutées à ce fichier `copilot-instructions.md`
- Analyses complexes documentées dans les messages de commit avec `git commit -m "long message"`
- Pour les explications détaillées, utiliser les commentaires multi-lignes (`/** ... */`) dans le code

**Exemples interdits :**
- ❌ CONTROL_MECHANISM_ANALYSIS.md
- ❌ DEBUG_CHECKLIST.md
- ❌ SESSION_SUMMARY.md
- ❌ README_DEBUGGING.md
- ❌ LOGGING_GUIDE.md

**Exemples acceptés :**
- ✅ Commentaires JSDoc dans `src/ecs/systems/ConstraintSystem.ts`
- ✅ Sections ajoutées à ce fichier `copilot-instructions.md`
- ✅ Messages de commit détaillés (50+ lignes si nécessaire)
- ✅ Console logs temporaires pendant debug (puis supprimés)

## 🧠 Méthodologie de résolution de problèmes

-   **Utiliser la réflexion structurée** : Avant d'effectuer des modifications importantes ou de déboguer un problème complexe, utilisez l'outil de réflexion séquentielle (`mcp_sequentialthi_sequentialthinking`) pour :
    *   Décomposer le problème en étapes logiques
    *   Analyser les causes possibles
    *   Évaluer les solutions alternatives
    *   Vérifier la cohérence avec l'architecture ECS
    *   Prévoir les impacts sur les autres systèmes
-   **Quand utiliser la réflexion structurée** :
    *   Lors de l'investigation de bugs complexes
    *   Avant d'ajouter un nouveau système ou composant
    *   Lors de modifications affectant l'ordre d'exécution des systèmes
    *   Pour comprendre les interactions entre systèmes
    *   Lors de problèmes de performance ou de rendu
-   **Objectif** : Garantir que chaque décision technique respecte les principes ECS et maintient la cohérence du simulateur.

### ⛔ RÈGLE STRICTE : NE PAS DUPLIQUER, AMÉLIORER L'EXISTANT

**Toujours vérifier l'existant AVANT d'ajouter du nouveau code.** C'est une règle critique.

**Principe fondamental : AMÉLIORER plutôt que DUPLIQUER**

Quand vous identifiez un besoin, la priorité absolue est d'améliorer le code existant plutôt que de créer une nouvelle implémentation. Cela signifie :
- Refactoriser une fonction existante pour la rendre plus générique
- Ajouter des paramètres optionnels à une fonction existante
- Extraire et mutualiser le code commun dans des utilitaires
- Corriger/optimiser l'implémentation existante si elle est imparfaite
- Étendre un système existant avec de nouvelles capacités

**Pourquoi :**
- La duplication de code crée de la dette technique et des bugs
- Les fonctionnalités peuvent déjà exister sous un autre nom ou dans un autre système
- La maintenance devient complexe quand la même logique existe à plusieurs endroits
- Les modifications futures doivent être répliquées partout
- Cela viole le principe DRY (Don't Repeat Yourself)
- L'amélioration progressive maintient la cohérence architecturale
- Un code centralisé est plus facile à tester, déboguer et optimiser

**Processus obligatoire avant d'ajouter une fonctionnalité :**
1. **Rechercher dans la codebase** : Utilisez Grep/Glob pour chercher des implémentations similaires
2. **Analyser les systèmes existants** : Vérifiez si la logique existe déjà dans un autre système
3. **Examiner les composants** : La donnée nécessaire existe peut-être déjà dans un composant
4. **Consulter l'historique git** : Une fonctionnalité similaire a peut-être été supprimée pour une bonne raison
5. **Réutiliser ou étendre** : Préférez toujours étendre/améliorer l'existant plutôt que dupliquer

**Exemples de vérifications à faire :**
- ❌ Ajouter un calcul de distance dans `AeroSystem.ts` sans vérifier `MathUtils.ts`
- ❌ Créer une nouvelle fonction de normalisation de vecteur alors qu'elle existe déjà
- ❌ Implémenter une interpolation sans chercher dans les utilitaires existants
- ❌ Ajouter un système de logging alors qu'il en existe déjà un
- ✅ Chercher "normalize" dans la codebase avant d'implémenter la normalisation
- ✅ Vérifier `MathUtils.ts` avant d'ajouter des calculs mathématiques
- ✅ Analyser les systèmes existants pour comprendre leur responsabilité
- ✅ Étendre une fonction existante avec un paramètre optionnel plutôt que dupliquer

**Actions à privilégier (par ordre de priorité) :**
1. **Réutiliser tel quel** : Utiliser les fonctions existantes dans `src/ecs/utils/` sans modification
2. **Améliorer et généraliser** : Refactoriser une fonction existante pour qu'elle couvre plus de cas d'usage
3. **Étendre** : Ajouter des paramètres optionnels à une fonction existante plutôt que dupliquer
4. **Factoriser** : Extraire le code commun détecté dans plusieurs endroits vers un utilitaire partagé
5. **Corriger** : Si l'implémentation existante a des bugs/limites, la corriger plutôt que la contourner
6. **Créer** : Seulement en dernier recours, si aucune amélioration de l'existant n'est possible

**Questions à se poser systématiquement :**
- ❓ "Cette fonctionnalité existe-t-elle déjà ailleurs ?"
- ❓ "Puis-je améliorer/généraliser le code existant au lieu de dupliquer ?"
- ❓ "Y a-t-il du code similaire que je pourrais factoriser ?"
- ❓ "Pourquoi ne puis-je pas étendre l'existant avec un paramètre optionnel ?"
- ❓ "L'implémentation existante a-t-elle des bugs que je devrais corriger plutôt que contourner ?"

## 🧲 Simulation des cordes (ConstraintSystem.ts)

Le système de contrainte suit l'architecture validée par **Makani (Google X)**.

### Modèle Physique (Makani-Inspired)
Le système implémente des lignes élastiques avec ressort-amortisseur, basé sur le code de Makani (`external/makani-master/sim/models/tether.cc`).

**Architecture validée (Makani)** :
1. **Kite = Corps Rigide Unique**
   - Objet dynamique avec 6 DDL (3 position + 3 rotation)
   - Masse, tenseur d'inertie, centre de masse
   - Toutes les forces accumulées → intégrées ensemble

2. **Brides = Contraintes Géométriques**
   - Points d'attache CTRL calculés par trilatération (BridleConstraintSystem)
   - Pas d'entités dynamiques séparées
   - Font partie du corps rigide

3. **Lignes = Ressort-Amortisseur**
   - **SLACK** (distance < restLength) : Force = 0
   - **TAUT** (distance ≥ restLength) : Force = k×élongation + c×v_radial

**États des lignes** :
1. **Ligne SLACK** (distance < restLength) :
   - Aucune contrainte active, le kite est complètement libre
   - La traînée aérodynamique pousse le kite en Z- (vers l'arrière)
   - Le kite s'éloigne de la barre jusqu'à tendre les lignes
   - Aucune force transmise par les lignes

2. **Ligne TENDUE** (distance ≥ restLength) :
   - Force ressort : F_spring = LINE_STIFFNESS × elongation (Loi de Hooke)
   - Force amortissement : F_damp = PBD_DAMPING × v_radial × LINE_STIFFNESS
   - Force totale appliquée au point CTRL du corps rigide
   - Génère un torque τ = r × F pour l'orientation

**Paramètres configurables :**
- `LINE_STIFFNESS = 8000 N/m` : Rigidité du câble (tensile stiffness)
  - Basé sur Makani : EA / restLength où EA = rigidité axiale (N)
  - 1cm d'élongation → 80N de force (≈8kg de tension)
  - Valeurs typiques : 5000-10000 N/m pour réalisme
  - Trop élevé (>50000) = instabilité numérique
  
- `PBD_DAMPING = 0.04` : Coefficient d'amortissement longitudinal (sans dimension)
  - Basé sur Makani : damping_ratio × sqrt(2 × EA × density)
  - Formule : F_damp = PBD_DAMPING × v_radial × LINE_STIFFNESS
  - À v_radial = 1 m/s : force d'amortissement = 320 N
  - Valeurs typiques : 0.02-0.05 pour câbles réels
  
- `PBD_ITERATIONS = 5` : Nombre d'itérations par frame
  - Uniquement si mode itératif activé
  - 3-5 itérations suffisent pour convergence
  
- `BAUMGARTE_COEF = 0.1` : Stabilization coefficient
  - Compense les erreurs numériques accumulées
  - @deprecated dans l'implémentation force-based actuelle

**Algorithme (Makani-inspired force-based) :**
1. **Détection** : 
   - Calculer distance = ||CTRL_pos - handle_pos||
   - Si distance < restLength → SLACK : return (F = 0)
   - Sinon → TAUT : continuer

2. **Force ressort** (Loi de Hooke) :
   - excess = distance - restLength
   - strain = excess / restLength
   - F_spring = LINE_STIFFNESS × excess

3. **Force amortissement** (longitudinal) :
   - v_radial = -velocity · direction (composante radiale)
   - F_damp = PBD_DAMPING × (-v_radial) × LINE_STIFFNESS

4. **Application force** :
   - F_total = max(0, F_spring + F_damp)
   - kitePhysics.forces.add(F_total × direction)

5. **Génération torque** :
   - r = CTRL_pos - kite_center (bras de levier)
   - τ = r × F_total
   - kitePhysics.torques.add(τ)

6. **Correction vitesse** (optionnel, stabilité) :
   - Si v_radial < -0.5 m/s : réduire composante excessive

**Avantages de l'approche force-based :**
- Physique validée par Makani (Google X)
- Architecture simple : corps rigide + forces externes
- Forces explicites → faciles à logger/déboguer
- Stable avec damping approprié
- Support natif des slack lines
- Génération correcte de torques
- Compatible avec PhysicsSystem (accumulation de forces)

En suivant ces instructions, vous serez en mesure de contribuer efficacement au projet tout en respectant son architecture fondamentale.
