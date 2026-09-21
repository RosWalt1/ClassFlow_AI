import { authService } from './authService';
import { CanonicalUMLRelationType } from '../types';
import { diagramCache } from './offline/diagramCache';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export interface ParametroApiItem {
  id_parametro: number;
  id_metodo: number;
  nombre: string;
  tipo_dato: string;
  valor_defecto?: string | null;
  orden: number;
}

export interface MetodoApiItem {
  id_metodo: number;
  id_clase: number;
  nombre: string;
  tipo_retorno: string;
  visibilidad: string;
  es_estatico: boolean;
  es_abstracto: boolean;
  orden: number;
  parametros: ParametroApiItem[];
}

export interface AtributoApiItem {
  id_atributo: number;
  id_clase: number;
  nombre: string;
  tipo_dato: string;
  visibilidad: string;
  valor_defecto?: string | null;
  es_estatico: boolean;
  es_final: boolean;
  es_nullable: boolean;
  orden: number;
}

export interface ClaseApiItem {
  id_clase: number;
  id_diagrama: number;
  nombre: string;
  estereotipo?: string | null;
  visibilidad: string;
  es_abstracta: boolean;
  posicion_x: number;
  posicion_y: number;
  ancho: number;
  alto: number;
  fecha_creacion: string;
  fecha_modificacion: string;
  atributos: AtributoApiItem[];
  metodos: MetodoApiItem[];
}

export interface RelacionApiItem {
  id_relacion: number;
  id_diagrama: number;
  id_clase_origen: number;
  id_clase_destino: number;
  tipo: CanonicalUMLRelationType;
  nombre?: string | null;
  multiplicidad_origen?: string | null;
  multiplicidad_destino?: string | null;
  rol_origen?: string | null;
  rol_destino?: string | null;
  navegabilidad_origen: boolean;
  navegabilidad_destino: boolean;
  fecha_creacion: string;
}

export interface DiagramaApiItem {
  id_diagrama: number;
  id_proyecto: number;
  nombre: string;
  descripcion?: string | null;
  version: number;
  fecha_creacion: string;
  fecha_modificacion: string;
  es_propietario: boolean;
  permiso_edicion: boolean;
  clases: ClaseApiItem[];
  relaciones: RelacionApiItem[];
}

export interface ImageProposalAttribute {
  nombre: string;
  tipo_dato: string;
  visibilidad?: string;
  valor_defecto?: string | null;
  es_estatico?: boolean;
  es_final?: boolean;
  es_nullable?: boolean;
}

export interface ImageProposalMethodParam {
  nombre: string;
  tipo_dato: string;
  valor_defecto?: string | null;
}

export interface ImageProposalMethod {
  nombre: string;
  tipo_retorno: string;
  visibilidad?: string;
  es_estatico?: boolean;
  es_abstracto?: boolean;
  parametros?: ImageProposalMethodParam[];
}

export interface ImageProposalClass {
  nombre: string;
  estereotipo?: string | null;
  visibilidad?: string;
  es_abstracta?: boolean;
  atributos?: ImageProposalAttribute[];
  metodos?: ImageProposalMethod[];
}

export interface ImageProposalRelation {
  origen: string;
  destino: string;
  tipo: string;
  nombre?: string | null;
  multiplicidad_origen?: string | null;
  multiplicidad_destino?: string | null;
  rol_origen?: string | null;
  rol_destino?: string | null;
  navegabilidad_origen?: boolean;
  navegabilidad_destino?: boolean;
}

export interface ImageUMLProposal {
  classes: ImageProposalClass[];
  relations: ImageProposalRelation[];
}

export interface ImageApplyResult {
  success: boolean;
  message: string;
  created_classes: string[];
  created_relations: number;
  total_classes: number;
  total_relations: number;
}

export interface GeneratedFileItem {
  path: string;
  name: string;
  category: 'model' | 'repository' | 'service' | 'controller' | 'config' | 'root';
  content: string;
}

export interface GenerationMetrics {
  total_classes: number;
  total_attributes: number;
  total_methods: number;
  total_relations: number;
  total_files: number;
}

export interface BackendGenerateResponse {
  success: boolean;
  framework: string;
  project_name: string;
  diagram_name: string;
  package_name: string;
  metrics: GenerationMetrics;
  files: GeneratedFileItem[];
  summary: string;
}

