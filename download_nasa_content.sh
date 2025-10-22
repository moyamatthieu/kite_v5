#!/bin/bash

# Script pour télécharger tout le contenu du site NASA Kite
BASE_URL="https://www.grc.nasa.gov/www/k-12/airplane"
OUTPUT_DIR="nasa_kite_archive"

# Télécharger la page principale
echo "Downloading main index..."
curl -s "${BASE_URL}/shortk.html" > "${OUTPUT_DIR}/shortk.html"

# Liste des pages HTML à télécharger (liens locaux uniquement)
PAGES=(
    "ac.html" "airprop.html" "area.html" "atmos.html" "atmosi.html"
    "atmosmet.html" "atmosmre.html" "atmosmrm.html" "atmosphere.html"
    "bern.html" "boundlay.html" "cg.html" "cp.html" "density.html"
    "dragco.html" "drageq.html" "dynpress.html" "fluden.html" "forces.html"
    "function.html" "geom.html" "guided.htm" "index.html" "bgk.html" "bgt.html"
    "kite1.html" "kiteaero.html" "kitebrid.html" "kitecg.html" "kitecp.html"
    "kitedown.html" "kitedrag.html" "kitedrv.html" "kitefly.html" "kitefor.html"
    "kitegeom.html" "kitehigh.html" "kitehighg.html" "kiteincl.html" "kitelift.html"
    "kiteline.html" "kitepart.html" "kiteprog.html" "kitesafe.html" "kitesag.html"
    "kitestab.html" "kitetor.html" "kitetrim.html" "kitewt.html" "liftco.html"
    "lifteq.html" "move.html" "move2.html" "newton.html" "newton1g.html"
    "newton1k.html" "newton2.html" "newton3.html" "presar.html" "pressure.html"
    "pythag.html" "ratio.html" "sincos.html" "state.html" "temptr.html"
    "torque.html" "trig.html" "trigratio.html" "vectadd.html" "vectcomp.html"
    "vectors.html" "vectpart.html" "vel.html" "volume.html" "wteq.html"
    "short.html" "portal.css"
)

# Télécharger toutes les pages HTML
for page in "${PAGES[@]}"; do
    echo "Downloading ${page}..."
    curl -s "${BASE_URL}/${page}" > "${OUTPUT_DIR}/${page}" 2>/dev/null
    sleep 0.5  # Délai pour ne pas surcharger le serveur
done

# Télécharger les images communes
echo "Downloading common images..."
IMAGES=(
    "NASAlogo.gif" "logo_nasa.gif" "line1px.jpg" "logo_first_gov.gif"
    "logo_nasa_self.gif" "nav_top_0_0.gif" "nav_top_1_0.gif" "nav_top_2_0.gif"
    "nav_top_3_0.gif" "nav_top_4_0.gif" "nav_top_5_0.gif" "button_go.gif"
    "title_find_it_sm.gif" "spacer.gif" "butai.gif" "butwi.gif"
)

for img in "${IMAGES[@]}"; do
    echo "Downloading image ${img}..."
    curl -s "${BASE_URL}/Images/${img}" > "${OUTPUT_DIR}/Images/${img}" 2>/dev/null
    sleep 0.3
done

# Télécharger les boutons
echo "Downloading button images..."
BUTTONS=(
    "fundamentals.gif" "fundamentalsm.gif" "kites.gif" "atmosphere.gif"
    "aerodynamics.gif" "weight.gif" "aircraftforces.gif" "miscblue.gif"
)

for btn in "${BUTTONS[@]}"; do
    echo "Downloading button ${btn}..."
    curl -s "${BASE_URL}/buttons/${btn}" > "${OUTPUT_DIR}/buttons/${btn}" 2>/dev/null
    sleep 0.3
done

# Télécharger les animations interactives
echo "Downloading animations..."
curl -s "${BASE_URL}/Animation/airrel/anrel.html" > "${OUTPUT_DIR}/Animation/airrel/anrel.html" 2>/dev/null

echo "Download complete! Content saved in ${OUTPUT_DIR}/"
echo "Total files downloaded: $(find ${OUTPUT_DIR} -type f | wc -l)"
