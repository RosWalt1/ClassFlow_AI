/**
 * Cliente API REST Genérico para consumir backend Spring Boot generado por ClassFlow AI.
 * Preparado para operaciones estándar: GET, POST, PUT, DELETE.
 */
import { Entity } from '../models/entity';

// URL base configurable mediante variable de entorno o almacenamiento local
const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = localStorage.getItem('demo_mobile_api_url') || DEFAULT_BASE_URL;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
    localStorage.setItem('demo_mobile_api_url', this.baseUrl);
  }

  public resetBaseUrl(): void {
    this.baseUrl = DEFAULT_BASE_URL;
    localStorage.removeItem('demo_mobile_api_url');
  }

  private buildUrl(endpoint: string, id?: number, useV1 = false): string {
    const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
    let base = this.baseUrl.replace(/\/+$/, '');
    if (useV1 && !base.endsWith('/v1') && !cleanEndpoint.startsWith('v1/')) {
      base = `${base}/v1`;
    }
    if (id !== undefined && id !== null) {
      return `${base}/${cleanEndpoint}/${id}`;
    }
    return `${base}/${cleanEndpoint}`;
  }

  private async fetchWithRouting(endpoint: string, options: RequestInit, id?: number): Promise<Response> {
    const primaryUrl = this.buildUrl(endpoint, id, false);
    let res = await fetch(primaryUrl, options);

    // Si retorna 404 y la URL no contiene /v1, intentar con prefijo /v1 de Spring Boot
    if (res.status === 404 && !this.baseUrl.endsWith('/v1') && !endpoint.startsWith('v1/')) {
      const v1Url = this.buildUrl(endpoint, id, true);
      const v1Res = await fetch(v1Url, options);
      if (v1Res.ok || v1Res.status !== 404) {
        // Recordar el prefijo v1 automáticamente para futuras llamadas
        this.baseUrl = this.baseUrl.replace(/\/+$/, '') + '/v1';
        return v1Res;
      }
    }

    return res;
  }

  /**
   * GET: Obtener lista de entidades
   */
  async getAll<T extends Entity = Entity>(endpoint: string): Promise<T[]> {
    const res = await this.fetchWithRouting(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Error en GET ${endpoint}: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * GET: Obtener una entidad por su ID
   */
  async getById<T extends Entity = Entity>(endpoint: string, id: number): Promise<T> {
    const res = await this.fetchWithRouting(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }, id);

    if (!res.ok) {
      throw new Error(`Error en GET ${endpoint}/${id}: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * POST: Crear una nueva entidad
   */
  async create<T extends Entity = Entity>(endpoint: string, data: Partial<T>): Promise<T> {
    const res = await this.fetchWithRouting(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Error en POST ${endpoint}: ${res.status} ${errorText || res.statusText}`);
    }

    return await res.json();
  }

  /**
   * PUT: Actualizar una entidad existente
   */
  async update<T extends Entity = Entity>(endpoint: string, id: number, data: Partial<T>): Promise<T> {
    const payload = { ...data, id };
    const res = await this.fetchWithRouting(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    }, id);

    // Si el backend no tiene PUT mapeado pero tiene POST que actualiza con id
    if (res.status === 405) {
      return await this.create<T>(endpoint, payload as Partial<T>);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`Error en PUT ${endpoint}/${id}: ${res.status} ${errorText || res.statusText}`);
    }

    return await res.json();
  }

  /**
   * DELETE: Eliminar una entidad por ID
   */
  async delete(endpoint: string, id: number): Promise<void> {
    const res = await this.fetchWithRouting(endpoint, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    }, id);

    if (!res.ok && res.status !== 204) {
      throw new Error(`Error en DELETE ${endpoint}/${id}: ${res.status} ${res.statusText}`);
    }
  }

  /**
   * Verifica conectividad rápida con el backend Spring Boot
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Intentar una llamada OPTIONS o HEAD o GET breve
      const res = await fetch(this.baseUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return res.ok || res.status === 404; // 404 en root indica que el servidor Spring Boot respondió
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
