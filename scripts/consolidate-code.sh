#!/bin/bash

# Script de consolidation du code source
# Récupère tout le code TypeScript du dossier /src et le consolide dans un fichier unique

OUTPUT_FILE="consolidated-code.md"
SRC_DIR="./src"

# Vérifier que le dossier src existe
if [ ! -d "$SRC_DIR" ]; then
    echo "Erreur: Le dossier $SRC_DIR n'existe pas"
    exit 1
fi

# Créer/écraser le fichier de sortie avec un en-tête
cat > "$OUTPUT_FILE" << 'EOF'
# Code Source Consolidé - Kite Simulator V8

**Date de génération**: $(date +"%Y-%m-%d %H:%M:%S")  
**Architecture**: ECS Pure (Entity-Component-System)  
**Stack**: TypeScript + Three.js + Vite

---

EOF

echo "📦 Consolidation du code source en cours..."
echo ""

# Fonction pour traiter un fichier
process_file() {
    local file="$1"
    local relative_path="${file#$SRC_DIR/}"
    
    echo "## Fichier: \`$relative_path\`" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "\`\`\`typescript" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    echo "  ✓ $relative_path"
}

# Trouver et traiter tous les fichiers TypeScript
file_count=0
while IFS= read -r -d '' file; do
    process_file "$file"
    ((file_count++))
done < <(find "$SRC_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" ! -path "*/.legacy/*" -print0 | sort -z)

# Ajouter un pied de page
cat >> "$OUTPUT_FILE" << EOF

---

## Statistiques

- **Nombre de fichiers**: $file_count
- **Répertoire source**: $SRC_DIR
- **Fichiers exclus**: .legacy/, node_modules/

EOF

echo ""
echo "✅ Consolidation terminée!"
echo "📄 Fichier généré: $OUTPUT_FILE"
echo "📊 Nombre de fichiers traités: $file_count"

# Afficher la taille du fichier généré
if [ -f "$OUTPUT_FILE" ]; then
    file_size=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "💾 Taille du fichier: $file_size"
fi
