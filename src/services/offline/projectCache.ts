/**
 * Capa de caché offline de proyectos mediante IndexedDB
 */
import { getOfflineDB } from './offlineStorage';
import { ProyectoApiItem } from '../proyectoService';

class ProjectCache {
  /**
   * Guarda una lista completa de proyectos en el almacén IndexedDB
   */
  async saveProjects(projects: ProyectoApiItem[]): Promise<void> {
    try {
      const db = await getOfflineDB();
      const tx = db.transaction('projects', 'readwrite');
      for (const p of projects) {
        await tx.store.put(p);
      }
      await tx.done;
    } catch (err) {
      console.warn('[ProjectCache] No se pudo persistir proyectos en IndexedDB:', err);
    }
  }

  /**
   * Guarda o actualiza un único proyecto en IndexedDB
   */
  async saveProject(project: ProyectoApiItem): Promise<void> {
    try {
      const db = await getOfflineDB();
      await db.put('projects', project);
    } catch (err) {
      console.warn('[ProjectCache] No se pudo persistir el proyecto en IndexedDB:', err);
    }
  }

  /**
   * Recupera proyectos desde IndexedDB con filtrado opcional
   */
  async getCachedProjects(tipo: 'all' | 'owner' | 'guest' = 'all'): Promise<ProyectoApiItem[]> {
    try {
      const db = await getOfflineDB();
      const all = await db.getAll('projects');
      if (tipo === 'owner') {
        return all.filter((p) => p.es_propietario);
      }
      if (tipo === 'guest') {
        return all.filter((p) => !p.es_propietario);
      }
      return all;
    } catch (err) {
      console.warn('[ProjectCache] No se pudieron recuperar proyectos de IndexedDB:', err);
      return [];
    }
  }

  /**
   * Consulta un proyecto por ID en IndexedDB
   */
  async getCachedProject(idProyecto: number): Promise<ProyectoApiItem | null> {
    try {
      const db = await getOfflineDB();
      const p = await db.get('projects', idProyecto);
      return p || null;
    } catch (err) {
      console.warn('[ProjectCache] Error consultando proyecto en IndexedDB:', err);
      return null;
    }
  }

  /**
   * Limpia el almacén de proyectos
   */
  async clearProjectsCache(): Promise<void> {
    try {
      const db = await getOfflineDB();
      await db.clear('projects');
    } catch (err) {
      console.warn('[ProjectCache] Error limpiando caché de proyectos:', err);
    }
  }
}

export const projectCache = new ProjectCache();
