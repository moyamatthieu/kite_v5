/**
 * refactor_demo.ts - Démonstration du système refactorisé
 */

import { SceneManager } from './src/core/SceneManager';
import { StructuredObject } from './src/core/StructuredObject';
import { FactoryRegistry } from './src/factories/FactoryRegistry';
import { FrameFactory } from './src/factories/FrameFactory';
import { Logger } from './src/utils/Logging';

// Démonstration du SceneManager
console.log('=== Démonstration SceneManager ===');
const sceneManager = SceneManager.getInstance();
console.log('SceneManager créé:', sceneManager.getStats());

// Démonstration du système de logging
console.log('\n=== Démonstration Logging ===');
const logger = Logger.getInstance();
logger.info('Système de logging initialisé', 'demo');
logger.debug('Ceci est un message de debug', 'demo');
logger.warn('Ceci est un avertissement', 'demo');

// Démonstration du FactoryRegistry
console.log('\n=== Démonstration FactoryRegistry ===');
const frameFactory = new FrameFactory();

FactoryRegistry.register('frame_factory', FrameFactory);
console.log('Factory enregistrée');

// Créer un objet avec la factory
const frameObject = FactoryRegistry.createObject('frame_factory', {
  points: [
    ['point1', [0, 0, 0]],
    ['point2', [1, 0, 0]],
    ['point3', [0, 1, 0]]
  ],
  connections: [
    ['point1', 'point2'],
    ['point2', 'point3'],
    ['point3', 'point1']
  ],
  diameter: 0.02,
  material: '#ff0000'
});

console.log('Objet créé:', frameObject.getName());
console.log('Points:', frameObject.getPointNames());

// Démonstration StructuredObject avec DebugLayer
console.log('\n=== Démonstration StructuredObject + DebugLayer ===');
frameObject.setShowDebugPoints(true);
frameObject.setShowLabels(true);

console.log('Debug activé, points visibles:', frameObject.showDebugPoints);
console.log('Labels activés:', frameObject.showLabels);

console.log('\n=== Refactor Phase 1-2 TERMINÉ ===');
console.log('✅ Architecture modulaire implémentée');
console.log('✅ Séparation des responsabilités');
console.log('✅ Système de factories centralisé');
console.log('✅ Debug séparé de la géométrie');
console.log('✅ Logging configurable');
console.log('✅ SceneManager opérationnel');