/**
 * VisualComponent.ts - Propriétés visuelles pour le rendu
 * 
 * Contrôle l'apparence visuelle (couleur, opacité, wireframe, etc.)
 */

import { Component } from '../core/Component';

export class VisualComponent extends Component {
  readonly type = 'visual';
  
  color: number; // Couleur hex (ex: 0x00ff00 pour vert)
  opacity: number; // 0-1
  wireframe: boolean;
  visible: boolean;
  emissive?: number; // Couleur émissive (optionnel)
  
  constructor(options: {
    color?: number;
    opacity?: number;
    wireframe?: boolean;
    visible?: boolean;
    emissive?: number;
  } = {}) {
    super();
    this.color = options.color ?? 0x00ff00;
    this.opacity = options.opacity ?? 1.0;
    this.wireframe = options.wireframe ?? false;
    this.visible = options.visible ?? true;
    this.emissive = options.emissive;
  }
}
