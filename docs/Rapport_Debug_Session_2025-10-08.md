# Rapport de Session de Débogage et d'Optimisation - Simulation de Kite

**Date :** 8 octobre 2025
**Objectif :** Analyser, diagnostiquer et corriger le comportement de vol instable du kite dans la simulation.

---

## Résumé Exécutif

La session a permis de transformer un kite non fonctionnel (chute systématique) en un modèle de vol stable et physiquement cohérent. Nous avons procédé par itérations, en analysant les logs de la simulation pour identifier et corriger plusieurs problèmes fondamentaux liés à l'aérodynamisme, la stabilité dynamique et la configuration initiale.

**État Final :** Le kite est maintenant stable, capable de s'élever et de se maintenir au zénith. Une imperfection subsiste au démarrage (une plongée initiale avant l'ascension), dont la cause a été identifiée.

---

### Phase 1 : Diagnostic de la Chute Initiale (Crash au sol)

*   **Symptôme (basé sur `log1`) :** Au lancement, le kite tombe directement au sol sans jamais générer de portance suffisante.
*   **Analyse :**
    1.  La force de **Traînée (Drag)** était 6 fois supérieure à la **Portance (Lift)**.
    2.  Les points de contrôle du bridage (`CTRL_GAUCHE`/`DROIT`) étaient positionnés trop en avant (Z positif), donnant au kite un angle d'attaque initial négatif.
*   **Diagnostic :** Le kite était configuré pour être "poussé" vers le bas et l'arrière, au lieu d'être soulevé.
*   **Correction Appliquée :**
    1.  Modification de `src/simulation/config/KiteGeometry.ts` : Les points `CTRL_...` ont été reculés (coordonnée Z passée de `0.4` à `-0.2`).
    2.  Modification de `src/simulation/config/SimulationConfig.ts` : Le ratio des coefficients a été inversé (`liftScale` augmenté à `1.8`, `dragScale` réduit à `1.0`).

---

### Phase 2 : Diagnostic de l'Instabilité en Vol (Autorotation)

*   **Symptôme (basé sur `log2`) :** Suite à la première correction, le kite vole mais devient violemment instable après quelques secondes, partant en rotation incontrôlée (vitesse angulaire explosant à plus de 40 rad/s).
*   **Analyse :**
    1.  Le coefficient de portance (`liftScale: 1.8`) était trop élevé, rendant le kite "hyper-réactif" à la moindre variation d'angle.
    2.  L'amortissement en rotation (`angularDragFactor: 2.0`) était largement insuffisant pour contrer les couples violents générés par cette portance excessive.
*   **Diagnostic :** Le système était dynamiquement instable, créant un cycle de sur-correction menant à l'oscillation et à la perte de contrôle.
*   **Correction Appliquée :**
    1.  Modification de `src/simulation/config/SimulationConfig.ts` pour "calmer" le système :
        *   `liftScale` a été réduit de `1.8` à **`1.5`**.
        *   `dragScale` a été ajusté à **`1.2`**.
        *   `angularDragFactor` a été significativement augmenté de `2.0` à **`5.0`**.

---

### Phase 3 : Vol Stable et Analyse de la "Plongée" Initiale

*   **Symptôme (basé sur `log3`) :** Le kite est maintenant stable et vole correctement jusqu'au zénith. Cependant, il effectue toujours une plongée jusqu'au sol avant de commencer son ascension.
*   **Analyse Approfondie :**
    1.  Au démarrage (`t=0`), un **couple initial négatif** sur l'axe X (`Couple total: -2.46 N⋅m`) est présent. Ce couple force le nez du kite à piquer vers le bas.
    2.  Ce couple est généré par la force de **traînée** qui s'applique sur le Centre de Pression (CP), ce dernier étant situé **au-dessus** du Centre de Masse (CM) dans la configuration de départ.
    3.  Le kite ne peut pas simplement reculer sous l'effet de la traînée car les lignes se tendent quasi-instantanément, créant une force de tension opposée.
*   **Diagnostic Final :** Le kite est "piégé" au démarrage. Ne pouvant reculer, le mouvement dominant devient la rotation induite par le couple initial. Il pique du nez, perd sa portance et chute. Ce n'est que lorsque le contact avec le sol (ou la tension extrême des lignes) le force à se réorienter qu'il peut enfin s'élever.

---

### Prochaine Étape Planifiée

Pour valider ce dernier diagnostic, il a été décidé d'enrichir les logs.

*   **Action Requise :** Modifier `src/simulation/physics/PhysicsEngine.ts` pour ajouter les informations suivantes à l'affichage console :
    1.  La tension des lignes gauche et droite.
    2.  La distance entre les points de contrôle du kite (`CTRL_...`) et les poignées de la barre.

Cela permettra de visualiser numériquement la mise en tension des lignes et de confirmer qu'elle empêche bien le kite de reculer au démarrage.
