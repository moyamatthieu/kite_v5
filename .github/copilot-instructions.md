# Guide pour Agents IA – Kite## Convention## Workflows de développement
- **⚠️ IMPORTANT : NE JAMAIS lancer `npm run dev`** - L'utilisateur a toujours un serveur Vite qui tourne en arrière-plan dans un autre terminal. Utiliser uniquement :
	- `npm run type-check` pour vérifier les types TypeScript
	- `npm run lint` pour vérifier le style de code (et `lint:fix` pour corrections automatiques)
	- `npm run build` pour compiler la production si nécessaire
	- `npm run preview` pour tester le build de production
- **Refactorisation progressive** : Lorsqu'il est possible d'améliorer l'organisation du code (découpage en modules, meilleure séparation des responsabilités, etc.), procéder par **petites étapes incrémentales** :
	1. Identifier une amélioration spécifique et isolée
	2. Effectuer la modification atomique
	3. Valider immédiatement avec `type-check` et `lint`
	4. Tester manuellement dans le navigateur (le serveur se recharge automatiquement)
	5. Passer à l'amélioration suivante seulement si tout fonctionne
	- **Jamais de refactorisation massive** : éviter de tout refaire d'un coup pour minimiser les risques de régression
- Aucun test automatisé n'est maintenu pour la physique : la validation se fait par analyse scientifique et inspection de la simulation.
- Les fichiers sous `archive/` et `external/` sont historiques ou read-only : ne pas éditer sauf migration explicite.les## Points de vigilance
- Toujours attendre `KitePhysicsSystem.initialize()` (flag `isCompletePhysicsReady`) avant d'accéder aux contraintes ou forces détaillées ; prévoir un fallback vers `PhysicsSystem` sinon.
- Toute modification de `src/types/index.ts` se propage à l'UI, aux factories et aux systèmes : valider `type-check` + `validate-migration`.
- Lorsqu'on touche aux presets (`src/factories/presets/`), synchroniser avec `CONFIG` pour éviter les divergences de maillage/lignes.
- Les composants legacy (héritage V7) ne servent qu'au rendu : n'y ajoutez pas de logique physique et retirez-les seulement avec solution de remplacement.
- **Refactorisation** : Maintenir l'architecture ECS propre, respecter SOLID, valider chaque modification avec les outils automatisés.
- **DebugRenderer** : Créé uniquement quand le système de rendu est actif, requis par `UIManager` pour l'interface utilisateur.porter via les alias `@/*`, `@core/*`, `@factories/*`, `@types` définis dans `tsconfig.json` / `vite.config.ts` ; aucun chemin relatif profond.
- Fonctions courtes avec early-return, très peu de `else`, nommage explicite (`applyConstraint`, `apparentWind`, etc.).
- Les lignes/bridles ne "poussent" pas : on ajuste la géométrie ou les contraintes, jamais une force directe.
- Ajout de systèmes : étendre `BaseSimulationSystem`, définir `priority`, implémenter `initialize/update/reset/dispose`, puis enregistrer dans `SimulationApp.initializeSystems()` et dans les commandes d’UI si besoin.
- Pour le debug visuel, passer par `DebugRenderer` ou les helpers `RenderSystem.createHelper*`. Éviter l’accès brut à la scène Three.js.

## Principes SOLID et bonnes pratiques de refactorisation
- **S**ingle Responsibility : Chaque système ECS a une responsabilité unique et clairement définie.
- **O**pen/Closed : Les systèmes sont extensibles via héritage sans modification du code existant.
- **L**iskov Substitution : Tous les systèmes dérivent de `BaseSimulationSystem` et sont interchangeables.
- **I**nterface Segregation : `SimulationControls` expose uniquement les méthodes nécessaires à l'UI.
- **D**ependency Inversion : `SimulationApp` injecte les dépendances, pas les systèmes qui les demandent.
- **Refactorisation atomique** : Modifications incrémentales, validation à chaque étape avec `type-check` et `lint`. **Jamais de changements massifs.**
- **Amélioration continue** : Quand une opportunité d'amélioration se présente (meilleure organisation, séparation des responsabilités), la saisir **immédiatement mais par petites étapes** pour éviter de casser le code.
- **Pas de compatibilité legacy** : Code entièrement nouveau, sans héritage des versions précédentes.
- **Encapsulation stricte** : Accès aux systèmes uniquement via leurs APIs publiques, jamais directement.ator V8

