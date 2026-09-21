/**
 * Servicio de Gestión de Proyectos de ClassFlow AI (CU02)
 * Conexión real con el backend FastAPI y PostgreSQL classflow_ai.
 */

import { authService } from './authService';
import { projectCache } from './offline/projectCache';

export interface ColaboradorApiItem {
  id_colaborador: number;
  id_proyecto: number;
  id_usuario: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  permiso_edicion: boolean;
  estado: string;
  fecha_invitacion: string;
  fecha_aceptacion?: string | null;
}

export interface ProyectoApiItem {
  id_proyecto: number;
  id_propietario: number;
  nombre: string;
  descripcion?: string | null;
  estado: string;
  fecha_creacion: string;
  fecha_modificacion: string;
  es_propietario: boolean;
  rol: 'Propietario' | 'Invitado';
  permiso_edicion: boolean;
  propietario_nombre?: string | null;
  propietario_email?: string | null;
  colaboradores: ColaboradorApiItem[];
  total_clases: number;
  total_relaciones: number;
}

export interface ProyectoCreatePayload {
  nombre: string;
  descripcion?: string;
}

export interface ProyectoUpdatePayload {
  nombre?: string;
  descripcion?: string;
  estado?: string;
}

// URL base del backend: desarrollo (http://localhost:8000/api) o producción (/api)
const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

class ProyectoService {
  private getHeaders(): HeadersInit {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /**
   * Obtiene la lista de proyectos accesibles para el usuario autenticado
   * Guarda copia en IndexedDB y retorna caché ante errores de conexión u offline.
   */
  async getProyectos(tipo: 'all' | 'owner' | 'guest' = 'all'): Promise<ProyectoApiItem[]> {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const cached = await projectCache.getCachedProjects(tipo);
      if (cached && cached.length > 0) {
        return cached;
      }
      throw new Error('Sin conexión a internet y no hay proyectos disponibles en caché local.');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/proyectos?tipo=${tipo}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const detail = err?.detail || `Error ${response.status}: Error al obtener la lista de proyectos.`;
        const error = new Error(detail);
        (error as any).status = response.status;
        throw error;
      }

      const data: ProyectoApiItem[] = await response.json();
      // Guardar copia local en IndexedDB en segundo plano
      projectCache.saveProjects(data).catch((e) => console.warn('[ProjectCache] Error guardando copia:', e));
      return data;
    } catch (err: any) {
      // Si el backend respondió con un error HTTP real (401, 403, 500), NO ocultar
      if (err.status && err.status >= 400) {
        throw err;
      }
      if (typeof err.message === 'string' && (err.message.startsWith('Error 4') || err.message.startsWith('Error 5'))) {
        throw err;
      }

      // Fallo de conectividad / red (Failed to fetch, offline)
      const cached = await projectCache.getCachedProjects(tipo);
      if (cached && cached.length > 0) {
        return cached;
      }
      throw err;
    }
  }

  /**
   * Consulta un proyecto por ID
   * Guarda copia en IndexedDB y retorna caché ante desconexión.
   */
  async getProyecto(idProyecto: number): Promise<ProyectoApiItem> {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const cached = await projectCache.getCachedProject(idProyecto);
      if (cached) return cached;
      throw new Error('Sin conexión a internet y el proyecto no está disponible en caché local.');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const detail = err?.detail || `Error ${response.status}: Error al consultar el proyecto.`;
        const error = new Error(detail);
        (error as any).status = response.status;
        throw error;
      }

      const data: ProyectoApiItem = await response.json();
      projectCache.saveProject(data).catch((e) => console.warn('[ProjectCache] Error guardando copia:', e));
      return data;
    } catch (err: any) {
      if (err.status && err.status >= 400) {
        throw err;
      }
      if (typeof err.message === 'string' && (err.message.startsWith('Error 4') || err.message.startsWith('Error 5'))) {
        throw err;
      }

      const cached = await projectCache.getCachedProject(idProyecto);
      if (cached) return cached;
      throw err;
    }
  }

  /**
   * Crea un nuevo proyecto asignando como propietario al usuario autenticado
   */
  async createProyecto(payload: ProyectoCreatePayload): Promise<ProyectoApiItem> {
    const response = await fetch(`${API_BASE_URL}/proyectos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al crear el proyecto.');
    }

    return response.json();
  }

  /**
   * Modifica nombre o descripción de un proyecto (Solo Propietario)
   */
  async updateProyecto(
    idProyecto: number,
    payload: ProyectoUpdatePayload
  ): Promise<ProyectoApiItem> {
    const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al actualizar el proyecto.');
    }

    return response.json();
  }

  /**
   * Archiva un proyecto (Solo Propietario)
   */
  async archiveProyecto(idProyecto: number): Promise<ProyectoApiItem> {
    const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}/archivar`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al archivar el proyecto.');
    }

    return response.json();
  }

  /**
   * Elimina suavemente un proyecto (Solo Propietario)
   */
  async deleteProyecto(idProyecto: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al eliminar el proyecto.');
    }

    return response.json();
  }

  /**
   * Obtiene la lista de colaboradores del proyecto
   */
  async getColaboradores(idProyecto: number): Promise<ColaboradorApiItem[]> {
    const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}/colaboradores`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al consultar colaboradores.');
    }

    return response.json();
  }

  /**
   * Invita a un usuario registrado como colaborador (Solo Propietario)
   */
  async addColaborador(
    idProyecto: number,
    email: string,
    permisoEdicion: boolean = true
  ): Promise<ColaboradorApiItem> {
    const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}/colaboradores`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        email: email.trim(),
        permiso_edicion: permisoEdicion,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al invitar colaborador.');
    }

    return response.json();
  }

  /**
   * Modifica los permisos de edición de un colaborador (Solo Propietario)
   */
  async updateColaboradorPermiso(
    idProyecto: number,
    idColaborador: number,
    permisoEdicion: boolean
  ): Promise<ColaboradorApiItem> {
    const response = await fetch(
      `${API_BASE_URL}/proyectos/${idProyecto}/colaboradores/${idColaborador}`,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ permiso_edicion: permisoEdicion }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al actualizar permiso de colaborador.');
    }

    return response.json();
  }

  /**
   * Revoca a un colaborador del proyecto (Solo Propietario)
   */
  async removeColaborador(
    idProyecto: number,
    idColaborador: number
  ): Promise<{ message: string }> {
    const response = await fetch(
      `${API_BASE_URL}/proyectos/${idProyecto}/colaboradores/${idColaborador}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al revocar colaborador.');
    }

    return response.json();
  }
}

export const proyectoService = new ProyectoService();
