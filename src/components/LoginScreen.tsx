import React, { useState } from 'react';
import { ASSETS } from '../data/mockData';
import { authService, AuthUser } from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState('carlos@classflow.com');
  const [password, setPassword] = useState('ClassFlow2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await authService.login(loginEmail, loginPass);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(email, password);
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-surface-container-low/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 flex flex-col gap-6 relative z-10 border border-outline-variant/30">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src={ASSETS.logo}
              alt="ClassFlow AI"
              className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(192,193,255,0.5)]"
            />
            <span className="text-2xl font-bold tracking-tight text-on-surface">
              ClassFlow <span className="text-primary">AI</span>
            </span>
          </div>
          <p className="text-xs text-on-surface-variant max-w-xs">
            CASE Inteligente para Arquitectura de Software y Generación Determinista de Backend
          </p>
        </div>

        {/* Title & Subtitle */}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Iniciar Sesión</h2>
          <p className="text-xs text-outline">
            Ingresa tus credenciales para acceder a tus espacios de trabajo UML y pipelines de
            generación.
          </p>
        </div>

        {/* Real Error Message Banner */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-error-container/30 border border-error/40 text-error flex items-start gap-2.5 text-xs animate-shake">
            <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
            <div className="flex-1">
              <span className="font-semibold block">Error de autenticación:</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-on-surface font-semibold flex items-center justify-between">
              <span>Correo Electrónico</span>
              <span className="font-mono text-[10px] text-primary">PostgreSQL Auth</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@classflow.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-on-surface font-semibold">Contraseña</label>
              <button
                type="button"
                onClick={() => alert('Para entornos de prueba, use la contraseña: ClassFlow2026!')}
                className="text-[11px] text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                lock
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded accent-primary"
              />
              <span className="text-[11px] text-on-surface-variant">
                Recordarme en este dispositivo
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/30 flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-outline-variant/30"></div>
          <span className="font-mono text-[10px] text-outline uppercase tracking-wider">
            Cuentas de prueba oficiales
          </span>
          <div className="h-px flex-1 bg-outline-variant/30"></div>
        </div>

        {/* Quick Test Accounts */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setEmail('carlos@classflow.com');
              setPassword('ClassFlow2026!');
              executeLogin('carlos@classflow.com', 'ClassFlow2026!');
            }}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors border border-outline-variant/20 disabled:opacity-60"
            title="Iniciar sesión real como Carlos (Propietario)"
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface">shield_person</span>
            <span>Carlos (Propietario)</span>
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setEmail('ana@classflow.com');
              setPassword('ClassFlow2026!');
              executeLogin('ana@classflow.com', 'ClassFlow2026!');
            }}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors border border-outline-variant/20 disabled:opacity-60"
            title="Iniciar sesión real como Ana (Invitado)"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">person</span>
            <span>Ana (Invitado)</span>
          </button>
        </div>

        {/* Switch to Register */}
        <div className="text-center text-xs text-on-surface-variant pt-1 border-t border-outline-variant/20">
          <span>¿No tienes una cuenta? </span>
          <button
            onClick={onNavigateToRegister}
            className="text-primary hover:underline font-semibold cursor-pointer"
          >
            Regístrate aquí
          </button>
        </div>
      </div>

      {/* Security disclaimer footer */}
      <div className="mt-6 flex items-center gap-2 text-[11px] text-outline font-mono">
        <span className="material-symbols-outlined text-[14px] text-tertiary">lock</span>
        <span>Autenticación JWT • PostgreSQL classflow_ai • Cifrado Bcrypt</span>
      </div>
    </div>
  );
};
