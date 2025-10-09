#!/bin/bash

# Script pour consolider tous les fichiers source TypeScript/JavaScript en un seul fichier
# Usage: ./consolidate_sources.sh [output_file]

OUTPUT_FILE="${1:-consolidated_sources.txt}"

echo "🔄 Consolidation des fichiers source TypeScript/JavaScript..."
echo "📁 Répertoire source: src/"
echo "📄 Fichier de sortie: $OUTPUT_FILE"
echo ""

# Fonction pour traiter un fichier
process_file() {
    local file="$1"
    local relative_path="${file#src/}"

    echo "=== $relative_path ===" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# Vider ou créer le fichier de sortie
> "$OUTPUT_FILE"

# Ajouter un en-tête
echo "CONSOLIDATION DES SOURCES - $(date)" > "$OUTPUT_FILE"
echo "==================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Compter le nombre total de fichiers
TOTAL_FILES=$(find src -type f \( -name "*.ts" -o -name "*.js" \) | wc -l)
echo "📊 Nombre total de fichiers à traiter: $TOTAL_FILES"
echo ""

# Traiter tous les fichiers TypeScript et JavaScript
find src -type f \( -name "*.ts" -o -name "*.js" \) | sort | while read -r file; do
    echo "📄 Traitement: $file"
    process_file "$file"
done

echo ""
echo "✅ Consolidation terminée!"
echo "📄 Fichier créé: $OUTPUT_FILE"
echo "📊 Taille du fichier: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "📊 Nombre de lignes: $(wc -l < "$OUTPUT_FILE")"