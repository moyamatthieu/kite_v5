/**
 * UidGenerator.ts - Générateur d'identifiants uniques
 */

export class UidGenerator {
  private static counter = 0;
  private static readonly chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  /**
   * Génère un UID simple basé sur timestamp et compteur
   */
  static generate(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const count = (this.counter++).toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}${timestamp}${count}${random}`;
  }

  /**
   * Génère un UID court (8 caractères)
   */
  static generateShort(): string {
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += this.chars.charAt(Math.floor(Math.random() * this.chars.length));
    }
    return result;
  }

  /**
   * Génère un UID basé sur des propriétés d'objet
   */
  static generateFromObject(obj: any, properties: string[]): string {
    let hash = 0;
    const str = properties.map(prop => obj[prop] || '').join('|');

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en 32 bits
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Génère un UUID v4 standard
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Génère un ID séquentiel
   */
  static generateSequential(prefix: string = 'id_'): string {
    return `${prefix}${(this.counter++).toString().padStart(6, '0')}`;
  }

  /**
   * Réinitialise le compteur (utile pour les tests)
   */
  static reset(): void {
    this.counter = 0;
  }

  /**
   * Vérifie si une chaîne est un UID valide (format de base)
   */
  static isValid(uid: string): boolean {
    // Vérification basique : contient des lettres, chiffres, et fait une longueur raisonnable
    return /^[A-Za-z0-9_-]{8,}$/.test(uid);
  }

  /**
   * Génère un hash simple d'une chaîne
   */
  static hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en 32 bits
    }

    return Math.abs(hash).toString(36);
  }
}