/**
 * Servicio de Autenticación de ClassFlow AI (CU01)
 * Conexión real con el backend FastAPI y PostgreSQL classflow_ai.
 */

export interface AuthUser {
  id_usuario: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  estado: string;
  fecha_registro: string;
  ultimo_acceso: string | null;
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

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

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
   * Diferencia fallos de red (mantiene sesión offline) vs errores 401/403 (cierra sesión).
   */
  async getMe(): Promise<AuthUser> {
    const token = this.getToken();
    if (!token) {
      throw new AuthError('No hay sesión activa', 401);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.clearSession();
          const errorData = await response.json().catch(() => null);
          const detail = errorData?.detail || 'Sesión no válida o expirada';
          throw new AuthError(detail, response.status);
        }

        // Si es otro código de error del servidor (5xx) pero existe usuario local, usar fallback
        const localUser = this.getStoredUser();
        if (localUser) {
          return localUser;
        }
        throw new Error('Error en el servidor');
      }

      const user: AuthUser = await response.json();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      // Si es un error de autorización real (401/403), re-lanzarlo para forzar login
      if (error instanceof AuthError) {
        throw error;
      }

      // Si es un fallo de conexión de red (Failed to fetch, offline, timeout, etc.)
      const localUser = this.getStoredUser();
      if (localUser) {
        // Tolerancia offline: preservar sesión y datos locales
        return localUser;
      }

      throw error;
    }
  }

  /**
   * Cierra sesión bajo arquitectura JWT stateless:
   * Notifica opcionalmente al backend para acuse de recibo y elimina el token
   * y los datos de usuario de localStorage. El backend no mantiene blacklist en servidor.
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
        // Ignorar fallos de red en logout stateless
      }
    }
    this.clearSession();
  }
}

export const authService = new AuthService();
