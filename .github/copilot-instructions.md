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

## 🧲 Simulation des cordes (ConstraintSystem.ts)

Le système de contrainte implémente deux modes pour simuler les lignes de cerf-volant :

### Mode PBD (Position-Based Dynamics) - Amélioré
Le mode PBD est une approche robuste basée sur les contraintes de distance. Implémentation actuelle (feat/improve-pbd-stability) :

**Paramètres configurables :**
- `PBD_STIFFNESS = 0.8` : Fraction de correction appliquée par itération (0.0-1.0)
  - 1.0 = correction complète (très rigide)
  - 0.5 = correction progressive (élastique)
- `PBD_DAMPING = 0.2` : Coefficient d'amortissement (0.1-0.3)
  - Dissipe l'énergie basée sur la vitesse relative
  - Réduit les oscillations non-physiques
- `PBD_ITERATIONS = 3` : Nombre d'itérations par frame
  - Chaque itération améliore la convergence
  - PhysX recommande 120-300 Hz (2-4 itérations à 60 fps)
- `BAUMGARTE_COEF = 0.1` : Stabilization coefficient
  - Compense les erreurs numériques accumulées
  - Prévient la divergence

**Algorithme (par itération) :**
1. Calculer l'élongation: `delta = distance - restLength`
2. Si slack (pas en tension): retourner sans appliquer de forces
3. Calculer forces:
   - Force ressort: `F_spring = k × elongation`
   - Force amortissement: `F_damp = -c × v_radial`
   - Baumgarte: `F_baum = β × elongation`
4. Appliquer la force totale `F_total = max(0, F_spring + F_damp + F_baum)`
5. Générer le torque: `τ = r × F` (pour l'orientation du kite)
6. Projection de position si encore en dépassement

**Avantages du PBD :**
- Stable même avec grands timesteeps
- Support natif des slack lines (cordes molles)
- Contrôle fin de la rigidité via paramètres
- Génération correcte de torques pour la rotation

En suivant ces instructions, vous serez en mesure de contribuer efficacement au projet tout en respectant son architecture fondamentale.
