# Scripts de Consolidation des Sources

Ce dépôt contient des scripts pour consolider tous les fichiers source du répertoire `src/` dans un seul fichier.

## Scripts Disponibles

### 1. `consolidate_sources.sh` (Simple)
Script de base qui consolide tous les fichiers TypeScript (.ts) et JavaScript (.js) du répertoire `src/`.

**Usage :**
```bash
./consolidate_sources.sh [nom_fichier_sortie]
```

**Exemples :**
```bash
./consolidate_sources.sh                    # Crée consolidated_sources.txt
./consolidate_sources.sh mon_code.txt       # Crée mon_code.txt
```

### 2. `consolidate_sources_advanced.sh` (Avancé)
Script amélioré avec plus d'options pour personnaliser les extensions de fichiers et le format de sortie.

**Usage :**
```bash
./consolidate_sources_advanced.sh [nom_fichier_sortie] [extensions]
```

**Exemples :**
```bash
./consolidate_sources_advanced.sh                    # Par défaut: consolidated_sources.txt avec .ts,.js
./consolidate_sources_advanced.sh code.md ts,js,md   # Fichier .md avec extensions personnalisées
./consolidate_sources_advanced.sh all.txt ts,js,json,md  # Inclure JSON et Markdown
```

## Format du Fichier de Sortie

Le fichier consolidé contient :
- **En-tête** : Informations sur la consolidation (date, répertoire, extensions)
- **Séparateurs** : Chaque fichier est séparé par `=== chemin/relatif/du/fichier ===`
- **Contenu** : Contenu complet de chaque fichier
- **Gestion d'erreurs** : Les fichiers illisibles sont marqués comme `[ERREUR]`

## Exemple de Sortie

```
CONSOLIDATION DES SOURCES - Thu Oct  9 12:37:15 UTC 2025
==================================
Date: Thu Oct  9 12:37:15 UTC 2025
Répertoire: src/
Extensions: ts,js
Machine: Linux buildkitsandbox 5.15.0-119-generic #129-Ubuntu SMP Fri Aug 2 19:25:20 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux

=== base/BaseFactory.ts ===

/**
 * BaseFactory.ts - Factory abstraite pour tous les objets 3D
 */
... contenu du fichier ...

=== core/Node3D.ts ===

/**
 * Node3D.ts - Abstraction Three.js pour les objets 3D
 */
... contenu du fichier ...
```

## Statistiques

Après exécution, le script affiche :
- Nombre total de fichiers traités
- Taille du fichier de sortie
- Nombre de lignes total

## Utilisation Typique

1. **Sauvegarde** : Créer une sauvegarde consolidée de tout le code source
2. **Révision** : Examiner tout le code dans un seul fichier pour revue
3. **Documentation** : Générer un document complet pour référence
4. **Debugging** : Analyser rapidement la structure globale du projet

## Extensions Supportées

- `.ts` : TypeScript
- `.js` : JavaScript
- `.json` : JSON
- `.md` : Markdown
- `.txt` : Texte
- `.css` : CSS
- `.html` : HTML

Les fichiers binaires (images, etc.) sont détectés et marqués comme `[BINAIRE]`.