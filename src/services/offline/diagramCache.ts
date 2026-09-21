/**
 * Capa de caché offline de diagramas UML mediante IndexedDB
 */
import { getOfflineDB } from './offlineStorage';
import { DiagramaApiItem } from '../diagramaService';

class DiagramCache {
  /**
   * Guarda o actualiza un diagrama UML en IndexedDB (indexado por id_proyecto)
   */
  async saveDiagram(diagram: DiagramaApiItem): Promise<void> {
    try {
      const db = await getOfflineDB();
      await db.put('diagrams', diagram);
    } catch (err) {
      console.warn('[DiagramCache] No se pudo persistir el diagrama en IndexedDB:', err);
    }
  }

  /**
   * Obtiene un diagrama UML previamente guardado por ID de proyecto
   */
  async getCachedDiagramByProject(idProyecto: number): Promise<DiagramaApiItem | null> {
    try {
      const db = await getOfflineDB();
      const d = await db.get('diagrams', idProyecto);
      return d || null;
    } catch (err) {
      console.warn('[DiagramCache] Error leyendo diagrama por id_proyecto:', err);
      return null;
    }
  }

  /**
   * Obtiene un diagrama UML previamente guardado por su propio id_diagrama
   */
  async getCachedDiagramById(idDiagrama: number): Promise<DiagramaApiItem | null> {
    try {
      const db = await getOfflineDB();
      const tx = db.transaction('diagrams', 'readonly');
      const index = tx.store.index('by-diagram-id');
      const d = await index.get(idDiagrama);
      await tx.done;
      return d || null;
    } catch (err) {
      console.warn('[DiagramCache] Error leyendo diagrama por id_diagrama:', err);
      return null;
    }
  }

  /**
   * Limpia el almacén de diagramas
   */
  async clearDiagramsCache(): Promise<void> {
    try {
      const db = await getOfflineDB();
      await db.clear('diagrams');
    } catch (err) {
      console.warn('[DiagramCache] Error limpiando caché de diagramas:', err);
    }
  }
}

export const diagramCache = new DiagramCache();
