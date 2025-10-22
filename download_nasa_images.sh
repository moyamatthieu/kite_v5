#!/bin/bash

# Script pour télécharger toutes les images de contenu manquantes
BASE_URL="https://www.grc.nasa.gov/www/k-12/airplane"
OUTPUT_DIR="nasa_kite_archive"

echo "Téléchargement des images de contenu (diagrammes de cerfs-volants)..."

# Liste complète des images de contenu détectées dans les pages HTML
CONTENT_IMAGES=(
    "airprop.gif" "area.gif" "atmos.gif" "atmosmet.gif" "atmosmre.gif" "atmosmrm.gif"
    "atmosphere.jpg" "bern.gif" "butai.gif" "butci.gif" "butcos.gif" "butd.gif"
    "buthi.gif" "butki.gif" "butmr.gif" "butndtr.gif" "butnex.gif" "butp12.gif"
    "butp46.gif" "butp68.gif" "butp912.gif" "butpi.gif" "butpk6.gif" "butpre.gif"
    "butsin.gif" "buttan.gif" "butwi.gif" "butwtn.gif" "fluden.gif" "function.gif"
    "kite1.gif" "kiteaero.gif" "kitebrid.gif" "kitebrid2.gif" "kitecg.gif" "kitecp.gif"
    "kitedown.gif" "kitedrag.jpg" "kitedrv.gif" "kitefly.gif" "kitefor.gif" "kitegeom.gif"
    "kitegrph1.gif" "kitegrph2.gif" "kitehigh.gif" "kitehighg.gif" "kiteincl.gif"
    "kitelift.gif" "kiteline.gif" "kitepart.gif" "kitesafe.gif" "kitesag.gif"
    "kitestab.gif" "kitetor.gif" "kitetrim.gif" "kitewt.gif" "move.gif" "move2.gif"
    "newton1k.jpg" "pressure.gif" "pythag.gif" "ratio.gif" "sincos.jpg" "state.jpg"
    "temptr.gif" "torque.gif" "trig.gif" "trigratio.gif" "vectadd.gif" "vectcomp.gif"
    "vectors.jpg" "vectpart.gif" "volume.gif" "volumenose.jpg"
    "kiteimg.gif" "fightsml.gif" "hypersml.gif" "botrock.jpg" "external.jpg" "tun.jpg"
)

# Télécharger toutes les images de contenu
count=0
total=${#CONTENT_IMAGES[@]}

for img in "${CONTENT_IMAGES[@]}"; do
    count=$((count + 1))
    echo "[$count/$total] Downloading ${img}..."
    curl -s "${BASE_URL}/Images/${img}" > "${OUTPUT_DIR}/Images/${img}" 2>/dev/null

    # Vérifier si le fichier a été téléchargé et n'est pas vide
    if [ -s "${OUTPUT_DIR}/Images/${img}" ]; then
        echo "  ✓ Downloaded successfully ($(du -h "${OUTPUT_DIR}/Images/${img}" | cut -f1))"
    else
        echo "  ✗ Failed or not found"
    fi

    sleep 0.3  # Délai pour ne pas surcharger le serveur
done

# Télécharger quelques images supplémentaires de boutons
echo ""
echo "Downloading additional button images..."

EXTRA_BUTTONS=(
    "omotion.jpg" "probsetnew.jpg" "sports.jpg"
)

for btn in "${EXTRA_BUTTONS[@]}"; do
    echo "Downloading button ${btn}..."
    curl -s "${BASE_URL}/buttons/${btn}" > "${OUTPUT_DIR}/buttons/${btn}" 2>/dev/null
    sleep 0.3
done

# Créer un dossier pour les images externes si nécessaire
mkdir -p "${OUTPUT_DIR}/../images"

# Télécharger vertical-line.jpg
echo ""
echo "Downloading shared images..."
curl -s "https://www.grc.nasa.gov/www/k-12/images/vertical-line.jpg" > "${OUTPUT_DIR}/../images/vertical-line.jpg" 2>/dev/null

echo ""
echo "✓ Download complete!"
echo "Total images in Images/: $(ls -1 ${OUTPUT_DIR}/Images/ | wc -l)"
echo "Total images in buttons/: $(ls -1 ${OUTPUT_DIR}/buttons/ | wc -l)"
