/**
 * Servicio de Gestión de Proyectos de ClassFlow AI (CU02)
 * Conexión real con el backend FastAPI y PostgreSQL classflow_ai.
 */

import { authService } from './authService';

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

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api';

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
   */
  async getProyectos(tipo: 'all' | 'owner' | 'guest' = 'all'): Promise<ProyectoApiItem[]> {
    const response = await fetch(`${API_BASE_URL}/proyectos?tipo=${tipo}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al obtener la lista de proyectos.');
    }

    return response.json();
  }

  /**
   * Consulta un proyecto por ID
   */
  async getProyecto(idProyecto: number): Promise<ProyectoApiItem> {
    const response = await fetch(`${API_BASE_URL}/proyectos/${idProyecto}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || 'Error al consultar el proyecto.');
    }

    return response.json();
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
