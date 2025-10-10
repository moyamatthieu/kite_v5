# Guide pour Agents IA – Kite

## Convention

### Workflows de développement
- **⚠️ IMPORTANT : NE JAMAIS lancer `npm run dev`** - L'utilisateur a toujours un serveur Vite qui tourne en arrière-plan dans un autre terminal. Utiliser uniquement :
  - `npm run type-check` pour vérifier les types TypeScript
  - `npm run lint` pour vérifier le style de code (et `lint:fix` pour corrections automatiques)
  - `npm run build` pour compiler la production si nécessaire
  - `npm run preview` pour tester le build de production

### Refactorisation progressive
- Lorsqu'il est possible d'améliorer l'organisation du code (découpage en modules, meilleure séparation des responsabilités, etc.), procéder par **petites étapes incrémentales** :
  1. Identifier une amélioration spécifique et isolée
  2. Effectuer la modification atomique
  3. Valider immédiatement avec `type-check` et `lint`
  4. Tester manuellement dans le navigateur (le serveur se recharge automatiquement)
  5. Passer à l'amélioration suivante seulement si tout fonctionne
  - **Jamais de refactorisation massive** : éviter de tout refaire d'un coup pour minimiser les risques de régression

### Code propre et lisible
- Écrire un code **propre, simple, lisible et compréhensible** :
  - Respecter les conventions de nommage explicites (`applyConstraint`, `apparentWind`, etc.).
  - Privilégier les fonctions courtes avec des retours anticipés (early-return) et limiter l'usage de `else`.
  - Éviter les "magic numbers" en utilisant des constantes définies dans `CONFIG` ou des fichiers de configuration dédiés.
  - Documenter les parties complexes avec des commentaires clairs et concis.

### Points de vigilance
- Toujours attendre `KitePhysicsSystem.initialize()` (flag `isCompletePhysicsReady`) avant d'accéder aux contraintes ou forces détaillées ; prévoir un fallback vers `PhysicsSystem` sinon.
- Toute modification de `src/types/index.ts` se propage à l'UI, aux factories et aux systèmes : valider `type-check` + `validate-migration`.
- Lorsqu'on touche aux presets (`src/factories/presets/`), synchroniser avec `CONFIG` pour éviter les divergences de maillage/lignes.


### Refactorisation
- Maintenir l'architecture ECS propre, respecter SOLID, valider chaque modification avec les outils automatisés.
- **DebugRenderer** : Créé uniquement quand le système de rendu est actif, requis par `UIManager` pour l'interface utilisateur.
- Importer via les alias `@/*`, `@core/*`, `@factories/*`, `@types` définis dans `tsconfig.json` / `vite.config.ts` ; aucun chemin relatif profond.
- Les lignes/bridles ne "poussent" pas : on ajuste la géométrie ou les contraintes, jamais une force directe.
- Ajout de systèmes : étendre `BaseSimulationSystem`, définir `priority`, implémenter `initialize/update/reset/dispose`, puis enregistrer dans `SimulationApp.initializeSystems()` et dans les commandes d’UI si besoin.
- Pour le debug visuel, passer par `DebugRenderer` ou les helpers `RenderSystem.createHelper*`. Éviter l’accès brut à la scène Three.js.

_Mettez à jour ce guide dès qu’un workflow, une API publique ou l’architecture change._



