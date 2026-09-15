import React, { useState } from 'react';
import { AppScreen, UserProfile } from '../types';

interface ProfileScreenProps {
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  onSwitchUser: (userKey: 'carlos' | 'ana') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onNavigate: _onNavigate,
  currentUser,
  onSwitchUser,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [roleTitle, setRoleTitle] = useState(currentUser.role);
  const [email, setEmail] = useState(currentUser.email);
  const [timezone, setTimezone] = useState('UTC-5 (America/Bogota)');
  const [defaultVisibility, setDefaultVisibility] = useState('private');
  const [jpaAnnotations, setJpaAnnotations] = useState(true);
  const [wsSync, setWsSync] = useState(true);
  const [voiceAi, setVoiceAi] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-3.5rem)] bg-background relative overflow-x-hidden p-4 sm:p-6">
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-mono text-xs text-primary tracking-wide uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-tertiary"></span>
            <span>Espacio de Trabajo / CU01</span>
            <span className="text-outline">/</span>
            <span className="text-on-surface-variant font-medium">Ajustes de Cuenta</span>
          </div>
          <h1 className="text-3xl text-on-surface tracking-tight font-bold">
            Configuración de Perfil
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl">
            Administra tu identidad de desarrollador, llaves de API, preferencias de modelado y
            sincronización con repositorios Git.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: User Card & Metrics (4 cols) */}
          <div className="md:col-span-4 flex flex-col gap-4">
            {/* Identity Card */}
            <div className="bg-surface-container-low rounded-xl p-5 shadow-xl flex flex-col items-center text-center gap-3 border border-outline-variant/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-secondary" />

              <div className="relative mt-2">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-surface-container shadow-lg"
                />
                <button
                  onClick={() => alert('Seleccionar nueva fotografía de perfil')}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-on-primary hover:bg-primary-fixed-dim transition-colors shadow-md"
                  title="Cambiar foto"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                </button>
              </div>

              <div className="flex flex-col gap-0.5">
                <h2 className="text-lg font-bold text-on-surface">{currentUser.name}</h2>
                <span className="text-xs text-primary font-medium">{currentUser.role}</span>
                <span className="mt-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-tertiary font-mono text-[11px] font-semibold">
                  {currentUser.permissionsBadge}
                </span>
              </div>

              {/* Developer stats */}
              <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-outline-variant/15">
                <div className="flex flex-col items-center">
                  <span className="text-base font-bold text-on-surface">14</span>
                  <span className="text-[10px] text-outline uppercase font-semibold">Proyectos</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-base font-bold text-secondary">87</span>
                  <span className="text-[10px] text-outline uppercase font-semibold">Clases</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-base font-bold text-tertiary">3.2k</span>
                  <span className="text-[10px] text-outline uppercase font-semibold">Líneas</span>
                </div>
              </div>

              {/* Quick switch between Carlos and Ana */}
              <div className="w-full pt-2">
                <button
                  onClick={() => onSwitchUser(currentUser.name === 'Carlos Mendoza' ? 'ana' : 'carlos')}
                  className="w-full py-2 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-medium transition-colors border border-outline-variant/20 flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                  <span>
                    {currentUser.name === 'Carlos Mendoza'
                      ? 'Cambiar a sesión de Ana López (Invitado)'
                      : 'Cambiar a sesión de Carlos Mendoza (Propietario)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Security & 2FA Info */}
            <div className="bg-surface-container-low rounded-xl p-4 shadow-md flex flex-col gap-3 border border-outline-variant/15 text-xs">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                Seguridad & Acceso
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">verified_user</span>
                  <span className="text-on-surface">Autenticación 2FA</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary-container text-[11px] font-semibold">
                  Activo (TOTP)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[18px]">key</span>
                  <span className="text-on-surface">Clave de Acceso</span>
                </div>
                <button
                  onClick={() => alert('Modal para actualizar contraseña')}
                  className="text-primary hover:underline font-medium text-[11px]"
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Settings Form & Modeling Preferences (8 cols) */}
          <div className="md:col-span-8 flex flex-col gap-4">
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              {/* Box 1: Personal Profile Data */}
              <div className="bg-surface-container-low rounded-xl p-5 shadow-xl flex flex-col gap-4 border border-outline-variant/20">
                <div className="flex items-center gap-2 border-b border-outline-variant/15 pb-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
                  <h3 className="text-sm font-bold text-on-surface">Datos de Identidad</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-outline font-semibold">Nombre Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="p-2 rounded-lg bg-surface-container text-on-surface outline-none border border-outline-variant/20 focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-outline font-semibold">Título Profesional</label>
                    <input
                      type="text"
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      className="p-2 rounded-lg bg-surface-container text-on-surface outline-none border border-outline-variant/20 focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-outline font-semibold">Correo Electrónico</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="p-2 rounded-lg bg-surface-container text-on-surface outline-none border border-outline-variant/20 focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-outline font-semibold">Zona Horaria</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="p-2 rounded-lg bg-surface-container text-on-surface outline-none border border-outline-variant/20 focus:border-primary"
                    >
                      <option value="UTC-5 (America/Bogota)">UTC-5 (America/Bogota)</option>
                      <option value="UTC-6 (America/Mexico_City)">UTC-6 (America/Mexico_City)</option>
                      <option value="UTC-3 (America/Buenos_Aires)">UTC-3 (America/Buenos_Aires)</option>
                      <option value="UTC+1 (Europe/Madrid)">UTC+1 (Europe/Madrid)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Box 2: Modeling & IDE CASE Preferences */}
              <div className="bg-surface-container-low rounded-xl p-5 shadow-xl flex flex-col gap-4 border border-outline-variant/20">
                <div className="flex items-center gap-2 border-b border-outline-variant/15 pb-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">tune</span>
                  <h3 className="text-sm font-bold text-on-surface">
                    Preferencias de Modelado & CASE Engine
                  </h3>
                </div>

                <div className="flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/10">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">
                        Visibilidad por defecto para nuevos atributos
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Se asignará automáticamente al pulsar "+ Agregar Atributo"
                      </span>
                    </div>
                    <select
                      value={defaultVisibility}
                      onChange={(e) => setDefaultVisibility(e.target.value)}
                      className="p-1.5 rounded bg-surface-container-lowest text-on-surface font-mono text-xs border border-outline-variant/20"
                    >
                      <option value="private">- (Private)</option>
                      <option value="public">+ (Public)</option>
                      <option value="protected"># (Protected)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/10">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">
                        Anotaciones JPA / Hibernate automáticas
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Inserta @Entity, @Table, @OneToMany deterministas en el AST
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={jpaAnnotations}
                      onChange={(e) => setJpaAnnotations(e.target.checked)}
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/10">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">
                        Sincronización WebSockets en tiempo real
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Muestra cursores activos y ediciones colaborativas instantáneas
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={wsSync}
                      onChange={(e) => setWsSync(e.target.checked)}
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container border border-outline-variant/10">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">
                        Comandos de voz con ClassFlow AI
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Permite dictar "Agrega clase..." o "Conecta con asociación..."
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={voiceAi}
                      onChange={(e) => setVoiceAi(e.target.checked)}
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Box 3: Git & Cloud Integrations */}
              <div className="bg-surface-container-low rounded-xl p-5 shadow-xl flex flex-col gap-4 border border-outline-variant/20">
                <div className="flex items-center gap-2 border-b border-outline-variant/15 pb-2">
                  <span className="material-symbols-outlined text-tertiary text-[20px]">
                    cloud_sync
                  </span>
                  <h3 className="text-sm font-bold text-on-surface">
                    Integraciones con Repositorios & CI/CD
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-container flex flex-col justify-between gap-2 border border-outline-variant/10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-on-surface">GitHub</span>
                      <span className="w-2 h-2 rounded-full bg-tertiary" />
                    </div>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      @cmendoza-dev
                    </span>
                    <span className="text-[10px] text-tertiary font-semibold">Conectado</span>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container flex flex-col justify-between gap-2 border border-outline-variant/10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-on-surface">GitLab</span>
                      <span className="w-2 h-2 rounded-full bg-outline" />
                    </div>
                    <span className="font-mono text-[11px] text-outline">Sin vincular</span>
                    <button
                      type="button"
                      onClick={() => alert('Vincular cuenta de GitLab')}
                      className="text-[10px] text-primary hover:underline text-left font-semibold"
                    >
                      Conectar
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container flex flex-col justify-between gap-2 border border-outline-variant/10">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-on-surface">Docker Hub</span>
                      <span className="w-2 h-2 rounded-full bg-tertiary" />
                    </div>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      classflow/engine
                    </span>
                    <span className="text-[10px] text-tertiary font-semibold">Conectado</span>
                  </div>
                </div>
              </div>

              {/* Submit Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {isSaved && (
                  <span className="font-mono text-xs text-tertiary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Preferencias guardadas exitosamente</span>
                  </span>
                )}
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-fixed-dim transition-all shadow-md shadow-primary/25 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
