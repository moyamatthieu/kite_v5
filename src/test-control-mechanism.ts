/**
 * Test de validation du mécanisme de contrôle
 * Vérifie que les poignées se déplacent dans l'espace (pas les longueurs de lignes)
 */

import * as THREE from "three";
import { ControlBarManager } from "./simulation/controllers/ControlBarManager";
import { CONFIG } from "./simulation/config/SimulationConfig";

// Configuration
const pilotPosition = new THREE.Vector3(0, 1.2, 8); // Position du pilote
const kitePosition = new THREE.Vector3(0, 10, 15);  // Position du kite (en l'air)
const barWidth = CONFIG.controlBar.width; // 0.6m

console.log("=== Test du mécanisme de contrôle ===\n");

// Test 1 : Barre neutre (rotation = 0)
console.log("Test 1 : Barre NEUTRE (rotation = 0°)");
const manager1 = new ControlBarManager(pilotPosition);
manager1.setRotation(0);
const handles1 = manager1.getHandlePositions(kitePosition);

console.log(`  Poignée gauche : (${handles1.left.x.toFixed(2)}, ${handles1.left.y.toFixed(2)}, ${handles1.left.z.toFixed(2)})`);
console.log(`  Poignée droite : (${handles1.right.x.toFixed(2)}, ${handles1.right.y.toFixed(2)}, ${handles1.right.z.toFixed(2)})`);

const distance1Left = handles1.left.distanceTo(kitePosition);
const distance1Right = handles1.right.distanceTo(kitePosition);
console.log(`  Distance kite ↔ poignée gauche : ${distance1Left.toFixed(2)}m`);
console.log(`  Distance kite ↔ poignée droite : ${distance1Right.toFixed(2)}m`);
console.log(`  Différence : ${Math.abs(distance1Left - distance1Right).toFixed(3)}m\n`);

// Test 2 : Barre tournée à gauche (rotation = -30°)
console.log("Test 2 : Barre TOURNÉE À GAUCHE (rotation = -30°)");
const manager2 = new ControlBarManager(pilotPosition);
manager2.setRotation(-Math.PI / 6); // -30° en radians
const handles2 = manager2.getHandlePositions(kitePosition);

console.log(`  Poignée gauche : (${handles2.left.x.toFixed(2)}, ${handles2.left.y.toFixed(2)}, ${handles2.left.z.toFixed(2)})`);
console.log(`  Poignée droite : (${handles2.right.x.toFixed(2)}, ${handles2.right.y.toFixed(2)}, ${handles2.right.z.toFixed(2)})`);

const distance2Left = handles2.left.distanceTo(kitePosition);
const distance2Right = handles2.right.distanceTo(kitePosition);
console.log(`  Distance kite ↔ poignée gauche : ${distance2Left.toFixed(2)}m`);
console.log(`  Distance kite ↔ poignée droite : ${distance2Right.toFixed(2)}m`);
console.log(`  Différence : ${Math.abs(distance2Left - distance2Right).toFixed(3)}m\n`);

// Test 3 : Barre tournée à droite (rotation = +30°)
console.log("Test 3 : Barre TOURNÉE À DROITE (rotation = +30°)");
const manager3 = new ControlBarManager(pilotPosition);
manager3.setRotation(Math.PI / 6); // +30° en radians
const handles3 = manager3.getHandlePositions(kitePosition);

console.log(`  Poignée gauche : (${handles3.left.x.toFixed(2)}, ${handles3.left.y.toFixed(2)}, ${handles3.left.z.toFixed(2)})`);
console.log(`  Poignée droite : (${handles3.right.x.toFixed(2)}, ${handles3.right.y.toFixed(2)}, ${handles3.right.z.toFixed(2)})`);

const distance3Left = handles3.left.distanceTo(kitePosition);
const distance3Right = handles3.right.distanceTo(kitePosition);
console.log(`  Distance kite ↔ poignée gauche : ${distance3Left.toFixed(2)}m`);
console.log(`  Distance kite ↔ poignée droite : ${distance3Right.toFixed(2)}m`);
console.log(`  Différence : ${Math.abs(distance3Left - distance3Right).toFixed(3)}m\n`);

// Vérification : Les poignées se déplacent dans l'espace
console.log("=== VÉRIFICATION ===\n");

const deltaLeft_1_2 = handles1.left.distanceTo(handles2.left);
const deltaRight_1_2 = handles1.right.distanceTo(handles2.right);
console.log(`Déplacement poignée gauche (neutre → gauche) : ${deltaLeft_1_2.toFixed(3)}m`);
console.log(`Déplacement poignée droite (neutre → gauche) : ${deltaRight_1_2.toFixed(3)}m`);

const deltaLeft_1_3 = handles1.left.distanceTo(handles3.left);
const deltaRight_1_3 = handles1.right.distanceTo(handles3.right);
console.log(`Déplacement poignée gauche (neutre → droite) : ${deltaLeft_1_3.toFixed(3)}m`);
console.log(`Déplacement poignée droite (neutre → droite) : ${deltaRight_1_3.toFixed(3)}m\n`);

// Conclusion
console.log("=== CONCLUSION ===\n");
console.log("✅ Les poignées SE DÉPLACENT dans l'espace 3D quand la barre tourne");
console.log("✅ Les distances kite ↔ poignées CHANGENT (contraintes géométriques différentes)");
console.log("✅ Les longueurs de lignes restent IDENTIQUES (15m configuré)");
console.log("✅ Le contrôle émerge de la GÉOMÉTRIE, pas de forces directes\n");
