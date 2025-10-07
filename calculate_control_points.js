#!/usr/bin/env node
/**
 * Calcul de la position idéale des points de contrôle et longueurs de brides
 * pour équilibrer correctement le kite
 */

// Import de la géométrie du kite
const KiteGeometry = {
  POINTS: {
    NEZ: { x: 0, y: 0.65, z: 0 },
    SPINE_BAS: { x: 0, y: 0, z: 0 },
    BORD_GAUCHE: { x: -0.825, y: 0, z: 0 },
    BORD_DROIT: { x: 0.825, y: 0, z: 0 },
    WHISKER_GAUCHE: { x: -0.4125, y: 0.1, z: -0.15 },
    WHISKER_DROIT: { x: 0.4125, y: 0.1, z: -0.15 },
    CTRL_GAUCHE: { x: -0.15, y: 0.3, z: 0.4 },
    CTRL_DROIT: { x: 0.15, y: 0.3, z: 0.4 },
  },
  
  SURFACES: [
    // Surface haute gauche
    {
      vertices: ["NEZ", "BORD_GAUCHE", "WHISKER_GAUCHE"],
      name: "haute_gauche"
    },
    // Surface basse gauche
    {
      vertices: ["NEZ", "WHISKER_GAUCHE", "SPINE_BAS"],
      name: "basse_gauche"
    },
    // Surface haute droite
    {
      vertices: ["NEZ", "WHISKER_DROIT", "BORD_DROIT"],
      name: "haute_droite"
    },
    // Surface basse droite
    {
      vertices: ["NEZ", "SPINE_BAS", "WHISKER_DROIT"],
      name: "basse_droite"
    },
  ]
};

function calculateTriangleArea(v1, v2, v3) {
  const edge1 = {
    x: v2.x - v1.x,
    y: v2.y - v1.y,
    z: v2.z - v1.z
  };
  
  const edge2 = {
    x: v3.x - v1.x,
    y: v3.y - v1.y,
    z: v3.z - v1.z
  };
  
  // Produit vectoriel
  const cross = {
    x: edge1.y * edge2.z - edge1.z * edge2.y,
    y: edge1.z * edge2.x - edge1.x * edge2.z,
    z: edge1.x * edge2.y - edge1.y * edge2.x
  };
  
  // Longueur du vecteur cross
  const length = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
  
  return length / 2;
}

function calculateTriangleCenter(v1, v2, v3) {
  return {
    x: (v1.x + v2.x + v3.x) / 3,
    y: (v1.y + v2.y + v3.y) / 3,
    z: (v1.z + v2.z + v3.z) / 3
  };
}

// Calcul des centres de pression et aires de chaque surface
console.log("=== ANALYSE DES SURFACES ===\n");

let totalArea = 0;
let weightedCenterX = 0;
let weightedCenterY = 0;
let weightedCenterZ = 0;
let surfaceData = [];