class DiagramaService {
  private getHeaders(): HeadersInit {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private getAuthHeaders(): HeadersInit {
    const token = authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let detail = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail || detail;
      } catch {
        // use default detail
      }
      const err = new Error(detail);
      (err as any).status = res.status;
      throw err;
    }
    return res.json() as Promise<T>;
  }

  // =========================================================================
  // DIAGRAMA
  // =========================================================================
  async getDiagrama(diagramaId: number): Promise<DiagramaApiItem> {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const cached = await diagramCache.getCachedDiagramById(diagramaId);
      if (cached) return cached;
      throw new Error('Sin conexión a internet y el diagrama no está disponible en caché local.');
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await this.handleResponse<DiagramaApiItem>(res);
      diagramCache.saveDiagram(data).catch((e) => console.warn('[DiagramCache] Error guardando copia:', e));
      return data;
    } catch (err: any) {
      if (err.status && err.status >= 400) {
        throw err;
      }
      if (typeof err.message === 'string' && (err.message.startsWith('Error 4') || err.message.startsWith('Error 5'))) {
        throw err;
      }
      const cached = await diagramCache.getCachedDiagramById(diagramaId);
      if (cached) return cached;
      throw err;
    }
  }

  async getDiagramaProyecto(proyectoId: number): Promise<DiagramaApiItem> {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const cached = await diagramCache.getCachedDiagramByProject(proyectoId);
      if (cached) return cached;
      throw new Error('Sin conexión a internet y el diagrama no está disponible en caché local.');
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/proyectos/${proyectoId}/diagrama`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await this.handleResponse<DiagramaApiItem>(res);
      diagramCache.saveDiagram(data).catch((e) => console.warn('[DiagramCache] Error guardando copia:', e));
      return data;
    } catch (err: any) {
      if (err.status && err.status >= 400) {
        throw err;
      }
      if (typeof err.message === 'string' && (err.message.startsWith('Error 4') || err.message.startsWith('Error 5'))) {
        throw err;
      }
      const cached = await diagramCache.getCachedDiagramByProject(proyectoId);
      if (cached) return cached;
      throw err;
    }
  }

  async updateDiagrama(diagramaId: number, data: { nombre?: string; descripcion?: string }): Promise<DiagramaApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<DiagramaApiItem>(res);
  }

  // =========================================================================
  // CLASES UML
  // =========================================================================
  async createClase(
    diagramaId: number,
    data: {
      nombre: string;
      estereotipo?: string;
      visibilidad?: string;
      es_abstracta?: boolean;
      posicion_x?: number;
      posicion_y?: number;
      ancho?: number;
      alto?: number;
    }
  ): Promise<ClaseApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/clases`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ClaseApiItem>(res);
  }

  async updateClase(
    diagramaId: number,
    claseId: number,
    data: {
      nombre?: string;
      estereotipo?: string;
      visibilidad?: string;
      es_abstracta?: boolean;
      ancho?: number;
      alto?: number;
    }
  ): Promise<ClaseApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/clases/${claseId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ClaseApiItem>(res);
  }

  async updateClasePosicion(
    diagramaId: number,
    claseId: number,
    posicion_x: number,
    posicion_y: number
  ): Promise<ClaseApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/clases/${claseId}/posicion`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ posicion_x, posicion_y }),
    });
    return this.handleResponse<ClaseApiItem>(res);
  }

  async deleteClase(diagramaId: number, claseId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/clases/${claseId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  // =========================================================================
  // ATRIBUTOS UML
  // =========================================================================
  async createAtributo(
    claseId: number,
    data: {
      nombre: string;
      tipo_dato: string;
      visibilidad?: string;
      valor_defecto?: string;
      es_estatico?: boolean;
      es_final?: boolean;
      es_nullable?: boolean;
      orden?: number;
    }
  ): Promise<AtributoApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/clases/${claseId}/atributos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<AtributoApiItem>(res);
  }

  async updateAtributo(
    atributoId: number,
    data: {
      nombre?: string;
      tipo_dato?: string;
      visibilidad?: string;
      valor_defecto?: string;
      es_estatico?: boolean;
      es_final?: boolean;
      es_nullable?: boolean;
      orden?: number;
    }
  ): Promise<AtributoApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/atributos/${atributoId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<AtributoApiItem>(res);
  }

  async deleteAtributo(atributoId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/atributos/${atributoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  // =========================================================================
  // MÉTODOS Y PARÁMETROS UML
  // =========================================================================
  async createMetodo(
    claseId: number,
    data: {
      nombre: string;
      tipo_retorno?: string;
      visibilidad?: string;
      es_estatico?: boolean;
      es_abstracto?: boolean;
      orden?: number;
    }
  ): Promise<MetodoApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/clases/${claseId}/metodos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<MetodoApiItem>(res);
  }

  async updateMetodo(
    metodoId: number,
    data: {
      nombre?: string;
      tipo_retorno?: string;
      visibilidad?: string;
      es_estatico?: boolean;
      es_abstracto?: boolean;
      orden?: number;
    }
  ): Promise<MetodoApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/metodos/${metodoId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<MetodoApiItem>(res);
  }

  async deleteMetodo(metodoId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/metodos/${metodoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  async createParametro(
    metodoId: number,
    data: {
      nombre: string;
      tipo_dato: string;
      valor_defecto?: string;
      orden?: number;
    }
  ): Promise<ParametroApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/metodos/${metodoId}/parametros`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ParametroApiItem>(res);
  }

  async updateParametro(
    parametroId: number,
    data: {
      nombre?: string;
      tipo_dato?: string;
      valor_defecto?: string;
      orden?: number;
    }
  ): Promise<ParametroApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/parametros/${parametroId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<ParametroApiItem>(res);
  }

  async deleteParametro(parametroId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/parametros/${parametroId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  // =========================================================================
  // RELACIONES UML
  // =========================================================================
  async createRelacion(
    diagramaId: number,
    data: {
      id_clase_origen: number;
      id_clase_destino: number;
      tipo: CanonicalUMLRelationType;
      nombre?: string;
      multiplicidad_origen?: string;
      multiplicidad_destino?: string;
      rol_origen?: string;
      rol_destino?: string;
      navegabilidad_origen?: boolean;
      navegabilidad_destino?: boolean;
    }
  ): Promise<RelacionApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/relaciones`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<RelacionApiItem>(res);
  }

  async updateRelacion(
    relacionId: number,
    data: {
      tipo?: CanonicalUMLRelationType;
      nombre?: string;
      multiplicidad_origen?: string;
      multiplicidad_destino?: string;
      rol_origen?: string;
      rol_destino?: string;
      navegabilidad_origen?: boolean;
      navegabilidad_destino?: boolean;
    }
  ): Promise<RelacionApiItem> {
    const res = await fetch(`${API_BASE_URL}/api/relaciones/${relacionId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse<RelacionApiItem>(res);
  }

  async deleteRelacion(relacionId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/relaciones/${relacionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.handleResponse(res);
  }

  // ==========================================
  // IA GENERATION (CU05)
  // ==========================================
  async generarDiagramaIA(diagramaId: number, prompt: string): Promise<{
    success: boolean;
    message: string;
    prompt: string;
    created_classes: string[];
    created_relations: number;
    total_classes: number;
    total_relations: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/ia/generar`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt }),
    });
    return this.handleResponse(res);
  }

  // ==========================================
  // COMANDOS DE VOZ (CU06)
  // ==========================================
  async ejecutarComandoVoz(diagramaId: number, transcripcion: string): Promise<{
    success: boolean;
    message: string;
    transcripcion: string;
    operation: string;
    detalles: Record<string, any>;
    total_classes: number;
    total_relations: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/voz/comando`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ transcripcion }),
    });
    return this.handleResponse(res);
  }

  // ==========================================
  // IMPORTAR DIAGRAMA DESDE IMAGEN (CU07)
  // ==========================================
  async analizarImagen(diagramaId: number, file: File): Promise<ImageUMLProposal> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/imagen/analizar`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });
    return this.handleResponse(res);
  }

  async aplicarPropuestaImagen(diagramaId: number, proposal: ImageUMLProposal): Promise<ImageApplyResult> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/imagen/aplicar`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(proposal),
    });
    return this.handleResponse(res);
  }

  // ==========================================
  // INTEROPERABILIDAD XMI UML (CU08 Y CU09)
  // ==========================================
  async exportarXMI(diagramaId: number): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/xmi/exportar`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      let detail = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail || detail;
      } catch {
        // use default detail
      }
      throw new Error(detail);
    }
    return res.blob();
  }

  async importarXMI(diagramaId: number, file: File): Promise<{
    success: boolean;
    message: string;
    total_classes: number;
    total_relations: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/xmi/importar`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });
    return this.handleResponse(res);
  }

  // ==========================================
  // GENERACIÓN DE BACKEND SPRING BOOT (CU10)
  // ==========================================
  async generarBackend(diagramaId: number): Promise<BackendGenerateResponse> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/backend/generar`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(res);
  }

  // ==========================================
  // DESCARGA DE BACKEND GENERADO EN ZIP (CU11)
  // ==========================================
  async descargarBackend(diagramaId: number): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(`${API_BASE_URL}/api/diagramas/${diagramaId}/backend/descargar`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      let detail = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        detail = errorJson.detail || detail;
      } catch {
        // use default detail
      }
      throw new Error(detail);
    }

    let filename = `ClassFlow_Backend_${diagramaId}.zip`;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await res.blob();
    return { blob, filename };
  }
}

export const diagramaService = new DiagramaService();

