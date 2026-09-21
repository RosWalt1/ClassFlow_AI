/**
 * Almacenamiento local IndexedDB para soporte offline básico.
 * Guarda:
 * 1. Registros consultados (Caché de lectura).
 * 2. Registros creados/modificados pendientes (Cola offline básica).
 */
import { openDB, IDBPDatabase } from 'idb';
import { Entity } from '../models/entity';

const DB_NAME = 'demo_mobile_offline_db';
const DB_VERSION = 1;

export interface CachedEntityList {
  endpoint: string;
  data: Entity[];
  cachedAt: string;
}

export interface PendingRecord {
  id: string; // ID temporal único (ej. temp_1720000000)
  endpoint: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Entity;
  targetId?: number; // Para UPDATE o DELETE
  createdAt: string;
}

class OfflineStorage {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Store para entidades cacheadas consultadas desde la API
          if (!db.objectStoreNames.contains('entities_cache')) {
            db.createObjectStore('entities_cache', { keyPath: 'endpoint' });
          }

          // Store para registros creados localmente mientras no hay conexión
          if (!db.objectStoreNames.contains('pending_records')) {
            const pendingStore = db.createObjectStore('pending_records', { keyPath: 'id' });
            pendingStore.createIndex('endpoint', 'endpoint', { unique: false });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Obtiene la lista de entidades guardadas en caché
   */
  async getCachedEntities<T extends Entity = Entity>(endpoint: string): Promise<T[]> {
    try {
      const db = await this.getDB();
      const record = await db.get('entities_cache', endpoint);
      return (record?.data || []) as T[];
    } catch (err) {
      console.warn('[OfflineStorage] Error obteniendo caché:', err);
      return [];
    }
  }

  /**
   * Guarda una lista de entidades en la caché local
   */
  async saveCachedEntities(endpoint: string, entities: Entity[]): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('entities_cache', {
        endpoint,
        data: entities,
        cachedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[OfflineStorage] Error guardando en caché:', err);
    }
  }

  /**
   * Guarda un nuevo registro pendiente en IndexedDB cuando se está offline
   */
  async savePendingRecord(
    endpoint: string,
    data: Partial<Entity>,
    operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE',
    targetId?: number
  ): Promise<PendingRecord> {
    const db = await this.getDB();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Si no tiene id, asignar el id temporal para mostrarlo en la lista local
    const recordData: Entity = {
      ...data,
      id: targetId || (data.id ? data.id : -Math.floor(Math.random() * 100000)),
      _isPendingOffline: true,
    };

    const pendingRecord: PendingRecord = {
      id: tempId,
      endpoint,
      operation,
      data: recordData,
      targetId,
      createdAt: new Date().toISOString(),
    };

    await db.put('pending_records', pendingRecord);

    // Actualizar también la caché local para que el usuario vea su registro de inmediato
    const cached = await this.getCachedEntities(endpoint);
    if (operation === 'CREATE') {
      await this.saveCachedEntities(endpoint, [recordData, ...cached]);
    } else if (operation === 'UPDATE' && targetId) {
      const updated = cached.map((item) => (item.id === targetId ? recordData : item));
      await this.saveCachedEntities(endpoint, updated);
    } else if (operation === 'DELETE' && targetId) {
      const remaining = cached.filter((item) => item.id !== targetId);
      await this.saveCachedEntities(endpoint, remaining);
    }

    return pendingRecord;
  }

  /**
   * Lista todos los registros creados localmente que están pendientes
   */
  async getPendingRecords(endpoint?: string): Promise<PendingRecord[]> {
    try {
      const db = await this.getDB();
      const all: PendingRecord[] = await db.getAll('pending_records');
      if (endpoint) {
        return all.filter((r) => r.endpoint === endpoint);
      }
      return all;
    } catch (err) {
      console.warn('[OfflineStorage] Error obteniendo pendientes:', err);
      return [];
    }
  }

  /**
   * Elimina un registro pendiente tras sincronización
   */
  async removePendingRecord(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('pending_records', id);
    } catch (err) {
      console.warn('[OfflineStorage] Error eliminando pendiente:', err);
    }
  }

  /**
   * Limpia todos los registros pendientes
   */
  async clearPendingRecords(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear('pending_records');
    } catch (err) {
      console.warn('[OfflineStorage] Error limpiando pendientes:', err);
    }
  }

  /**
   * Estado de conexión del navegador
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}

export const offlineStorage = new OfflineStorage();
