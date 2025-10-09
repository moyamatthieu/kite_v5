#!/bin/bash#!/bin/bash



# Script simplifié pour consolider tous les fichiers source# Script amélioré pour consolider tous les fichiers source

# Usage: ./consolidate_sources_advanced.sh [output_file] [extensions]# Usage: ./consolidate_sources.sh [output_file] [file_extensions]

# Exemple: ./consolidate_sources_advanced.sh code.md ts,js,md# Exemples:

#   ./consolidate_sources.sh                    # consolidated_sources.txt avec .ts,.js

OUTPUT_FILE="${1:-consolidated_sources.txt}"#   ./consolidate_sources.sh all_sources.txt    # fichier personnalisé avec .ts,.js

EXTENSIONS="${2:-ts,js}"#   ./consolidate_sources.sh code.md ts,js,md   # fichier .md avec extensions personnalisées



echo "🔄 Consolidation des fichiers source..."OUTPUT_FILE="${1:-consolidated_sources.txt}"

echo "📁 Répertoire source: src/"EXTENSIONS="${2:-ts,js}"

echo "📄 Fichier de sortie: $OUTPUT_FILE"

echo "🔍 Extensions: $EXTENSIONS"echo "🔄 Consolidation des fichiers source..."

echo ""echo "📁 Répertoire source: src/"

echo "📄 Fichier de sortie: $OUTPUT_FILE"

# Fonction pour traiter un fichierecho "🔍 Extensions: $EXTENSIONS"

process_file() {echo ""

    local file="$1"

    local relative_path="${file#src/}"# Convertir les extensions en pattern find

IFS=',' read -ra EXT_ARRAY <<< "$EXTENSIONS"

    echo "=== $relative_path ===" >> "$OUTPUT_FILE"FIND_ARGS=()

    echo "" >> "$OUTPUT_FILE"for ext in "${EXT_ARRAY[@]}"; do

    cat "$file" >> "$OUTPUT_FILE" 2>/dev/null || echo "[ERREUR: Impossible de lire $file]" >> "$OUTPUT_FILE"    FIND_ARGS+=(-name "*.${ext}")

    echo "" >> "$OUTPUT_FILE"done

    echo "" >> "$OUTPUT_FILE"

}# Si plusieurs extensions, ajouter -o entre elles

if [ ${#EXT_ARRAY[@]} -gt 1 ]; then

# Vider ou créer le fichier de sortie    FIND_PATTERN="find src -type f \( ${FIND_ARGS[0]}"

> "$OUTPUT_FILE"    for ((i=1; i<${#FIND_ARGS[@]}; i++)); do

        FIND_PATTERN="$FIND_PATTERN -o ${FIND_ARGS[i]}"

# Ajouter un en-tête    done

echo "CONSOLIDATION DES SOURCES - $(date)" > "$OUTPUT_FILE"    FIND_PATTERN="$FIND_PATTERN \)"

echo "==================================" >> "$OUTPUT_FILE"else

echo "Extensions: $EXTENSIONS" >> "$OUTPUT_FILE"    FIND_PATTERN="find src -type f ${FIND_ARGS[0]}"

echo "" >> "$OUTPUT_FILE"fi



# Traiter les fichiers selon les extensions# Debug: afficher le pattern

IFS=',' read -ra EXT_ARRAY <<< "$EXTENSIONS"echo "🔍 Commande find: $FIND_PATTERN"

TOTAL_FILES=0

# Fonction pour traiter un fichier

for ext in "${EXT_ARRAY[@]}"; doprocess_file() {

    echo "📊 Recherche de fichiers *.$ext..."    local file="$1"

    while IFS= read -r -d '' file; do    local relative_path="${file#src/}"

        echo "📄 Traitement: ${file#src/}"

        process_file "$file"    echo "=== $relative_path ===" >> "$OUTPUT_FILE"

        ((TOTAL_FILES++))    echo "" >> "$OUTPUT_FILE"

    done < <(find src -type f -name "*.$ext" -print0)

done    # Ajouter le type MIME pour les fichiers non-texte

    if [[ "$file" == *.png || "$file" == *.jpg || "$file" == *.gif || "$file" == *.ico ]]; then

echo ""        echo "[BINAIRE - $(file -b "$file")]" >> "$OUTPUT_FILE"

echo "✅ Consolidation terminée!"    else

echo "📄 Fichier créé: $OUTPUT_FILE"        cat "$file" >> "$OUTPUT_FILE" 2>/dev/null || echo "[ERREUR: Impossible de lire $file]" >> "$OUTPUT_FILE"

echo "📊 Taille du fichier: $(du -h "$OUTPUT_FILE" | cut -f1)"    fi

echo "📊 Nombre de lignes: $(wc -l < "$OUTPUT_FILE")"

echo "📊 Nombre de fichiers traités: $TOTAL_FILES"    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# Vider ou créer le fichier de sortie
> "$OUTPUT_FILE"

# Ajouter un en-tête détaillé
echo "CONSOLIDATION DES SOURCES - $(date)" > "$OUTPUT_FILE"
echo "==================================" >> "$OUTPUT_FILE"
echo "Date: $(date)" >> "$OUTPUT_FILE"
echo "Répertoire: src/" >> "$OUTPUT_FILE"
echo "Extensions: $EXTENSIONS" >> "$OUTPUT_FILE"
echo "Machine: $(uname -a)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Compter et lister les fichiers
echo "📊 Analyse des fichiers..."
eval "FILES=($FIND_PATTERN)"
TOTAL_FILES=${#FILES[@]}

echo "📊 Nombre total de fichiers à traiter: $TOTAL_FILES"
echo ""

if [ $TOTAL_FILES -eq 0 ]; then
    echo "❌ Aucun fichier trouvé avec les extensions: $EXTENSIONS"
    echo "🔍 Commande utilisée: $FIND_PATTERN"
    exit 1
fi

# Traiter tous les fichiers
for file in "${FILES[@]}"; do
    echo "📄 Traitement: ${file#src/}"
    process_file "$file"
done

echo ""
echo "✅ Consolidation terminée!"
echo "📄 Fichier créé: $OUTPUT_FILE"
echo "📊 Taille du fichier: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "📊 Nombre de lignes: $(wc -l < "$OUTPUT_FILE")"
echo "📊 Nombre de fichiers traités: $TOTAL_FILES"