## Vue d’ensemble
- **Architecture ECS propre** : Simulation temps réel TypeScript + Three.js avec séparation claire des responsabilités selon les principes SOLID.
- **Orchestration centralisée** : `SimulationApp` gère le cycle de vie des systèmes ECS (`Physics`, `Wind`, `Input`, `Render`, `KitePhysics`) sans logique métier.
- **Physique émergente** : Le comportement du kite est déterminé par les contraintes PBD des lignes/bridles, avec seulement gravité + aérodynamique comme forces explicites.
- **Modèle scientifique** : La physique repose exclusivement sur `KitePhysicsSystem` pour la cohérence et la précision.

## Architecture clé (Refactorisée - Architecture Propre)
- **Entrée** : `src/main.ts` → export `Simulation` depuis `src/simulation.ts` → `SimulationApp.initialize()` → `start()`.
- **Systèmes ECS** : Tous dérivés de `BaseSimulationSystem` avec priorité d'exécution. Chaque système a une responsabilité unique (SRP).
- **Injection de dépendances** : `SimulationApp` crée et injecte les dépendances sans couplage fort entre systèmes.
- **Interface de contrôle** : `SimulationControls` expose l'API publique via `UIManager`, garantissant l'encapsulation.
- **Physique spécialisée** : Sous `src/simulation/physics/` avec PBD, contraintes et aérodynamique. `KitePhysicsSystem.initialize()` async - attendre `isCompletePhysicsReady`.
- **Modèles 3D** : Suivent `StructuredObject` avec factories pour géométries/bridles (`src/factories/`, `src/objects/organic/Kite.ts`).

## Flux & intégrations
- `UIManager` (`src/simulation/ui/UIManager.ts`) ne touche jamais directement les systèmes : exposez toute nouvelle commande via `SimulationControls` créé dans `SimulationApp`.
- `ControlBarManager` et `DebugRenderer` (dans `src/simulation/rendering/`) se branchent via l’API `RenderSystem` : utilisez ses helpers `addToScene`/`removeFromScene` plutôt que `scene.add` direct.
- Les constantes physiques proviennent de `CONFIG`, `PhysicsConstants`, `KiteGeometry` sous `src/simulation/config/`. Ne créez pas de magics numbers dans les systèmes.
- Logging centralisé via `Logger.getInstance()` (`src/utils/Logging.ts`) ; préférez-le aux `console.log` sauf debug ponctuel balisé.

## Workflows de développement
- Installer les dépendances puis utiliser les scripts `package.json` :
	- `npm run dev` (serveur Vite, lancé par l’utilisateur), `npm run build`, `npm run preview`.
	- `npm run type-check` et `npm run lint` pour sécuriser les modifications ; `lint:fix` autorisé pour corrections rapides.
- Aucun test automatisé n’est maintenu pour la physique : la validation se fait par analyse scientifique et inspection de la simulation.
- Les fichiers sous `archive/` et `external/` sont historiques ou read-only : ne pas éditer sauf migration explicite.

## Conventions locales
- Importer via les alias `@/*`, `@core/*`, `@factories/*`, `@types` définis dans `tsconfig.json` / `vite.config.ts` ; aucun chemin relatif profond.
- Fonctions courtes avec early-return, très peu de `else`, nommage explicite (`applyConstraint`, `apparentWind`, etc.).
- Les lignes/bridles ne “poussent” pas : on ajuste la géométrie ou les contraintes, jamais une force directe.
- Ajout de systèmes : étendre `BaseSimulationSystem`, définir `priority`, implémenter `initialize/update/reset/dispose`, puis enregistrer dans `SimulationApp.initializeSystems()` et dans les commandes d’UI si besoin.
- Pour le debug visuel, passer par `DebugRenderer` ou les helpers `RenderSystem.createHelper*`. Éviter l’accès brut à la scène Three.js.

## Points de vigilance
- Toujours attendre `KitePhysicsSystem.initialize()` (flag `isCompletePhysicsReady`) avant d’accéder aux contraintes ou forces détaillées ; prévoir un fallback vers `PhysicsSystem` sinon.
- Toute modification de `src/types/index.ts` se propage à l’UI, aux factories et aux systèmes : valider `type-check` + `validate-migration`.
- Lorsqu’on touche aux presets (`src/factories/presets/`), synchroniser avec `CONFIG` pour éviter les divergences de maillage/lignes.
- Les composants legacy (héritage V7) doivent être nettoyés.

_Mettez à jour ce guide dès qu’un workflow, une API publique ou l’architecture change._



