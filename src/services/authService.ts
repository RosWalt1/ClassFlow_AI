/**
 * Servicio de Autenticación de ClassFlow AI (CU01)
 * Conexión real con el backend FastAPI y PostgreSQL classflow_ai.
 */

export interface AuthUser {
  id_usuario: number;
  nombre: string;
  email: string;
  estado: string;
  ultimo_acceso: string | null;
  creado_en: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

const TOKEN_KEY = 'classflow_access_token';
const USER_KEY = 'classflow_auth_user';

// URL base del backend: usa proxy relativo '/api' con fallback a 'http://localhost:8000/api'
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api';

class AuthService {
  /**
   * Almacena el token y los datos del usuario en localStorage
   */
  setSession(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /**
   * Elimina el token y la sesión local
   */
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Retorna el token JWT actual
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Retorna el usuario almacenado localmente
   */
  getStoredUser(): AuthUser | null {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as AuthUser;
    } catch {
      return null;
    }
  }

  /**
   * Verifica si existe un token en almacenamiento
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Inicia sesión contra el backend FastAPI (POST /api/auth/login)
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const detail = errorData?.detail || 'Error al iniciar sesión';
      throw new Error(detail);
    }

    const data: LoginResponse = await response.json();
    this.setSession(data.access_token, data.user);
    return data;
  }

  /**
   * Obtiene la información del usuario autenticado actual (GET /api/auth/me)
   */
  async getMe(): Promise<AuthUser> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay sesión activa');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.clearSession();
      }
      const errorData = await response.json().catch(() => null);
      const detail = errorData?.detail || 'Sesión no válida o expirada';
      throw new Error(detail);
    }

    const user: AuthUser = await response.json();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  /**
   * Cierra sesión notificando al backend y limpiando el almacenamiento local
   */
  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignorar fallos de red en logout
      }
    }
    this.clearSession();
  }
}

export const authService = new AuthService();