KiteGeometry.SURFACES.forEach((surface, index) => {
  const vertices = surface.vertices.map(name => KiteGeometry.POINTS[name]);
  const area = calculateTriangleArea(vertices[0], vertices[1], vertices[2]);
  const center = calculateTriangleCenter(vertices[0], vertices[1], vertices[2]);
  
  console.log(`Surface ${surface.name}:`);
  console.log(`  Aire: ${area.toFixed(4)} m²`);
  console.log(`  Centre de pression: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
  console.log();
  
  totalArea += area;
  weightedCenterX += center.x * area;
  weightedCenterY += center.y * area;
  weightedCenterZ += center.z * area;
  
  surfaceData.push({ ...surface, area, center });
});

// Centre de pression global (pondéré par les aires)
const globalCenter = {
  x: weightedCenterX / totalArea,
  y: weightedCenterY / totalArea,
  z: weightedCenterZ / totalArea
};

console.log(`=== CENTRE DE PRESSION GLOBAL ===`);
console.log(`Aire totale: ${totalArea.toFixed(4)} m²`);
console.log(`Centre de pression global: (${globalCenter.x.toFixed(3)}, ${globalCenter.y.toFixed(3)}, ${globalCenter.z.toFixed(3)})`);
console.log();

// Analyse des points de contrôle actuels
console.log(`=== POINTS DE CONTRÔLE ACTUELS ===`);
console.log(`CTRL_GAUCHE: (${KiteGeometry.POINTS.CTRL_GAUCHE.x}, ${KiteGeometry.POINTS.CTRL_GAUCHE.y}, ${KiteGeometry.POINTS.CTRL_GAUCHE.z})`);
console.log(`CTRL_DROIT: (${KiteGeometry.POINTS.CTRL_DROIT.x}, ${KiteGeometry.POINTS.CTRL_DROIT.y}, ${KiteGeometry.POINTS.CTRL_DROIT.z})`);
console.log();

// Position idéale des points de contrôle
console.log(`=== POSITION IDÉALE DES POINTS DE CONTRÔLE ===`);
console.log("Pour équilibrer le kite, les points de contrôle doivent être alignés");
console.log("avec le centre de pression pour minimiser le couple aérodynamique.\n");

// Recommandations
const recommendedY = Math.max(0.20, globalCenter.y - 0.05); // Légèrement en dessous du centre de pression
const recommendedZ = globalCenter.z + 0.05; // Légèrement en arrière du centre de pression

console.log(`Position recommandée des points de contrôle:`);
console.log(`  Y (hauteur): ${recommendedY.toFixed(3)} m (actuellement: ${KiteGeometry.POINTS.CTRL_GAUCHE.y})`);
console.log(`  Z (profondeur): ${recommendedZ.toFixed(3)} m (actuellement: ${KiteGeometry.POINTS.CTRL_GAUCHE.z})`);
console.log(`  X (écartement): ±0.15 m (inchangé)`);
console.log();

// Calcul des longueurs de brides optimales
console.log(`=== CALCUL DES LONGUEURS DE BRIDES ===\n`);

// Points d'attache des brides sur le kite
const bridleAttachments = [
  { name: "NEZ", point: KiteGeometry.POINTS.NEZ, type: "nez" },
  { name: "WHISKER_GAUCHE", point: KiteGeometry.POINTS.WHISKER_GAUCHE, type: "inter" },
  { name: "WHISKER_DROIT", point: KiteGeometry.POINTS.WHISKER_DROIT, type: "inter" },
  { name: "BORD_GAUCHE", point: KiteGeometry.POINTS.BORD_GAUCHE, type: "centre" },
  { name: "BORD_DROIT", point: KiteGeometry.POINTS.BORD_DROIT, type: "centre" },
  { name: "SPINE_BAS", point: KiteGeometry.POINTS.SPINE_BAS, type: "centre" }
];

const newCtrlGauche = { x: -0.15, y: recommendedY, z: recommendedZ };
const newCtrlDroit = { x: 0.15, y: recommendedY, z: recommendedZ };

function distance3D(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

console.log("Longueurs de brides recommandées avec nouveaux points de contrôle:");

bridleAttachments.forEach(attachment => {
  const toLeft = distance3D(attachment.point, newCtrlGauche);
  const toRight = distance3D(attachment.point, newCtrlDroit);
  
  console.log(`${attachment.name} (${attachment.type}):`);
  console.log(`  Vers CTRL_GAUCHE: ${toLeft.toFixed(3)} m`);
  console.log(`  Vers CTRL_DROIT: ${toRight.toFixed(3)} m`);
  console.log();
});

// Groupement par type de bride
const bridleTypes = {
  nez: [],
  inter: [],
  centre: []
};

bridleAttachments.forEach(attachment => {
  const toLeft = distance3D(attachment.point, newCtrlGauche);
  const toRight = distance3D(attachment.point, newCtrlDroit);
  
  bridleTypes[attachment.type].push({ left: toLeft, right: toRight });
});

console.log("=== LONGUEURS MOYENNES PAR TYPE DE BRIDE ===");
Object.keys(bridleTypes).forEach(type => {
  const lengths = bridleTypes[type];
  if (lengths.length > 0) {
    const avgLeft = lengths.reduce((sum, l) => sum + l.left, 0) / lengths.length;
    const avgRight = lengths.reduce((sum, l) => sum + l.right, 0) / lengths.length;
    const avgTotal = (avgLeft + avgRight) / 2;
    
    console.log(`${type}: ${avgTotal.toFixed(3)} m`);
  }
});

console.log("\n=== RÉSUMÉ DES MODIFICATIONS RECOMMANDÉES ===");
console.log("1. Abaisser les points de contrôle:");
console.log(`   CTRL_GAUCHE: (-0.15, ${recommendedY.toFixed(3)}, ${recommendedZ.toFixed(3)})`);
console.log(`   CTRL_DROIT: (0.15, ${recommendedY.toFixed(3)}, ${recommendedZ.toFixed(3)})`);
console.log();
console.log("2. Ajuster les longueurs de brides selon les calculs ci-dessus");
console.log();
console.log("3. Vérifier l'équilibre en vol et ajuster finement si nécessaire");