/**
 * validate-input-config.ts - Script de validation de la configuration des contrôles
 *
 * Vérifie qu'il n'y a pas de conflits dans INPUT_CONFIG
 */

import { INPUT_CONFIG, InputValidator } from "./src/config/InputConfig";

console.log("🔍 Validation de la configuration des contrôles...\n");

// Vérifier les conflits
const conflicts = InputValidator.validateConfig(INPUT_CONFIG);

if (conflicts.length > 0) {
  console.error("❌ Conflits détectés :");
  conflicts.forEach((conflict: string) => console.error(`  - ${conflict}`));
} else {
  console.log("✅ Aucune conflit détecté !");
}

// Afficher le résumé des contrôles
console.log("\n📋 Résumé des contrôles configurés :");

console.log("\n🎯 Contrôles du cerf-volant :");
console.log(
  `  Rotation gauche: ${INPUT_CONFIG.kite.rotateLeft.primary}${
    INPUT_CONFIG.kite.rotateLeft.alternatives
      ? ` (${INPUT_CONFIG.kite.rotateLeft.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Rotation droite: ${INPUT_CONFIG.kite.rotateRight.primary}${
    INPUT_CONFIG.kite.rotateRight.alternatives
      ? ` (${INPUT_CONFIG.kite.rotateRight.alternatives.join(", ")})`
      : ""
  }`
);

console.log("\n📹 Contrôles de caméra :");
console.log(
  `  Avancer: ${INPUT_CONFIG.camera.moveForward.primary}${
    INPUT_CONFIG.camera.moveForward.alternatives
      ? ` (${INPUT_CONFIG.camera.moveForward.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Reculer: ${INPUT_CONFIG.camera.moveBackward.primary}${
    INPUT_CONFIG.camera.moveBackward.alternatives
      ? ` (${INPUT_CONFIG.camera.moveBackward.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Gauche: ${INPUT_CONFIG.camera.moveLeft.primary}${
    INPUT_CONFIG.camera.moveLeft.alternatives
      ? ` (${INPUT_CONFIG.camera.moveLeft.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Droite: ${INPUT_CONFIG.camera.moveRight.primary}${
    INPUT_CONFIG.camera.moveRight.alternatives
      ? ` (${INPUT_CONFIG.camera.moveRight.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Monter: ${INPUT_CONFIG.camera.moveUp.primary}${
    INPUT_CONFIG.camera.moveUp.alternatives
      ? ` (${INPUT_CONFIG.camera.moveUp.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Descendre: ${INPUT_CONFIG.camera.moveDown.primary}${
    INPUT_CONFIG.camera.moveDown.alternatives
      ? ` (${INPUT_CONFIG.camera.moveDown.alternatives.join(", ")})`
      : ""
  }`
);

console.log("\n🎮 Contrôles généraux :");
console.log(
  `  Pause: ${INPUT_CONFIG.general.pause.primary}${
    INPUT_CONFIG.general.pause.alternatives
      ? ` (${INPUT_CONFIG.general.pause.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Reset: ${INPUT_CONFIG.general.reset.primary}${
    INPUT_CONFIG.general.reset.alternatives
      ? ` (${INPUT_CONFIG.general.reset.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Debug: ${INPUT_CONFIG.general.debug.primary}${
    INPUT_CONFIG.general.debug.alternatives
      ? ` (${INPUT_CONFIG.general.debug.alternatives.join(", ")})`
      : ""
  }`
);
console.log(
  `  Debug Visuel: ${INPUT_CONFIG.general.debugVisuals.primary}${
    INPUT_CONFIG.general.debugVisuals.alternatives
      ? ` (${INPUT_CONFIG.general.debugVisuals.alternatives.join(", ")})`
      : ""
  }`
);

console.log("\n⚙️ Paramètres de sensibilité :");
console.log(
  `  Vitesse rotation kite: ${INPUT_CONFIG.sensitivity.kiteRotationSpeed} rad/s`
);
console.log(
  `  Vitesse retour kite: ${INPUT_CONFIG.sensitivity.kiteReturnSpeed} rad/s`
);
console.log(
  `  Rotation max kite: ${(
    (INPUT_CONFIG.sensitivity.kiteMaxRotation * 180) /
    Math.PI
  ).toFixed(1)}°`
);
console.log(
  `  Vitesse caméra: ${INPUT_CONFIG.sensitivity.cameraSpeed} unités/s`
);
console.log(
  `  Amortissement caméra: ${(
    INPUT_CONFIG.sensitivity.cameraDamping * 100
  ).toFixed(1)}%`
);
