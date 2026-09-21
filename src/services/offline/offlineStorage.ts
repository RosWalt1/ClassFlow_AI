/**
 * Inicialización y esquema de IndexedDB para ClassFlow AI (Modo Offline)
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ProyectoApiItem } from '../proyectoService';
import { DiagramaApiItem } from '../diagramaService';

export interface ClassFlowDB extends DBSchema {
  projects: {
    key: number; // id_proyecto
    value: ProyectoApiItem;
    indexes: { 'by-owner': number; 'by-name': string };
  };
  diagrams: {
    key: number; // id_proyecto
    value: DiagramaApiItem;
    indexes: { 'by-diagram-id': number };
  };
}

export const DB_NAME = 'ClassFlowOffline';
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ClassFlowDB>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<ClassFlowDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
  }

  if (!dbPromise) {
    dbPromise = openDB<ClassFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: projects
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', {
            keyPath: 'id_proyecto',
          });
          projectStore.createIndex('by-owner', 'id_propietario');
          projectStore.createIndex('by-name', 'nombre');
        }

        // Store 2: diagrams
        if (!db.objectStoreNames.contains('diagrams')) {
          const diagramStore = db.createObjectStore('diagrams', {
            keyPath: 'id_proyecto',
          });
          diagramStore.createIndex('by-diagram-id', 'id_diagrama');
        }
      },
    });
  }
  return dbPromise;
}
