/**
 * SimulationLoggerHelper.ts - Helpers pour accéder au logger depuis le console/UI
 *
 * Expose des fonctions globales pour contrôler le logging:
 * - window.startLogging()
 * - window.stopLogging()
 * - window.exportLogs()
 */

import { SimulationLogger } from './SimulationLogger';

export class SimulationLoggerHelper {
  private static instance: SimulationLogger | null = null;

  static setLogger(logger: SimulationLogger): void {
    this.instance = logger;
    
    // Exposer globalement
    (window as any).kiteLogger = {
      stop: () => {
        console.log('📊 Arrêt du logging et export des données...');
        if (!SimulationLoggerHelper.instance) return;
        
        const { json, csv } = SimulationLoggerHelper.instance.stopAndExport();
        
        // Télécharger JSON
        this.downloadFile(json, 'simulation-log.json', 'application/json');
        
        // Télécharger CSV
        this.downloadFile(csv, 'simulation-log.csv', 'text/csv');
        
        console.log('✅ Fichiers exportés !');
        console.log('  - simulation-log.json');
        console.log('  - simulation-log.csv');
      },
      
      getHistory: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return [];
        }
        return SimulationLoggerHelper.instance.getHistory();
      },
      
      getLogs: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return '';
        }
        return SimulationLoggerHelper.instance.getFormattedLogs();
      },
      
      printLogs: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return;
        }
        console.log(SimulationLoggerHelper.instance.getFormattedLogs());
      },
      
      exportJSON: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return;
        }
        const json = SimulationLoggerHelper.instance.exportAsJSON();
        this.downloadFile(json, 'simulation-log.json', 'application/json');
        console.log('✅ simulation-log.json téléchargé');
      },
      
      exportCSV: () => {
        if (!SimulationLoggerHelper.instance) {
          console.error('❌ Logger non disponible');
          return;
        }
        const csv = SimulationLoggerHelper.instance.exportAsCSV();
        this.downloadFile(csv, 'simulation-log.csv', 'text/csv');
        console.log('✅ simulation-log.csv téléchargé');
      },
    };
    
    console.log('📊 [SimulationLogger] Exposed as window.kiteLogger');
    console.log('  - kiteLogger.stop()    : Arrêter et exporter');
    console.log('  - kiteLogger.exportJSON()');
    console.log('  - kiteLogger.exportCSV()');
    console.log('  - kiteLogger.getHistory()');
  }

  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
