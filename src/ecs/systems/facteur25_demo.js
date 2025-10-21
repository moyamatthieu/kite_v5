/**
 * DÉMONSTRATION DU FACTEUR 25
 * 
 * Ce fichier compare numériquement l'approche actuelle vs l'approche NASA
 * pour expliquer d'où vient le facteur 25 de différence sur la portance.
 */

console.log("=== COMPARAISON APPROCHE ACTUELLE vs NASA ===\n");

// PARAMÈTRES DE TEST
const angleDegrees = 15; // Angle d'attaque typique
const angleRadians = angleDegrees * Math.PI / 180; // 0.262 rad
const aspectRatio = 2.0; // Typical kite aspect ratio
const CLAlpha = 0.105; // Valeur actuelle dans Config.ts

console.log(`Angle de test: ${angleDegrees}° (${angleRadians.toFixed(3)} rad)`);
console.log(`Aspect ratio: ${aspectRatio}`);
console.log(`CLAlpha (config actuel): ${CLAlpha}\n`);

// ========================================================================
// APPROCHE ACTUELLE (AeroSystem.ts)
// ========================================================================
console.log("🔵 APPROCHE ACTUELLE (Rayleigh + tuning):");

// 1. Calcul dot product et angle
const dotNW = Math.cos(angleRadians); // cos(15°) = 0.966
const sinAlpha = Math.sin(angleRadians); // sin(15°) = 0.259
const cosAlpha = Math.cos(angleRadians); // cos(15°) = 0.966

console.log(`  dot product (cos α): ${dotNW.toFixed(3)}`);
console.log(`  sin(α): ${sinAlpha.toFixed(3)}, cos(α): ${cosAlpha.toFixed(3)}`);

// 2. Coefficient normal de Rayleigh: CN = 2 × sin(α) × cos(α) = sin(2α)
const CN_Rayleigh = 2.0 * sinAlpha * cosAlpha;
const CN_sin2alpha = Math.sin(2 * angleRadians); // Vérification
console.log(`  CN (Rayleigh): 2×sin(α)×cos(α) = ${CN_Rayleigh.toFixed(3)}`);
console.log(`  CN (sin 2α): sin(${2*angleDegrees}°) = ${CN_sin2alpha.toFixed(3)} ✓`);

// 3. Application du facteur de tuning CLAlpha
const CL_actuel = CN_Rayleigh * CLAlpha;
console.log(`  CL final: ${CN_Rayleigh.toFixed(3)} × ${CLAlpha} = ${CL_actuel.toFixed(4)}`);

// ========================================================================
// APPROCHE NASA (AeroSystemNASA.ts)
// ========================================================================
console.log("\n🟢 APPROCHE NASA (formules officielles):");

// 1. Coefficient de portance NASA pour plaque plane
const Clo_NASA = 2.0 * Math.PI * angleRadians;
console.log(`  Clo (NASA): 2π × α = 2π × ${angleRadians.toFixed(3)} = ${Clo_NASA.toFixed(3)}`);

// 2. Correction aspect ratio (obligatoire selon NASA)
const correction_AR = 1.0 + Clo_NASA / (Math.PI * aspectRatio);
const CL_NASA = Clo_NASA / correction_AR;
console.log(`  Correction AR: 1 + Clo/(π×AR) = 1 + ${Clo_NASA.toFixed(3)}/(π×${aspectRatio}) = ${correction_AR.toFixed(3)}`);
console.log(`  CL final: ${Clo_NASA.toFixed(3)} / ${correction_AR.toFixed(3)} = ${CL_NASA.toFixed(4)}`);

// ========================================================================
// COMPARAISON ET ANALYSE
// ========================================================================
console.log("\n📊 COMPARAISON FINALE:");
const facteur = CL_NASA / CL_actuel;
console.log(`  CL actuel: ${CL_actuel.toFixed(4)}`);
console.log(`  CL NASA:   ${CL_NASA.toFixed(4)}`);
console.log(`  FACTEUR:   ${CL_NASA.toFixed(4)} / ${CL_actuel.toFixed(4)} = ${facteur.toFixed(1)} ✨`);

// ========================================================================
// ANALYSE DES COMPOSANTES DU FACTEUR
// ========================================================================
console.log("\n🔍 DÉCOMPOSITION DU FACTEUR:");

const facteur_formule = Clo_NASA / CN_Rayleigh;
const facteur_tuning = 1.0 / CLAlpha;
const facteur_AR = CN_Rayleigh / CL_NASA * Clo_NASA; // Inverse de la correction

console.log(`  1. Différence de formule: ${Clo_NASA.toFixed(3)} / ${CN_Rayleigh.toFixed(3)} = ${facteur_formule.toFixed(1)}`);
console.log(`     (NASA 2πα vs Rayleigh sin(2α))`);
console.log(`  2. Facteur de tuning: 1 / ${CLAlpha} = ${facteur_tuning.toFixed(1)}`);
console.log(`     (CLAlpha semble compenser la différence de formule)`);
console.log(`  3. Correction AR NASA: ${(CL_NASA/Clo_NASA).toFixed(2)}`);
console.log(`     (Réduit la portance pour faible aspect ratio)`);

console.log(`\n  Vérification: ${facteur_formule.toFixed(1)} × ${facteur_tuning.toFixed(1)} × ${(CL_NASA/Clo_NASA).toFixed(2)} = ${(facteur_formule * facteur_tuning * (CL_NASA/Clo_NASA)).toFixed(1)}`);

// ========================================================================
// CONCLUSION
// ========================================================================
console.log("\n💡 CONCLUSION:");
console.log("  Le facteur ~25 vient de 3 sources:");
console.log("  1. Formule différente (NASA vs Rayleigh): facteur ~3.3");
console.log("  2. Tuning empirique (CLAlpha = 0.105): facteur ~9.5");  
console.log("  3. Correction aspect ratio NASA: facteur ~0.8");
console.log("  Total: 3.3 × 9.5 × 0.8 ≈ 25");
console.log("\n  ➡️  CLAlpha semble être un facteur de correction empirique");
console.log("      pour compenser la différence entre Rayleigh et NASA!");