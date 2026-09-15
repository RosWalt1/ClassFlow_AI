import React, { useState } from 'react';
import { ASSETS } from '../data/mockData';

interface RegisterScreenProps {
  onRegisterSuccess: (userKey: 'ana') => void;
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [name, setName] = useState('Ana López');
  const [email, setEmail] = useState('ana.lopez@enterprise.com');
  const [role, setRole] = useState('Software Engineer / Colaborador');
  const [password, setPassword] = useState('SuperSecretPassword2026!');
  const [confirmPassword, setConfirmPassword] = useState('SuperSecretPassword2026!');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      alert('Debes aceptar los términos y condiciones');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onRegisterSuccess('ana');
    }, 600);
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Background Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-secondary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Register Card */}
      <div className="w-full max-w-lg bg-surface-container-low/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 flex flex-col gap-6 relative z-10 border border-outline-variant/30">
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
            CASE Inteligente para Arquitectura de Software
          </p>
        </div>

        {/* Title & Subtitle */}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-on-surface tracking-tight">
            Crear Cuenta de Desarrollador
          </h2>
          <p className="text-xs text-outline">
            Comienza a modelar diagramas UML y generar microservicios en minutos.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface font-semibold">Nombre Completo</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  person
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ana López"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface font-semibold">Rol de Arquitectura</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full py-2.5 px-3 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
              >
                <option value="Software Engineer / Colaborador">Desarrollador Backend</option>
                <option value="Lead Software Architect">Arquitecto de Software</option>
                <option value="Tech Lead">Tech Lead</option>
                <option value="Estudiante">Estudiante / Investigador</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-on-surface font-semibold">Correo Corporativo / Universitario</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana.lopez@enterprise.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface font-semibold">Contraseña</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  lock
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface font-semibold">Confirmar Contraseña</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  lock_reset
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface-container text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/20"
                />
              </div>
            </div>
          </div>

          {/* Password strength visual */}
          <div className="flex items-center gap-2 p-2 rounded bg-surface-container/60 border border-outline-variant/10">
            <span className="material-symbols-outlined text-tertiary text-[16px]">verified</span>
            <span className="text-[11px] text-on-surface-variant font-mono">
              Fuerza: <strong className="text-tertiary">Fuerte</strong> (12+ caracteres, símbolos, números)
            </span>
          </div>

          {/* Terms checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="rounded accent-primary"
            />
            <label htmlFor="terms" className="text-[11px] text-on-surface-variant cursor-pointer">
              Acepto los{' '}
              <span className="text-primary hover:underline">Términos de Servicio</span> y la{' '}
              <span className="text-primary hover:underline">Política de Privacidad</span> de ClassFlow AI
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/30 flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span>Creando cuenta de desarrollador...</span>
              </>
            ) : (
              <>
                <span>Crear Cuenta y Comenzar</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Switch to Login */}
        <div className="text-center text-xs text-on-surface-variant pt-1 border-t border-outline-variant/20">
          <span>¿Ya tienes una cuenta registrada? </span>
          <button
            onClick={onNavigateToLogin}
            className="text-primary hover:underline font-semibold cursor-pointer"
          >
            Inicia sesión aquí
          </button>
        </div>
      </div>
    </div>
  );
};
